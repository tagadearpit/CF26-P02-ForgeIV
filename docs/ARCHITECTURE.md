# FlowGuard Architecture

## Workflow model

```text
Create CRM order → Reserve inventory → Authorize payment → Wait for approval
                                                        ↓
                                    Capture payment → Create invoice → Notify
```

If the approver rejects, times out, or a forward step permanently fails, the coordinator starts compensation in reverse business order:

```text
Void / refund payment → Release inventory → Cancel CRM order
```

## Core technical mechanism

FlowGuard treats MongoDB as the durable source of truth. The following collections make the workflow recoverable:

| Collection | Purpose |
|---|---|
| `workflowExecutions` | Overall workflow state and business input. |
| `stepExecutions` | Current state, attempt count, output, and idempotency key for each step. |
| `jobs` | Pending, running, retried, or dead-letter worker commands. |
| `approvalTasks` | Human decision, owner, deadline, comment, and status. |
| `participantOperations` | Participant idempotency key and original result. |
| `workflowEvents` | Append-only timeline for audit and UI evidence. |
| `participantFaults` | Deterministic demo fault configuration. |

### Job lease and worker recovery

The worker atomically claims a due job and writes `RUNNING`, `claimedBy`, and `leaseUntil`. If the worker stops, a later worker can reclaim the job after its lease expires. Participant-level idempotency means the retried call returns the original result instead of repeating a side effect.

### Why this is a Saga

This is not a distributed database transaction or two-phase commit. Each participant performs its own local action. The coordinator records each result and later runs a defined compensation action if the overall business outcome must be cancelled. Some effects, such as a sent notification, are intentionally recorded as irreversible.

## Technology stack

| Layer | Technology |
|---|---|
| UI | React, TypeScript, Vite, Tailwind CSS, Wouter, Lucide |
| API / worker | Node.js, TypeScript, Express, Zod |
| Durable store | MongoDB Atlas with official Node.js driver |
| Deployment | Vercel frontend, Render web service and background worker |
| Validation | Vitest, TypeScript compiler, local API smoke test |
