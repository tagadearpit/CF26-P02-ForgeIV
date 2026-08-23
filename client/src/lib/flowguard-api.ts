export type Role = "ADMIN" | "APPROVER" | "OPERATOR" | "REQUESTER";
export type WorkflowStatus = "RUNNING" | "WAITING_FOR_APPROVAL" | "COMPENSATING" | "COMPLETED" | "COMPENSATED" | "MANUAL_RECOVERY_REQUIRED";
export type StepStatus = "PENDING" | "RUNNING" | "WAITING" | "SUCCEEDED" | "RETRYING" | "FAILED" | "COMPENSATING" | "COMPENSATED" | "MANUAL_REVIEW";

export interface AppUser { id: string; name: string; email: string; role: Role; }
export interface WorkflowExecution { id: string; businessKey: string; status: WorkflowStatus; currentStepKey: string; input: { requester: string; sku: string; quantity: number; amount: number; currency: string; reason?: string }; correlationId: string; updatedAt: string; startedAt: string; }
export interface StepExecution { id: string; stepKey: string; participant: string; status: StepStatus; attemptCount: number; output?: Record<string, unknown>; error?: string; idempotencyKey: string; updatedAt: string; position: number; }
export interface ApprovalTask { id: string; executionId: string; status: "OPEN" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED" | "EXPIRED"; dueAt: string; comment?: string; }
export interface WorkflowEvent { id: string; sequence: number; type: string; stepKey?: string; createdAt: string; payload?: Record<string, unknown>; }
export interface ExecutionDetail { execution: WorkflowExecution; steps: StepExecution[]; events: WorkflowEvent[]; approval?: ApprovalTask; }

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

export class ApiError extends Error {}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(body.error ?? "The service could not complete this request.");
  return body.data as T;
}

export const flowguardApi = {
  login: (email: string, password: string) => request<{ token: string; user: AppUser }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  dashboard: (token: string) => request<{ counts: Record<string, number>; recentExecutions: WorkflowExecution[]; openApprovals: ApprovalTask[] }>("/api/dashboard", {}, token),
  executions: (token: string) => request<WorkflowExecution[]>("/api/executions", {}, token),
  execution: (token: string, id: string) => request<ExecutionDetail>(`/api/executions/${id}`, {}, token),
  approvals: (token: string) => request<ApprovalTask[]>("/api/approvals", {}, token),
  start: (token: string, body: { businessKey: string; idempotencyKey: string; input: WorkflowExecution["input"] }) => request<WorkflowExecution>("/api/executions", { method: "POST", body: JSON.stringify(body) }, token),
  decide: (token: string, id: string, decision: "APPROVE" | "REJECT" | "REQUEST_CHANGES", comment?: string) => request<ApprovalTask>(`/api/approvals/${id}/decision`, { method: "POST", body: JSON.stringify({ decision, comment }) }, token),
  cancel: (token: string, id: string) => request<{ message: string }>(`/api/executions/${id}/cancel`, { method: "POST" }, token),
  setFault: (token: string, participant: "crm" | "inventory" | "payment" | "invoice" | "notification", mode: "FAIL_ONCE" | "FAIL_ALWAYS" | "DELAY" | "UNKNOWN_ONCE") => request<{ message: string }>("/api/demo/faults", { method: "POST", body: JSON.stringify({ participant, mode }) }, token),
};
