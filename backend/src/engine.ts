import { nanoid } from "nanoid";
import { performParticipantAction } from "./participants.js";
import { newId, type WorkflowStore } from "./store.js";
import type { ApprovalTask, Decision, ExecutionDetail, Job, PurchaseInput, StepExecution, WorkflowEvent, WorkflowExecution } from "./types.js";
import { FORWARD_STEPS } from "./types.js";

const timestamp = () => new Date().toISOString();
const terminalStates = new Set(["COMPLETED", "COMPENSATED", "MANUAL_RECOVERY_REQUIRED"]);

export class WorkflowEngine {
  constructor(
    private store: WorkflowStore,
    private options: { approvalTimeoutSeconds: number; maxRetryAttempts: number; retryBaseMs: number } = { approvalTimeoutSeconds: 60, maxRetryAttempts: 3, retryBaseMs: 1_000 },
  ) {}

  private async event(executionId: string, type: string, stepKey?: string, payload?: Record<string, unknown>, actorId?: string) {
    const events = await this.store.listEvents(executionId);
    const event: WorkflowEvent = {
      id: newId("event"),
      executionId,
      sequence: events.length + 1,
      type,
      stepKey,
      payload,
      actorId,
      createdAt: timestamp(),
    };
    await this.store.insertEvent(event);
  }

  private stepDefinition(stepKey: string) {
    const step = FORWARD_STEPS.find(item => item.key === stepKey);
    if (!step) throw new Error(`Unknown workflow step: ${stepKey}`);
    return step;
  }

  private async enqueue(executionId: string, stepKey: string, type: Job["type"], priority = 5) {
    const time = timestamp();
    await this.store.createJob({
      id: newId("job"),
      type,
      executionId,
      stepKey,
      status: "PENDING",
      attemptCount: 0,
      maxAttempts: this.options.maxRetryAttempts,
      availableAt: time,
      priority,
      idempotencyKey: `${executionId}:${stepKey}:${type.toLowerCase()}:v1`,
      createdAt: time,
      updatedAt: time,
    });
  }

  async startPurchaseWorkflow(input: PurchaseInput, requestedBy: string, businessKey: string, startIdempotencyKey: string) {
    const existing = await this.store.findExecutionByStartKey(startIdempotencyKey);
    if (existing) return existing;

    const time = timestamp();
    const execution: WorkflowExecution = {
      id: newId("exec"),
      workflowKey: "purchase-request",
      businessKey,
      startIdempotencyKey,
      status: "RUNNING",
      currentStepKey: "create-order",
      input,
      requestedBy,
      correlationId: `corr_${nanoid(10)}`,
      version: 1,
      startedAt: time,
      updatedAt: time,
    };
    await this.store.createExecution(execution);
    await Promise.all(FORWARD_STEPS.map(async (definition, position) => {
      const step: StepExecution = {
        id: newId("step"),
        executionId: execution.id,
        stepKey: definition.key,
        position,
        participant: definition.participant,
        status: "PENDING",
        attemptCount: 0,
        idempotencyKey: `${execution.id}:${definition.key}:forward:v1`,
        createdAt: time,
        updatedAt: time,
      };
      await this.store.upsertStep(step);
    }));
    await this.event(execution.id, "WORKFLOW_STARTED", "create-order", { businessKey, correlationId: execution.correlationId }, requestedBy);
    await this.enqueue(execution.id, "create-order", "FORWARD", 10);
    return execution;
  }

  async processJob(job: Job) {
    const execution = await this.store.getExecution(job.executionId);
    if (!execution || terminalStates.has(execution.status)) {
      await this.store.completeJob(job.id);
      return;
    }
    if (job.type === "COMPENSATION") return this.processCompensation(job, execution);
    return this.processForward(job, execution);
  }

  private async processForward(job: Job, execution: WorkflowExecution) {
    const definition = this.stepDefinition(job.stepKey);
    const step = await this.store.getStep(execution.id, job.stepKey);
    if (!step || step.status === "SUCCEEDED") {
      await this.store.completeJob(job.id);
      return;
    }
    if (definition.participant === "human") {
      await this.openApproval(job, execution, step);
      return;
    }
    await this.store.upsertStep({ ...step, status: "RUNNING", attemptCount: job.attemptCount, updatedAt: timestamp() });
    try {
      const result = await performParticipantAction(this.store, definition.participant, definition.action, step.idempotencyKey, execution.businessKey);
      const completeStep = { ...step, status: "SUCCEEDED" as const, attemptCount: job.attemptCount, output: result, error: undefined, updatedAt: timestamp() };
      await this.store.upsertStep(completeStep);
      await this.store.completeJob(job.id);
      await this.event(execution.id, "STEP_SUCCEEDED", job.stepKey, result);
      const next = FORWARD_STEPS[step.position + 1];
      if (!next) {
        await this.store.updateExecution(execution.id, { status: "COMPLETED", currentStepKey: job.stepKey });
        await this.event(execution.id, "WORKFLOW_COMPLETED", job.stepKey);
      } else {
        await this.store.updateExecution(execution.id, { status: "RUNNING", currentStepKey: next.key });
        await this.enqueue(execution.id, next.key, "FORWARD");
      }
    } catch (error) {
      await this.handleJobFailure(job, execution, step, error instanceof Error ? error.message : "Unexpected participant failure");
    }
  }

  private async openApproval(job: Job, execution: WorkflowExecution, step: StepExecution) {
    const time = timestamp();
    const dueAt = new Date(Date.now() + this.options.approvalTimeoutSeconds * 1_000).toISOString();
    const task: ApprovalTask = {
      id: newId("approval"),
      executionId: execution.id,
      stepKey: "manager-approval",
      assignedTo: "user_manager",
      status: "OPEN",
      dueAt,
      createdAt: time,
      updatedAt: time,
    };
    await this.store.createApproval(task);
    await this.store.upsertStep({ ...step, status: "WAITING", updatedAt: time });
    await this.store.updateExecution(execution.id, { status: "WAITING_FOR_APPROVAL", currentStepKey: step.stepKey });
    await this.store.completeJob(job.id);
    await this.event(execution.id, "APPROVAL_REQUESTED", step.stepKey, { approvalId: task.id, dueAt, assignedTo: task.assignedTo });
  }

  private async handleJobFailure(job: Job, execution: WorkflowExecution, step: StepExecution, error: string) {
    if (job.attemptCount < job.maxAttempts) {
      const delay = this.options.retryBaseMs * Math.max(1, job.attemptCount);
      const availableAt = new Date(Date.now() + delay).toISOString();
      await this.store.rescheduleJob(job.id, availableAt, error);
      await this.store.upsertStep({ ...step, status: "RETRYING", attemptCount: job.attemptCount, error, updatedAt: timestamp() });
      await this.event(execution.id, "STEP_RETRY_SCHEDULED", job.stepKey, { attempt: job.attemptCount, nextAttemptAt: availableAt, error });
      return;
    }
    await this.store.deadLetterJob(job.id, error);
    await this.store.upsertStep({ ...step, status: "FAILED", attemptCount: job.attemptCount, error, updatedAt: timestamp() });
    await this.event(execution.id, "STEP_FAILED", job.stepKey, { error, attempts: job.attemptCount });
    if (job.type === "COMPENSATION") {
      await this.store.updateExecution(execution.id, { status: "MANUAL_RECOVERY_REQUIRED", currentStepKey: job.stepKey });
      await this.event(execution.id, "MANUAL_RECOVERY_REQUIRED", job.stepKey, { error });
      return;
    }
    await this.beginCompensation(execution.id, "Forward operation permanently failed");
  }

  async decideApproval(approvalId: string, decision: Decision, actorId: string, comment?: string) {
    const task = await this.store.decideApproval(approvalId, decision, actorId, comment);
    if (!task) throw new Error("This approval is already decided or expired.");
    const execution = await this.store.getExecution(task.executionId);
    if (!execution) throw new Error("Workflow execution was not found.");
    const step = await this.store.getStep(execution.id, task.stepKey);
    if (!step) throw new Error("Approval step was not found.");
    if (decision === "APPROVE") {
      await this.store.upsertStep({ ...step, status: "SUCCEEDED", output: { decision, comment, decidedAt: task.decidedAt }, updatedAt: timestamp() });
      const next = FORWARD_STEPS[step.position + 1];
      await this.store.updateExecution(execution.id, { status: "RUNNING", currentStepKey: next.key });
      await this.event(execution.id, "APPROVAL_APPROVED", step.stepKey, { comment }, actorId);
      await this.enqueue(execution.id, next.key, "FORWARD", 10);
    } else {
      await this.store.upsertStep({ ...step, status: "FAILED", error: decision === "REJECT" ? "Request rejected by approver" : "Changes requested by approver", updatedAt: timestamp() });
      await this.event(execution.id, decision === "REJECT" ? "APPROVAL_REJECTED" : "CHANGES_REQUESTED", step.stepKey, { comment }, actorId);
      await this.beginCompensation(execution.id, decision === "REJECT" ? "Request rejected by approver" : "Changes requested by approver");
    }
    return task;
  }

  async cancelExecution(executionId: string, actorId: string) {
    const execution = await this.store.getExecution(executionId);
    if (!execution) throw new Error("Workflow execution was not found.");
    if (terminalStates.has(execution.status)) throw new Error("This workflow is already in a terminal state.");
    await this.store.cancelOpenApprovals(executionId);
    await this.event(executionId, "WORKFLOW_CANCELLED", undefined, { reason: "Cancelled by an administrator" }, actorId);
    await this.beginCompensation(executionId, "Cancelled by an administrator");
  }

  async retryManualRecovery(executionId: string, actorId: string) {
    const execution = await this.store.getExecution(executionId);
    if (!execution) throw new Error("Workflow execution was not found.");
    if (execution.status !== "MANUAL_RECOVERY_REQUIRED") throw new Error("Only a manual recovery case can be retried.");
    const step = await this.store.getStep(executionId, execution.currentStepKey);
    if (!step) throw new Error("The failed recovery step was not found.");
    const definition = this.stepDefinition(step.stepKey);
    if (!definition.compensation) throw new Error("This recovery step does not support compensation retry.");
    await this.store.updateExecution(executionId, { status: "COMPENSATING", currentStepKey: step.stepKey });
    await this.store.upsertStep({ ...step, status: "PENDING", error: undefined, updatedAt: timestamp() });
    await this.event(executionId, "MANUAL_RECOVERY_RETRY_REQUESTED", step.stepKey, { previousAttempts: step.attemptCount }, actorId);
    await this.enqueue(executionId, step.stepKey, "COMPENSATION", 30);
  }

  private async beginCompensation(executionId: string, reason: string) {
    const execution = await this.store.getExecution(executionId);
    if (!execution || terminalStates.has(execution.status)) return;
    await this.store.updateExecution(executionId, { status: "COMPENSATING" });
    await this.event(executionId, "COMPENSATION_STARTED", undefined, { reason });
    await this.enqueueNextCompensation(executionId);
  }

  private async enqueueNextCompensation(executionId: string) {
    const steps = await this.store.listSteps(executionId);
    const candidate = [...steps].reverse().find(step => {
      const definition = this.stepDefinition(step.stepKey);
      return step.status === "SUCCEEDED" && definition.compensation;
    });
    if (!candidate) {
      await this.store.updateExecution(executionId, { status: "COMPENSATED" });
      await this.event(executionId, "WORKFLOW_COMPENSATED");
      return;
    }
    await this.enqueue(executionId, candidate.stepKey, "COMPENSATION", 20);
  }

  private async processCompensation(job: Job, execution: WorkflowExecution) {
    const definition = this.stepDefinition(job.stepKey);
    const step = await this.store.getStep(execution.id, job.stepKey);
    if (!step || !definition.compensation) {
      await this.store.completeJob(job.id);
      return;
    }
    await this.store.upsertStep({ ...step, status: "COMPENSATING", attemptCount: job.attemptCount, updatedAt: timestamp() });
    try {
      const result = await performParticipantAction(this.store, definition.participant as Exclude<typeof definition.participant, "human">, definition.compensation, `${step.idempotencyKey}:compensation`, execution.businessKey);
      await this.store.upsertStep({ ...step, status: "COMPENSATED", attemptCount: job.attemptCount, output: { ...(step.output ?? {}), compensation: result }, updatedAt: timestamp() });
      await this.store.completeJob(job.id);
      await this.event(execution.id, "STEP_COMPENSATED", step.stepKey, result);
      await this.enqueueNextCompensation(execution.id);
    } catch (error) {
      await this.handleJobFailure(job, execution, step, error instanceof Error ? error.message : "Compensation failed");
    }
  }

  async expireApprovals() {
    const expired = await this.store.expireApprovals(timestamp());
    for (const task of expired) {
      const step = await this.store.getStep(task.executionId, task.stepKey);
      if (step) await this.store.upsertStep({ ...step, status: "FAILED", error: "Approval deadline expired", updatedAt: timestamp() });
      await this.event(task.executionId, "APPROVAL_EXPIRED", task.stepKey, { dueAt: task.dueAt });
      await this.beginCompensation(task.executionId, "Approval deadline expired");
    }
    return expired.length;
  }

  async getExecutionDetail(executionId: string): Promise<ExecutionDetail | undefined> {
    const execution = await this.store.getExecution(executionId);
    if (!execution) return undefined;
    const [steps, events, approvals] = await Promise.all([
      this.store.listSteps(executionId),
      this.store.listEvents(executionId),
      this.store.listApprovals(),
    ]);
    return { execution, steps, events, approval: approvals.find(item => item.executionId === executionId) };
  }
}
