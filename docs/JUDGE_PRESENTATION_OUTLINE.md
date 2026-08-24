# FlowGuard — CodeForge 2026 Judge Presentation

## Cover

**FlowGuard**

**P-02 — Distributed Transaction Coordinator for Human Workflows**

ForgeVI

Aditya Devhare — Product Presenter & Team Leader
Arpit Tagade — Backend Developer
Rohan Kodane — Tester
Atharva Andhare — Frontend Developer

## Slide 1 — A purchase request can fail between systems

**The Problem**

An order crosses CRM, inventory, payment, invoice, notification, and a human manager—without one shared transaction boundary.

- A service may fail after another already succeeds.
- A human decision may take minutes, not one HTTP request.
- Retrying without durable state can duplicate a business action.

**Goal:** keep every action visible, recoverable, and safe to retry.

## Slide 2 — The coordinator must preserve five hard guarantees

**Problem Decomposition**

| Constraint | Required behavior |
| --- | --- |
| Independent participants | Persist state before the next action. |
| Uncertain retry | Reuse a stable idempotency key. |
| Human delay | Store an approval task, owner, and deadline. |
| Permanent failure | Compensate completed business actions in reverse order. |
| Multiple workers | Atomically lease one due job. |

> **Technical claim:** persisted execution state, atomic job claims, idempotency keys, and append-only events make a delayed human-approved workflow recoverable.

## Slide 3 — Research favors orchestration with compensation

**Research & Prior Art**

- **Saga pattern:** sequence local transactions with compensating actions when a later action fails.[1]
- **Compensating transactions:** undo commands must be idempotent and can need human recovery.[2]
- **Atomic work claim:** MongoDB compound updates safely claim one due job.[3]
- **Durable human task:** approval must persist owner, deadline, and decision—not hold a browser request open.[4]

**Our gap:** FlowGuard makes retry, human wait, rejection, and recovery visible in one judgeable prototype.

## Slide 4 — FlowGuard is a persisted seven-step Saga

**Proposed Approach**

```text
Create CRM order → Reserve inventory → Authorize payment → Manager approval
                                                        ↓
                    Capture payment → Create invoice → Send notification

Reject / permanent failure → compensate completed actions in reverse order
```

- Every forward action writes execution, step, job, idempotency, and event records.
- The worker resumes only the next safe action.
- A decision is durable: approve continues; reject compensates.

## Slide 5 — Durable state separates the UI from the work

**System Architecture**

```text
React operations console (Vercel)
              │ HTTPS + JWT
Express API + lease-safe worker (Render)
              │
MongoDB Atlas: executions • jobs • approvals • events • users
              │
CRM / Inventory / Payment / Invoice / Notification adapters
```

**Role boundaries:** Requester submits own work; Operator observes; Manager decides; Administrator handles authorized recovery and audit.

## Slide 6 — A durable human decision makes recovery demonstrable

**Innovation & Impact**

- Approval is persisted workflow state with an owner, deadline, decision, and consequences.
- **6** focused engine/seed tests validate approval, compensation, idempotency, recovery, and secure admin seeding.
- **14** end-to-end API smoke scenarios validate registration, isolation, retry, approval, compensation, authorization, and audit evidence.
- A live worker repair verified a fresh workflow reached an **OPEN** approval task with a five-minute decision window.

**Impact:** procurement, fulfilment, claims, and operations can retain human judgment without losing business-process continuity.

## Slide 7 — Evidence, scope, and defense

**References & Technical Defense**

1. Microsoft Azure Architecture Center — *Saga distributed transactions pattern*.[1]
2. Microsoft Azure Architecture Center — *Compensating Transaction pattern*.[2]
3. MongoDB Documentation — *Compound operations*.[3]
4. Temporal Documentation — *Human-in-the-loop workflow pattern*.[4]
5. CODEFORGE 2026 — *Participant Evaluation Framework* (provided brief).

**Prototype boundary:** one predefined purchase workflow with deterministic adapters; no real settlement, generic workflow builder, or multi-stage voting claim.

**AI-assistance disclosure:** AI assisted design exploration, code scaffolding, debugging, documentation, and test generation. ForgeVI remains responsible for correctness, evidence, and technical defense.

## References

[1]: https://learn.microsoft.com/en-us/azure/architecture/patterns/saga
[2]: https://learn.microsoft.com/en-us/azure/architecture/patterns/compensating-transaction
[3]: https://www.mongodb.com/docs/drivers/go/current/crud/compound-operations/
[4]: https://docs.temporal.io/ai-cookbook/human-in-the-loop-python
