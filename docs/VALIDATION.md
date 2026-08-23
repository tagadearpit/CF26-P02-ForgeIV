# Validation and Experiment Record

## Research question / technical claim

> Can a MongoDB-backed job ledger coordinate a business workflow through transient service failure and delayed human approval while avoiding duplicate workflow starts and preserving an auditable recovery path?

## Automated tests

The backend workflow engine has three focused unit tests in `backend/tests/engine.spec.ts`.

| Test | What it validates | Expected result |
|---|---|---|
| Approval completion | A request pauses for approval and continues after approval. | `COMPLETED` with a completion event. |
| Rejection compensation | A rejected request reverses earlier CRM, inventory, and payment-authorization actions. | `COMPENSATED`. |
| Start idempotency | The same client start key cannot create a second workflow. | Both requests return the same execution ID. |

## End-to-end smoke experiment

`backend/tests/api-smoke.mjs` drives the local API and worker together. It runs these scenarios:

| Scenario | Controlled condition | Evidence collected |
|---|---|---|
| Rejection compensation | Manager rejects after payment authorization. | Compensated workflow and compensated forward steps. |
| Successful completion | Manager approves. | `WORKFLOW_COMPLETED` event. |
| Duplicate start prevention | Same start idempotency key is submitted twice. | Same execution ID is returned. |
| Retry behavior | Inventory is configured to fail once. | `STEP_RETRY_SCHEDULED` event followed by progress to approval. |

## Local result

The smoke run completed successfully in this workspace on 23 August 2026:

```json
{
  "result": "PASS",
  "cases": [
    "rejection compensation",
    "approval completion",
    "start idempotency",
    "controlled retry"
  ]
}
```

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
