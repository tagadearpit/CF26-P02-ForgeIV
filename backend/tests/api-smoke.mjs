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
const duplicateRegistration = await fetch(`${base}/api/auth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ firstName: "New", surname: "Requester", email: registrationEmail, password: "SecureFlow!42", confirmPassword: "SecureFlow!42" }) });
if (duplicateRegistration.status !== 409) throw new Error("Duplicate registration was not rejected by the API");

const rejected = await start(admin.token, `SMOKE-REJECT-${suffix}`, `smoke-reject-${suffix}`);
let waiting = await waitForStatus(admin.token, rejected.id, "WAITING_FOR_APPROVAL");
await request(`/api/approvals/${waiting.approval.id}/decision`, { method: "POST", body: JSON.stringify({ decision: "REJECT", comment: "Validate compensation path" }) }, manager.token);
const compensated = await waitForStatus(admin.token, rejected.id, "COMPENSATED");
if (!compensated.steps.filter(step => ["create-order", "reserve-inventory", "authorize-payment"].includes(step.stepKey)).every(step => step.status === "COMPENSATED")) throw new Error("Compensation did not reverse every eligible completed step");

const successful = await start(admin.token, `SMOKE-APPROVE-${suffix}`, `smoke-approve-${suffix}`);
waiting = await waitForStatus(admin.token, successful.id, "WAITING_FOR_APPROVAL");
const deniedCancel = await fetch(`${base}/api/executions/${successful.id}/cancel`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${operator.token}` } });
if (deniedCancel.status !== 403) throw new Error("Operator recovery cancellation was not rejected by the API");
await request(`/api/approvals/${waiting.approval.id}/decision`, { method: "POST", body: JSON.stringify({ decision: "APPROVE", comment: "Validate successful path" }) }, manager.token);
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
  cases: ["secure registration and login", "duplicate-email rejection", "rejection compensation", "approval completion", "start idempotency", "controlled retry", "administrator-only recovery mutation", "administrator action audit"],
  compensatedExecution: rejected.id,
  completedExecution: successful.id,
  retriedExecution: retried.id,
}, null, 2));
