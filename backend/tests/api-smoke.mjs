const base = process.env.FLOWGUARD_API_URL ?? "http://localhost:8081";

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(path, options = {}, token) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...(options.headers ?? {}) },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${path}: ${body.error ?? response.statusText}`);
  return body.data;
}

async function login(email) {
  return request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password: "demo123" }) });
}

async function start(token, businessKey, idempotencyKey) {
  return request("/api/executions", {
    method: "POST",
    body: JSON.stringify({
      businessKey,
      idempotencyKey,
      input: { requester: "Priya Shah", sku: "SKU-42", quantity: 2, amount: 500, currency: "USD", reason: "Local smoke test" },
    }),
  }, token);
}

async function detail(token, id) {
  return request(`/api/executions/${id}`, {}, token);
}

async function waitForStatus(token, id, expected, limit = 30) {
  for (let index = 0; index < limit; index += 1) {
    const current = await detail(token, id);
    if (current.execution.status === expected) return current;
    await wait(150);
  }
  throw new Error(`Execution ${id} did not reach ${expected}`);
}

const suffix = Date.now();
const admin = await login("admin@flowguard.demo");
const manager = await login("manager@flowguard.demo");
const operator = await login("operator@flowguard.demo");

const registrationEmail = `new.requester.${suffix}@flowguard.demo`;
const registered = await request("/api/auth/register", { method: "POST", body: JSON.stringify({ firstName: "New", surname: "Requester", email: registrationEmail, password: "SecureFlow!42", confirmPassword: "SecureFlow!42" }) });
if (!registered.message.includes("Account created")) throw new Error("Registration did not return the expected sign-in instruction");
const registeredAuth = await request("/api/auth/login", { method: "POST", body: JSON.stringify({ email: registrationEmail, password: "SecureFlow!42" }) });
if (registeredAuth.user.role !== "REQUESTER" || registeredAuth.user.email !== registrationEmail) throw new Error("Registered user did not receive requester-level access");
const updatedProfile = await request("/api/me", { method: "PATCH", body: JSON.stringify({ name: "Updated Requester", email: `updated.${registrationEmail}`, avatarDataUrl: "data:image/png;base64,iVBORw0KGgo=" }) }, registeredAuth.token);
if (updatedProfile.name !== "Updated Requester" || updatedProfile.email !== `updated.${registrationEmail}` || !updatedProfile.avatarDataUrl) throw new Error("Profile update was not persisted");
const clearedAvatar = await request("/api/me", { method: "PATCH", body: JSON.stringify({ name: "Updated Requester", email: `updated.${registrationEmail}`, avatarDataUrl: "" }) }, registeredAuth.token);
if (clearedAvatar.avatarDataUrl) throw new Error("Profile avatar was not removed");
const requesterWorkflow = await start(registeredAuth.token, `SMOKE-PROFILE-ACTIVITY-${suffix}`, `smoke-profile-activity-${suffix}`);
const profileActivity = await request("/api/me/activity", {}, registeredAuth.token);
if (!profileActivity.some(entry => entry.executionId === requesterWorkflow.id && entry.eventType === "WORKFLOW_STARTED")) throw new Error("Profile activity did not include the requester’s workflow history");
const duplicateRegistration = await fetch(`${base}/api/auth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ firstName: "New", surname: "Requester", email: `updated.${registrationEmail}`, password: "SecureFlow!42", confirmPassword: "SecureFlow!42" }) });
if (duplicateRegistration.status !== 409) throw new Error("Duplicate registration was not rejected by the API");

const rejected = await start(admin.token, `SMOKE-REJECT-${suffix}`, `smoke-reject-${suffix}`);
const requesterExecutions = await request("/api/executions", {}, registeredAuth.token);
if (!requesterExecutions.some(execution => execution.id === requesterWorkflow.id) || requesterExecutions.some(execution => execution.id === rejected.id)) throw new Error("Requester workflow list was not isolated to the requester");
const deniedRequesterDetail = await fetch(`${base}/api/executions/${rejected.id}`, { headers: { authorization: `Bearer ${registeredAuth.token}` } });
if (deniedRequesterDetail.status !== 403) throw new Error("Requester could view an unrelated workflow detail");
const administratorExecutions = await request("/api/executions", {}, admin.token);
if (!administratorExecutions.some(execution => execution.id === requesterWorkflow.id) || !administratorExecutions.some(execution => execution.id === rejected.id)) throw new Error("Administrator did not retain cross-workflow visibility");
const approverExecutions = await request("/api/executions", {}, manager.token);
if (!approverExecutions.some(execution => execution.id === requesterWorkflow.id) || !approverExecutions.some(execution => execution.id === rejected.id)) throw new Error("Approver did not retain read-only cross-workflow visibility");
const operatorExecutions = await request("/api/executions", {}, operator.token);
if (!operatorExecutions.some(execution => execution.id === requesterWorkflow.id) || !operatorExecutions.some(execution => execution.id === rejected.id)) throw new Error("Operator did not retain read-only cross-workflow visibility");
let waiting = await waitForStatus(admin.token, rejected.id, "WAITING_FOR_APPROVAL");
await request(`/api/approvals/${waiting.approval.id}/decision`, { method: "POST", body: JSON.stringify({ decision: "REJECT", comment: "Validate compensation path" }) }, manager.token);
const managerInboxAfterDecision = await request("/api/approvals", {}, manager.token);
if (managerInboxAfterDecision.some(task => task.id === waiting.approval.id)) throw new Error("Decided approval remained in the approver inbox");
const compensated = await waitForStatus(admin.token, rejected.id, "COMPENSATED");
if (!compensated.steps.filter(step => ["create-order", "reserve-inventory", "authorize-payment"].includes(step.stepKey)).every(step => step.status === "COMPENSATED")) throw new Error("Compensation did not reverse every eligible completed step");

const successful = await start(admin.token, `SMOKE-APPROVE-${suffix}`, `smoke-approve-${suffix}`);
waiting = await waitForStatus(admin.token, successful.id, "WAITING_FOR_APPROVAL");
const deniedCancel = await fetch(`${base}/api/executions/${successful.id}/cancel`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${operator.token}` } });
if (deniedCancel.status !== 403) throw new Error("Operator recovery cancellation was not rejected by the API");
await request(`/api/approvals/${waiting.approval.id}/decision`, { method: "POST", body: JSON.stringify({ decision: "APPROVE", comment: "Validate administrator approval path" }) }, admin.token);
const adminInboxAfterDecision = await request("/api/approvals", {}, admin.token);
if (adminInboxAfterDecision.some(task => task.id === waiting.approval.id)) throw new Error("Decided approval remained in the administrator inbox");
const completed = await waitForStatus(admin.token, successful.id, "COMPLETED");
if (!completed.events.some(event => event.type === "WORKFLOW_COMPLETED")) throw new Error("Completion event was not written");

const cancelled = await start(admin.token, `SMOKE-CANCEL-${suffix}`, `smoke-cancel-${suffix}`);
await waitForStatus(admin.token, cancelled.id, "WAITING_FOR_APPROVAL");
await request(`/api/executions/${cancelled.id}/cancel`, { method: "POST" }, admin.token);
await waitForStatus(admin.token, cancelled.id, "COMPENSATED");
const audit = await request("/api/audit/admin-actions", {}, admin.token);
if (!audit.some(entry => entry.executionId === cancelled.id && entry.action === "WORKFLOW_CANCELLED" && entry.actor.email === "admin@flowguard.demo")) throw new Error("Administrator cancellation audit entry was not written");

const duplicate = await start(admin.token, `SMOKE-APPROVE-${suffix}`, `smoke-approve-${suffix}`);
if (duplicate.id !== successful.id) throw new Error("Start idempotency created a duplicate execution");

await request("/api/demo/faults", { method: "POST", body: JSON.stringify({ participant: "inventory", mode: "FAIL_ONCE" }) }, admin.token);
const retried = await start(admin.token, `SMOKE-RETRY-${suffix}`, `smoke-retry-${suffix}`);
await wait(1_300);
waiting = await waitForStatus(admin.token, retried.id, "WAITING_FOR_APPROVAL");
if (!waiting.events.some(event => event.type === "STEP_RETRY_SCHEDULED")) throw new Error("Retry event was not written");

console.log(JSON.stringify({
  result: "PASS",
  cases: ["secure registration and login", "profile update and avatar persistence", "user-scoped profile activity history", "requester data isolation", "administrator cross-workflow visibility", "approver and operator read-only visibility", "duplicate-email rejection", "rejection compensation", "decided approval inbox clearing", "administrator approval completion", "start idempotency", "controlled retry", "administrator-only recovery mutation", "administrator action audit"],
  compensatedExecution: rejected.id,
  completedExecution: successful.id,
  retriedExecution: retried.id,
}, null, 2));
