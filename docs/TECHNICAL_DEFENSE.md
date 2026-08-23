# Technical Defense Guide

Use this concise guide to explain the system under judging questions. Every answer points to a visible mechanism or reproducible evidence.

| Likely question | Defensible answer | Evidence to show |
|---|---|---|
| Why not use a normal transaction? | CRM, inventory, payment, invoice, and a human approval are independent participants. A short database transaction cannot safely hold them all open. FlowGuard uses an orchestrated Saga with business compensations. | System Design page; `docs/RESEARCH_AND_DECISIONS.md`. |
| Why MongoDB instead of Redis? | MongoDB is the team’s familiar durable source of truth. For the prototype, one database holds jobs, leases, idempotency records, and audit events, which reduces infrastructure while preserving the central reliability mechanism. | Architecture document; job collection and worker code. |
| How do you avoid duplicate effects? | The start request has an idempotency key, and each participant action has a stable operation key. A repeat returns the saved participant result rather than repeating the business action. | Execution detail; smoke test duplicate-start scenario. |
| What happens if a worker dies? | The worker writes a short lease. A later worker can reclaim a job only after that lease expires, and the participant idempotency record makes the retry safe. | Job lease explanation; failure-model section. |
| How does human approval survive refreshes or downtime? | Approval is a MongoDB task with an owner, status, and deadline; the execution enters a durable waiting state. The worker scans expired tasks and begins compensation. | Approval inbox and event history. |
| What if compensation fails? | The worker retries compensation. When retries exhaust, FlowGuard moves to `MANUAL_RECOVERY_REQUIRED`; only an administrator may request manual recovery retry, and the action is audited. | Recovery Center and administrator audit table. |
| What did you actually validate? | Controlled tests cover approval completion, rejection compensation, duplicate starts, transient retry, role-denied recovery mutation, and administrator audit recording. Production health, CORS, and login were also checked. | `docs/VALIDATION.md`; `docs/DEPLOYMENT_VERIFICATION.md`. |

## One-minute demonstration narrative

Start a purchase request. Show the execution timeline writing durable events as CRM, inventory, and payment authorization complete. Open the approval inbox and explain that the workflow is waiting in MongoDB, not holding a browser request open. Trigger the inventory fail-once scenario to show retry evidence. Reject another request and open the Recovery Center to show ordered compensation. Finally, show the administrator audit table and Reliability Analytics to connect engineering behavior to operational oversight.
