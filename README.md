# FlowGuard

> **A durable coordinator for human-in-the-loop business workflows.**

FlowGuard coordinates a purchase request across independent systems—CRM, inventory, payment, invoice, notification—and pauses safely for manager approval. It records every state transition, retries temporary failure with stable idempotency keys, and compensates completed actions when the workflow is rejected or cannot safely continue.

![FlowGuard operations illustration](https://files.manuscdn.com/user_upload_by_module/session_file/310519663889343004/movpUEJGouzKEKjU.png)

## Problem statement and solution overview

Modern workflows cross systems that do not share one database or respond at the same speed. A normal request-response application can lose progress when a participant fails, a network response is uncertain, a manager takes minutes to approve, or a duplicate request arrives.

FlowGuard provides an **orchestrated Saga** for a focused purchase-request scenario:

```text
Create CRM order → Reserve inventory → Authorize payment → Manager approval
                                                         ↓
                                Capture payment → Create invoice → Notify
```

When a request is rejected, times out, or hits a permanent failure, FlowGuard executes compensation in reverse business order. The prototype uses deterministic mock participant adapters so these behaviors can be demonstrated reliably in a hackathon setting.

## Core technical mechanism

The central claim tested by this prototype is:

> A persisted MongoDB job ledger, atomic worker lease, and participant idempotency record can make a multi-step business workflow recoverable after expected partial failures and human delays.

FlowGuard uses MongoDB for workflow executions, individual step state, approval tasks, pending jobs, idempotency records, and append-only events. A Render Background Worker claims jobs, executes the next participant action, schedules retries, finds approval timeouts, and starts compensation when needed.

The operations console now also includes a **Reliability Analytics** view calculated directly from execution records, a high-signal **Recovery Center** that exposes the last safe state and current operator action, and an interactive **Judge Tour** that guides a reviewer through a retry, human decision, compensation, and outcome-evidence storyline.

| Requirement | FlowGuard mechanism |
|---|---|
| Durable execution | MongoDB documents for executions, steps, jobs, and events. |
| Idempotent operations | Stable per-operation keys stored in `participantOperations`. |
| Human checkpoint | Persistent `approvalTasks` with a user, status, deadline, and decision. |
| Retry | Delayed retry through `availableAt` and bounded attempt count. |
| Worker crash recovery | Short job lease that a later worker can reclaim. |
| Compensation / Saga | Reverse-order business actions after rejection or permanent failure. |
| Auditability | Append-only event history rendered in the execution UI. |

## System architecture / workflow

```text
Vercel React UI
      │ HTTPS
Render API (authentication, commands, evidence)
      │
MongoDB Atlas (state, jobs, approvals, events, users)
      ↑
Render Background Worker (processing, retries, timeout scan, compensation)
```

The detailed architecture is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Technology stack

| Layer | Choice |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| API and worker | Node.js, TypeScript, Express |
| Database | MongoDB Atlas / official Node.js driver |
| Validation | Vitest, TypeScript checks, local API smoke test |
| Hosting | Vercel for frontend; Render for API and worker |

## Setup and installation

### Prerequisites

- Node.js 22+
- pnpm 10+
- MongoDB Atlas connection string for a multi-process local run, or the in-memory test mode for fast validation

### Frontend

```bash
pnpm install
pnpm dev
```

Create an environment variable in your shell or deployment platform:

```text
VITE_API_BASE_URL=http://localhost:8080
```

### Backend

```bash
cd backend
pnpm install
```

Configure process variables in your terminal, local secret manager, or deployment platform. Do not commit them to Git:

| Variable | Required | Purpose |
|---|---:|---|
| `MONGODB_URI` | Production | MongoDB Atlas connection URI. |
| `MONGODB_DATABASE` | No | Defaults to `flowguard`. |
| `JWT_SECRET` | Production | JWT signing secret. |
| `FRONTEND_URL` | Production | Exact Vercel frontend origin for CORS. |
| `APPROVAL_TIMEOUT_SECONDS` | No | Defaults to `60`. |
| `WORKER_POLL_MS` | No | Defaults to `1500`. |
| `MAX_RETRY_ATTEMPTS` | No | Defaults to `3`. |

Run the API and worker separately for a real MongoDB local environment:

```bash
# Terminal A
cd backend && pnpm dev:api

# Terminal B
cd backend && pnpm dev:worker
```

For a fast local smoke run without MongoDB, start the API with its in-process worker:

```bash
cd backend
ENABLE_IN_PROCESS_WORKER=true PORT=8081 WORKER_POLL_MS=50 pnpm dev:api
```

## Usage instructions

1. Open the frontend and sign in using `admin@flowguard.demo` / `demo123`.
2. Choose **Start workflow** and submit a purchase request.
3. Open the execution detail to see the workflow pulse and event history.
4. Sign in as `manager@flowguard.demo` / `demo123` to approve or reject the request.
5. Use **Inventory fails once** in the launcher to demonstrate retry.
6. Reject a request to demonstrate compensation and inspect the recovery evidence.
7. Open **Reliability analytics** to compare completed, compensated, and manual-exception outcomes.
8. Open **Judge tour** to rehearse the six-minute evaluation walkthrough with the exact evidence to call out at every screen.

## Validation / experiments / results

The project includes a unit test suite and an end-to-end local API smoke experiment. The validated scenarios are approval completion, rejection compensation, duplicate-start prevention, and a controlled participant retry.

```bash
cd backend
pnpm test
pnpm check

# After starting the local API at port 8081
node tests/api-smoke.mjs
```

The smoke run in this workspace passed all four scenarios. See [`docs/VALIDATION.md`](docs/VALIDATION.md) for the experiment design and exact result.

## Deployment

Use the included `vercel.json` and `render.yaml`, then follow the exact environment-variable and platform build settings in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Limitations and future scope

This is a prototype-scale proof of the difficult coordination mechanism. It deliberately uses mock CRM, inventory, payment, invoice, and notification adapters. A production system would need real connector reconciliation, secrets rotation, rate limiting, database backups, monitoring, alerting, distributed tracing, stronger network restrictions, and a dedicated high-throughput queue if workload volume increases.

## Team members

Replace this section before submission with the real team information.

| Name | Role | Contribution |
|---|---|---|
| _Add team member_ | _Add role_ | _Add contribution_ |

## AI assistance disclosure

AI-assisted development was used for architecture exploration, UI design iteration, code scaffolding, documentation drafting, and test generation. The team remains responsible for verifying correctness, understanding architecture decisions, testing behavior, and accurately presenting the prototype.

## Hackathon readiness

Before submission, complete [`docs/SUBMISSION_CHECKLIST.md`](docs/SUBMISSION_CHECKLIST.md). It maps the implementation and evidence to the CODEFORGE evaluation framework.
