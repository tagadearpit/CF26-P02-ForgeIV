import { describe, expect, it } from "vitest";
import { WorkflowEngine } from "../src/engine.js";
import { MemoryStore } from "../src/store.js";
import { seedDemoUsers } from "../src/seed.js";
import { processOneCycle } from "../src/worker-runner.js";
async function drain(engine: WorkflowEngine, store: MemoryStore, cycles = 20) {
  for (let index = 0; index < cycles; index += 1) {
    const result = await processOneCycle(engine, store, "test_worker");
    if (!result.processedJob) break;
  }
}

describe("FlowGuard workflow engine", () => {
  it("pauses for approval, then completes the purchase workflow", async () => {
    const store = new MemoryStore();
    await store.init();
    await seedDemoUsers(store);
    const engine = new WorkflowEngine(store, { approvalTimeoutSeconds: 60, maxRetryAttempts: 3, retryBaseMs: 1 });
    const execution = await engine.startPurchaseWorkflow({ requester: "Priya", sku: "SKU-42", quantity: 2, amount: 500, currency: "USD" }, "user_requester", "ORDER-1001", "client-key-1001");
    await drain(engine, store);
    let detail = await engine.getExecutionDetail(execution.id);
    expect(detail?.execution.status).toBe("WAITING_FOR_APPROVAL");
    expect(detail?.approval?.status).toBe("OPEN");

    await engine.decideApproval(detail!.approval!.id, "APPROVE", "user_manager", "Approved for the demo");
    await drain(engine, store);
    detail = await engine.getExecutionDetail(execution.id);
    expect(detail?.execution.status).toBe("COMPLETED");
    expect(detail?.events.some(event => event.type === "WORKFLOW_COMPLETED")).toBe(true);
  });

  it("compensates completed work when an approver rejects the request", async () => {
    const store = new MemoryStore();
    await store.init();
    await seedDemoUsers(store);
    const engine = new WorkflowEngine(store, { approvalTimeoutSeconds: 60, maxRetryAttempts: 3, retryBaseMs: 1 });
    const execution = await engine.startPurchaseWorkflow({ requester: "Priya", sku: "SKU-11", quantity: 1, amount: 850, currency: "USD" }, "user_requester", "ORDER-1002", "client-key-1002");
    await drain(engine, store);
    const awaiting = await engine.getExecutionDetail(execution.id);
    await engine.decideApproval(awaiting!.approval!.id, "REJECT", "user_manager", "Budget is not available");
    await drain(engine, store);
    const detail = await engine.getExecutionDetail(execution.id);
    expect(detail?.execution.status).toBe("COMPENSATED");
    expect(detail?.steps.filter(step => ["create-order", "reserve-inventory", "authorize-payment"].includes(step.stepKey)).every(step => step.status === "COMPENSATED")).toBe(true);
  });

  it("uses the start idempotency key to avoid duplicate workflow executions", async () => {
    const store = new MemoryStore();
    await store.init();
    await seedDemoUsers(store);
    const engine = new WorkflowEngine(store);
    const request = { requester: "Priya", sku: "SKU-7", quantity: 1, amount: 100, currency: "USD" };
    const first = await engine.startPurchaseWorkflow(request, "user_requester", "ORDER-1003", "same-key");
    const duplicate = await engine.startPurchaseWorkflow(request, "user_requester", "ORDER-1003", "same-key");
    expect(duplicate.id).toBe(first.id);
    expect((await store.listExecutions()).length).toBe(1);
  });

  it("requeues a manual compensation recovery with the same durable operation guardrail", async () => {
    const store = new MemoryStore();
    await store.init();
    await seedDemoUsers(store);
    const engine = new WorkflowEngine(store, { approvalTimeoutSeconds: 60, maxRetryAttempts: 1, retryBaseMs: 1 });
    const execution = await engine.startPurchaseWorkflow({ requester: "Priya", sku: "SKU-88", quantity: 1, amount: 300, currency: "USD" }, "user_requester", "ORDER-1004", "client-key-1004");
    await drain(engine, store);
    await store.setFault({ id: "fault_payment", participant: "payment", mode: "FAIL_ALWAYS", remaining: 99, updatedAt: new Date().toISOString() });
    const awaiting = await engine.getExecutionDetail(execution.id);
    await engine.decideApproval(awaiting!.approval!.id, "REJECT", "user_manager", "Validate manual recovery retry");
    await drain(engine, store);
    expect((await engine.getExecutionDetail(execution.id))?.execution.status).toBe("MANUAL_RECOVERY_REQUIRED");

    await store.setFault({ id: "fault_payment", participant: "payment", mode: "FAIL_ALWAYS", remaining: 0, updatedAt: new Date().toISOString() });
    await engine.retryManualRecovery(execution.id, "user_admin");
    await drain(engine, store);
    const recovered = await engine.getExecutionDetail(execution.id);
    expect(recovered?.execution.status).toBe("COMPENSATED");
    expect(recovered?.events.some(event => event.type === "MANUAL_RECOVERY_RETRY_REQUESTED")).toBe(true);
  });
});
