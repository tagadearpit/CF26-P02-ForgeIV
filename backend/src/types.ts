export type Role = "ADMIN" | "APPROVER" | "OPERATOR" | "REQUESTER";
export type WorkflowStatus =
  | "RUNNING"
  | "WAITING_FOR_APPROVAL"
  | "COMPENSATING"
  | "COMPLETED"
  | "COMPENSATED"
  | "MANUAL_RECOVERY_REQUIRED";
export type StepStatus =
  | "PENDING"
  | "RUNNING"
  | "WAITING"
  | "SUCCEEDED"
  | "RETRYING"
  | "FAILED"
  | "COMPENSATING"
  | "COMPENSATED"
  | "MANUAL_REVIEW";
export type JobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "DEAD_LETTER";
export type JobType = "FORWARD" | "COMPENSATION";
export type Decision = "APPROVE" | "REJECT" | "REQUEST_CHANGES";
export type ServiceName = "crm" | "inventory" | "payment" | "invoice" | "notification";
export type FaultMode = "FAIL_ONCE" | "FAIL_ALWAYS" | "DELAY" | "UNKNOWN_ONCE";

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  department: string;
  active: boolean;
  createdAt: string;
}

export interface PurchaseInput {
  requester: string;
  sku: string;
  quantity: number;
  amount: number;
  currency: string;
  reason?: string;
}

export interface WorkflowExecution {
  id: string;
  workflowKey: "purchase-request";
  businessKey: string;
  startIdempotencyKey: string;
  status: WorkflowStatus;
  currentStepKey: string;
  input: PurchaseInput;
  requestedBy: string;
  correlationId: string;
  version: number;
  startedAt: string;
  updatedAt: string;
}

export interface StepExecution {
  id: string;
  executionId: string;
  stepKey: string;
  position: number;
  participant: ServiceName | "human";
  status: StepStatus;
  attemptCount: number;
  output?: Record<string, unknown>;
  error?: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalTask {
  id: string;
  executionId: string;
  stepKey: "manager-approval";
  assignedTo: string;
  status: "OPEN" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED" | "EXPIRED";
  dueAt: string;
  decision?: Decision;
  comment?: string;
  decidedBy?: string;
  decidedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  type: JobType;
  executionId: string;
  stepKey: string;
  status: JobStatus;
  attemptCount: number;
  maxAttempts: number;
  availableAt: string;
  priority: number;
  idempotencyKey: string;
  claimedBy?: string;
  leaseUntil?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowEvent {
  id: string;
  executionId: string;
  sequence: number;
  type: string;
  stepKey?: string;
  actorId?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

export interface ParticipantOperation {
  id: string;
  participant: ServiceName;
  idempotencyKey: string;
  result: Record<string, unknown>;
  createdAt: string;
}

export interface FaultRule {
  id: string;
  participant: ServiceName;
  mode: FaultMode;
  remaining: number;
  delayMs?: number;
  updatedAt: string;
}

export interface ExecutionDetail {
  execution: WorkflowExecution;
  steps: StepExecution[];
  events: WorkflowEvent[];
  approval?: ApprovalTask;
}

export const FORWARD_STEPS = [
  { key: "create-order", participant: "crm", action: "create", compensation: "cancel" },
  { key: "reserve-inventory", participant: "inventory", action: "reserve", compensation: "release" },
  { key: "authorize-payment", participant: "payment", action: "authorize", compensation: "void" },
  { key: "manager-approval", participant: "human", action: "approve", compensation: null },
  { key: "capture-payment", participant: "payment", action: "capture", compensation: "refund" },
  { key: "create-invoice", participant: "invoice", action: "create", compensation: "void" },
  { key: "send-notification", participant: "notification", action: "send", compensation: null }
] as const;

export type StepKey = (typeof FORWARD_STEPS)[number]["key"];
