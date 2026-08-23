import { nanoid } from "nanoid";
import type { WorkflowStore } from "./store.js";
import type { ServiceName } from "./types.js";

export class RetryableParticipantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryableParticipantError";
  }
}

const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));

const externalPrefix: Record<ServiceName, string> = {
  crm: "ORD",
  inventory: "RES",
  payment: "PAY",
  invoice: "INV",
  notification: "MSG",
};

export async function performParticipantAction(
  store: WorkflowStore,
  participant: ServiceName,
  action: string,
  idempotencyKey: string,
  businessKey: string,
) {
  const existing = await store.getOperation(participant, idempotencyKey);
  if (existing) return existing.result;

  const fault = await store.consumeFault(participant);
  if (fault?.mode === "DELAY") await sleep(fault.delayMs ?? 1_500);
  if (fault?.mode === "FAIL_ONCE" || fault?.mode === "FAIL_ALWAYS") {
    throw new RetryableParticipantError(`${participant} simulated a temporary ${action} failure`);
  }

  const result = {
    externalId: `${externalPrefix[participant]}-${nanoid(7).toUpperCase()}`,
    participant,
    action,
    businessKey,
    acceptedAt: new Date().toISOString(),
  };
  await store.saveOperation({
    id: `operation_${nanoid(10)}`,
    participant,
    idempotencyKey,
    result,
    createdAt: new Date().toISOString(),
  });

  if (fault?.mode === "UNKNOWN_ONCE") {
    throw new RetryableParticipantError(`${participant} completed the action but the response was lost; retry will reconcile by idempotency key`);
  }
  return result;
}
