# Live Worker and Approval-Path Repair — 2026-08-24

## Confirmed production root cause

Render application logs showed the in-process worker was running but repeatedly failed in `MongoStore.upsertStep` with MongoDB error code `66`: updating a persisted step attempted to include the immutable MongoDB `_id` field in `$set`. The worker therefore could not advance queued records beyond the first automated step.

## Repairs applied

| Repair | Result |
| --- | --- |
| Exclude MongoDB `_id` before a step document is upserted | Prevents immutable-ID failures when a persisted step is written again. |
| Enable the API worker fallback | Lets the API process durable jobs even when a separate worker service is unavailable. |
| Set `APPROVAL_TIMEOUT_SECONDS` to `300` | Gives administrators a five-minute decision window instead of the unsuitable 60-second demo window. |

## Live verification evidence

Render deployed commit `cdda88f` for the MongoDB repair and commit `5345af9` for the five-minute approval configuration. A fresh live verification workflow, `exec_q5GKtMRFCO`, advanced to `WAITING_FOR_APPROVAL` at `manager-approval`. Its approval task was `OPEN` with approximately 288 seconds remaining at verification, demonstrating that the Approval Inbox can receive an actionable human decision before expiry.

The workflow is intentionally left open so an administrator can review it in the Approval Inbox and choose **Approve**, **Reject & recover**, or **Request changes**.
