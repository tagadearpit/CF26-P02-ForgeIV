# Validation and Experiment Record

## Research question / technical claim

> Can a MongoDB-backed job ledger coordinate a business workflow through transient service failure and delayed human approval while avoiding duplicate workflow starts and preserving an auditable recovery path?

## Automated tests

The backend has six focused unit tests: four workflow-engine tests in `backend/tests/engine.spec.ts` and two configured-administrator seed tests in `backend/tests/seed.spec.ts`.

| Test | What it validates | Expected result |
|---|---|---|
| Approval completion | A request pauses for approval and continues after approval. | `COMPLETED` with a completion event. |
| Rejection compensation | A rejected request reverses earlier CRM, inventory, and payment-authorization actions. | `COMPENSATED`. |
| Start idempotency | The same client start key cannot create a second workflow. | Both requests return the same execution ID. |
| Manual recovery retry | An exhausted compensation case can be requeued only from manual recovery. | The workflow continues from `MANUAL_RECOVERY_REQUIRED` to `COMPENSATED`. |
| Configured administrator seed | A paired environment-style email/password creates the one additional administrator. | The account is `ADMIN` and the password is bcrypt-hashed; partial credentials are rejected. |

## End-to-end smoke experiment

`backend/tests/api-smoke.mjs` drives the local API and worker together. It runs these scenarios:

| Scenario | Controlled condition | Evidence collected |
|---|---|---|
| Secure registration and login | A new person submits valid identity details and a confirmed strong password. | Account is created with requester-level access, then can sign in using the new credentials. |
| Profile update and avatar persistence | The new user changes their name, email, and a bounded PNG avatar through the protected profile endpoint. | Updated identity and avatar are returned from the API; duplicate-email protection still applies to the new address. |
| User-scoped profile activity history | The new requester starts a workflow, then loads their protected activity endpoint. | The timeline includes that requester’s `WORKFLOW_STARTED` event and does not query another account’s requests. |
| Requester data isolation | The requester asks for the workflow list and an unrelated execution detail. | Only their own execution is listed; an unrelated detail returns `403`. |
| Administrator cross-workflow visibility | An administrator requests the workflow list. | Both the administrator’s and the requester’s executions are visible. |
| Operational role visibility | The assigned approver and recovery operator request the workflow list. | Both roles retain read-only visibility across executions for approval, recovery, analytics, and judge-tour use. |
| Duplicate-email rejection | The same email is submitted for registration a second time. | API returns `409 Conflict`; the original account remains the sole identity for that email. |
| Rejection compensation | Manager rejects after payment authorization. | Compensated workflow and compensated forward steps. |
| Decided approval inbox clearing | An approver rejects and an administrator approves a waiting request, then each reloads the inbox. | The decided task is absent because `/api/approvals` returns only `OPEN` tasks. |
| Administrator approval completion | Administrator approves a waiting request from the approval path. | `WORKFLOW_COMPLETED` event. |
| Duplicate start prevention | Same start idempotency key is submitted twice. | Same execution ID is returned. |
| Retry behavior | Inventory is configured to fail once. | `STEP_RETRY_SCHEDULED` event followed by progress to approval. |
| Recovery authorization | Recovery cancellation is attempted with an operator token. | API returns `403`; only an administrator may mutate recovery. |
| Administrator audit | An administrator cancels a waiting workflow. | `WORKFLOW_CANCELLED` is persisted and returned by the administrator audit endpoint. |

## Local result

The smoke run completed successfully in this workspace on 23 August 2026. The backend-fix re-run returned `PASS` for all fourteen listed scenarios:

```json
{
  "result": "PASS",
  "cases": [
    "secure registration and login",
    "profile update and avatar persistence",
    "user-scoped profile activity history",
    "requester data isolation",
    "administrator cross-workflow visibility",
    "approver and operator read-only visibility",
    "duplicate-email rejection",
    "rejection compensation",
    "decided approval inbox clearing",
    "administrator approval completion",
    "start idempotency",
    "controlled retry",
    "administrator-only recovery mutation",
    "administrator action audit"
  ]
}
```

## Production connectivity verification

After deployment, the project also verified the live operational path:

| Check | Observed outcome |
|---|---|
| Render API health | `GET /health` returned `200` with `status: ok`. |
| Vercel frontend | The public FlowGuard production URL returned the application page. |
| CORS preflight | The API returned `Access-Control-Allow-Origin` matching the deployed Vercel origin. |
| Browser login | The demo administrator reached the FlowGuard control room. |

The reusable `scripts/uptime-monitor.mjs` repeats these API-health, frontend-availability, and CORS-contract checks. The GitHub Actions workflow runs it every 15 minutes. See [`docs/MONITORING.md`](MONITORING.md).

## How to repeat validation

```bash
cd backend
pnpm install
pnpm test
pnpm check

# Terminal 1: local API with an in-process worker for smoke testing
ENABLE_IN_PROCESS_WORKER=true PORT=8081 WORKER_POLL_MS=50 pnpm dev:api

# Terminal 2: full API smoke experiment
node tests/api-smoke.mjs
```

For a real MongoDB worker test, configure `MONGODB_URI` and run the API and worker as separate processes. The unit tests intentionally use the memory implementation to make the central state-machine behavior fast and deterministic.
