import { nanoid } from "nanoid";
import type {
  ApprovalTask,
  Decision,
  FaultRule,
  Job,
  ParticipantOperation,
  StepExecution,
  User,
  WorkflowEvent,
  WorkflowExecution,
} from "./types.js";

export interface WorkflowStore {
  init(): Promise<void>;
  seedUsers(users: User[]): Promise<void>;
  findUserByEmail(email: string): Promise<User | undefined>;
  getUser(id: string): Promise<User | undefined>;
  createUser(user: User): Promise<void>;
  createExecution(execution: WorkflowExecution): Promise<void>;
  getExecution(id: string): Promise<WorkflowExecution | undefined>;
  findExecutionByStartKey(key: string): Promise<WorkflowExecution | undefined>;
  listExecutions(): Promise<WorkflowExecution[]>;
  updateExecution(id: string, patch: Partial<WorkflowExecution>): Promise<WorkflowExecution | undefined>;
  upsertStep(step: StepExecution): Promise<void>;
  getStep(executionId: string, stepKey: string): Promise<StepExecution | undefined>;
  listSteps(executionId: string): Promise<StepExecution[]>;
  insertEvent(event: WorkflowEvent): Promise<void>;
  listEvents(executionId: string): Promise<WorkflowEvent[]>;
  createApproval(task: ApprovalTask): Promise<void>;
  getApproval(id: string): Promise<ApprovalTask | undefined>;
  listApprovals(assignee?: string): Promise<ApprovalTask[]>;
  decideApproval(id: string, decision: Decision, actorId: string, comment?: string): Promise<ApprovalTask | undefined>;
  cancelOpenApprovals(executionId: string): Promise<void>;
  expireApprovals(now: string): Promise<ApprovalTask[]>;
  createJob(job: Job): Promise<void>;
  claimNextJob(workerId: string, now: string): Promise<Job | undefined>;
  completeJob(id: string): Promise<void>;
  rescheduleJob(id: string, availableAt: string, error: string): Promise<void>;
  deadLetterJob(id: string, error: string): Promise<void>;
  getOperation(participant: string, idempotencyKey: string): Promise<ParticipantOperation | undefined>;
  saveOperation(operation: ParticipantOperation): Promise<void>;
  setFault(rule: FaultRule): Promise<void>;
  consumeFault(participant: string): Promise<FaultRule | undefined>;
}

const copy = <T>(value: T): T => structuredClone(value);
const now = () => new Date().toISOString();

export class MemoryStore implements WorkflowStore {
  private users = new Map<string, User>();
  private executions = new Map<string, WorkflowExecution>();
  private steps = new Map<string, StepExecution>();
  private events = new Map<string, WorkflowEvent>();
  private approvals = new Map<string, ApprovalTask>();
  private jobs = new Map<string, Job>();
  private operations = new Map<string, ParticipantOperation>();
  private faults = new Map<string, FaultRule>();

  async init() {}

  async seedUsers(users: User[]) {
    users.forEach(user => this.users.set(user.id, copy(user)));
  }

  async findUserByEmail(email: string) {
    return copy([...this.users.values()].find(user => user.email.toLowerCase() === email.toLowerCase()));
  }

  async getUser(id: string) {
    return copy(this.users.get(id));
  }

  async createUser(user: User) {
    const email = user.email.toLowerCase();
    if ([...this.users.values()].some(existing => existing.email.toLowerCase() === email)) {
      throw new Error("EMAIL_ALREADY_EXISTS");
    }
    this.users.set(user.id, copy({ ...user, email }));
  }

  async createExecution(execution: WorkflowExecution) {
    this.executions.set(execution.id, copy(execution));
  }

  async getExecution(id: string) {
    return copy(this.executions.get(id));
  }

  async findExecutionByStartKey(key: string) {
    return copy([...this.executions.values()].find(execution => execution.startIdempotencyKey === key));
  }

  async listExecutions() {
    return copy([...this.executions.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }

  async updateExecution(id: string, patch: Partial<WorkflowExecution>) {
    const existing = this.executions.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...copy(patch), version: existing.version + 1, updatedAt: now() };
    this.executions.set(id, updated);
    return copy(updated);
  }

  async upsertStep(step: StepExecution) {
    this.steps.set(`${step.executionId}:${step.stepKey}`, copy(step));
  }

  async getStep(executionId: string, stepKey: string) {
    return copy(this.steps.get(`${executionId}:${stepKey}`));
  }

  async listSteps(executionId: string) {
    return copy([...this.steps.values()].filter(step => step.executionId === executionId).sort((a, b) => a.position - b.position));
  }

  async insertEvent(event: WorkflowEvent) {
    this.events.set(event.id, copy(event));
  }

  async listEvents(executionId: string) {
    return copy([...this.events.values()].filter(event => event.executionId === executionId).sort((a, b) => a.sequence - b.sequence));
  }

  async createApproval(task: ApprovalTask) {
    this.approvals.set(task.id, copy(task));
  }

  async getApproval(id: string) {
    return copy(this.approvals.get(id));
  }

  async listApprovals(assignee?: string) {
    return copy([...this.approvals.values()]
      .filter(task => !assignee || task.assignedTo === assignee)
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt)));
  }

  async decideApproval(id: string, decision: Decision, actorId: string, comment?: string) {
    const task = this.approvals.get(id);
    if (!task || task.status !== "OPEN" || task.dueAt <= now()) return undefined;
    const status = decision === "APPROVE" ? "APPROVED" : decision === "REJECT" ? "REJECTED" : "CHANGES_REQUESTED";
    const updated = { ...task, status, decision, comment, decidedBy: actorId, decidedAt: now(), updatedAt: now() } as ApprovalTask;
    this.approvals.set(id, updated);
    return copy(updated);
  }

  async cancelOpenApprovals(executionId: string) {
    for (const [id, task] of this.approvals.entries()) {
      if (task.executionId === executionId && task.status === "OPEN") {
        this.approvals.set(id, { ...task, status: "EXPIRED", updatedAt: now() });
      }
    }
  }

  async expireApprovals(current: string) {
    const expired: ApprovalTask[] = [];
    for (const [id, task] of this.approvals.entries()) {
      if (task.status === "OPEN" && task.dueAt <= current) {
        const updated = { ...task, status: "EXPIRED" as const, updatedAt: current };
        this.approvals.set(id, updated);
        expired.push(copy(updated));
      }
    }
    return expired;
  }

  async createJob(job: Job) {
    this.jobs.set(job.id, copy(job));
  }

  async claimNextJob(workerId: string, current: string) {
    const job = [...this.jobs.values()]
      .filter(item => (item.status === "PENDING" && item.availableAt <= current) || (item.status === "RUNNING" && !!item.leaseUntil && item.leaseUntil <= current))
      .sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt))[0];
    if (!job) return undefined;
    const claimed = { ...job, status: "RUNNING" as const, claimedBy: workerId, leaseUntil: new Date(Date.parse(current) + 30_000).toISOString(), attemptCount: job.attemptCount + 1, updatedAt: current };
    this.jobs.set(claimed.id, claimed);
    return copy(claimed);
  }

  async completeJob(id: string) {
    const job = this.jobs.get(id);
    if (job) this.jobs.set(id, { ...job, status: "SUCCEEDED", claimedBy: undefined, leaseUntil: undefined, updatedAt: now() });
  }

  async rescheduleJob(id: string, availableAt: string, error: string) {
    const job = this.jobs.get(id);
    if (job) this.jobs.set(id, { ...job, status: "PENDING", availableAt, lastError: error, claimedBy: undefined, leaseUntil: undefined, updatedAt: now() });
  }

  async deadLetterJob(id: string, error: string) {
    const job = this.jobs.get(id);
    if (job) this.jobs.set(id, { ...job, status: "DEAD_LETTER", lastError: error, claimedBy: undefined, leaseUntil: undefined, updatedAt: now() });
  }

  async getOperation(participant: string, idempotencyKey: string) {
    return copy(this.operations.get(`${participant}:${idempotencyKey}`));
  }

  async saveOperation(operation: ParticipantOperation) {
    this.operations.set(`${operation.participant}:${operation.idempotencyKey}`, copy(operation));
  }

  async setFault(rule: FaultRule) {
    this.faults.set(rule.participant, copy(rule));
  }

  async consumeFault(participant: string) {
    const rule = this.faults.get(participant);
    if (!rule || rule.remaining <= 0) return undefined;
    const result = copy(rule);
    this.faults.set(participant, { ...rule, remaining: rule.mode === "FAIL_ALWAYS" ? rule.remaining : rule.remaining - 1, updatedAt: now() });
    return result;
  }
}

export const newId = (prefix: string) => `${prefix}_${nanoid(10)}`;
