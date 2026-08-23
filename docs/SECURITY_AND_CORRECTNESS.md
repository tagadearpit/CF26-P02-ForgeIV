# Security, Privacy, and Correctness

## Security boundary

FlowGuard separates the browser, API, worker, and database. The frontend never receives the MongoDB connection string or JWT signing secret. Those values are stored as deployment environment variables, while the API exposes only authenticated commands and evidence endpoints.

| Control | Prototype implementation | Why it matters |
|---|---|---|
| Authentication | JWT returned by `/api/auth/login`; demo password is checked with bcrypt. | Prevents unauthenticated API access. |
| Authorization | API middleware checks roles for requester, approver, and administrator operations. | Prevents a normal operator from triggering recovery mutations. |
| Recovery control | Only `ADMIN` can cancel a workflow, begin compensation, or request manual recovery retry. | Reduces the risk of destructive recovery actions. |
| CORS | The API accepts the configured `FRONTEND_URL` and local development origins. | Restricts browser cross-origin calls to the known frontend. |
| Secret handling | `MONGODB_URI` and `JWT_SECRET` are excluded from source and configured in Render. | Avoids committing production credentials. |
| Auditability | Recovery cancellation and manual retry append events and appear in the administrator audit table. | Makes privileged actions attributable and reviewable. |

## Correctness controls

| Risk | FlowGuard control | Demonstrated evidence |
|---|---|---|
| Duplicate workflow start | Stable `startIdempotencyKey` maps repeated client requests to one execution. | API smoke test submits the same key twice and expects one execution ID. |
| Duplicate participant side effect | Each forward and compensation action has a stable idempotency key. | Participant operation records return prior results for repeat keys. |
| Two workers take one job | A worker claim stores lease information through an atomic MongoDB compound update. | Job-store implementation and worker lease model. |
| Worker stops mid-job | Expired leases become reclaimable. | Durable job state records `claimedBy` and `leaseUntil`. |
| Transient failure | Bounded retries use a future `availableAt` value. | Fail-once inventory experiment records `STEP_RETRY_SCHEDULED`. |
| Permanent failure or rejection | Ordered compensation is scheduled and every result becomes an event. | Rejection-compensation smoke test reaches `COMPENSATED`. |
| Failed compensation | Terminal state becomes `MANUAL_RECOVERY_REQUIRED`; an administrator may requeue the recovery action. | Engine test and administrator-only retry route. |

## Privacy and demonstration safeguards

The repository contains only fictional purchase data and intentionally seeded demo users. The published `admin@flowguard.demo` credentials are **hackathon demo credentials only**. Before a real deployment, remove public demo credentials, use managed identity or SSO, rotate all secrets, restrict database network access, introduce rate limiting, and implement a retention policy for audit events.

## Known prototype limits

This prototype does not claim compliance certification, production payment handling, encryption-key management, intrusion detection, or a full privacy program. Its security contribution is a defensible baseline for a hackathon proof: hashed demo passwords, role-enforced endpoints, environment-only secrets, CORS restriction, and a durable audit trail.
