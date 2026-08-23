# Research and Technical Decisions

## Research question and technical claim

> **Research question:** Can a MongoDB-backed durable job ledger coordinate a human-approved purchase workflow through transient participant failures without duplicate starts, while leaving an auditable path for compensation and manual recovery?

> **Technical claim:** A persisted execution record, atomically claimed jobs, stable participant idempotency keys, and append-only events are sufficient for a prototype-scale orchestrated Saga to resume predictable work after temporary failure or a delayed human decision.

The prototype intentionally evaluates one narrow purchase-request workflow rather than a generic no-code workflow builder. This keeps the investigation focused on the difficult coordination mechanism: durable state, controlled retry, compensation, and human approval.

## Evidence that informed the design

| Design decision | Reasoning | Evidence source |
|---|---|---|
| Orchestrated Saga instead of two-phase commit | The workflow crosses independent services and includes a human wait. A central coordinator makes state, recovery order, and audit evidence visible. | The Saga pattern coordinates local transactions and uses compensating transactions when a later step fails.[1] |
| Explicit compensation instead of database rollback | A reservation, payment authorization, and CRM order are business actions in separate participants; they require business-specific undo operations. | The compensating-transaction pattern records forward progress and uses idempotent undo commands; it can require manual intervention when recovery fails.[2] |
| Atomic job claim in MongoDB | Two workers must not intentionally claim the same due job. The job lease is created through one compound update rather than separate read and write actions. | MongoDB documents `findOneAndUpdate` as an atomic compound operation.[3] |
| Durable approval task and timeout | Approval is modeled as persisted state with a deadline, not an open HTTP request. The worker later expires overdue tasks and begins compensation. | Durable human-in-the-loop workflows need persistent waits, time limits, and a complete decision trail.[4] |
| Predefined purchase flow and deterministic mock adapters | A 48-hour prototype should demonstrate the hardest mechanism with repeatable tests, not broaden into an untestable integration platform. | The event-provided CODEFORGE framework calls for a narrow, defensible slice and a meaningful validation experiment. |

## Alternative considered: ordinary request-response coordination

An ordinary API controller could call CRM, inventory, payment, and approval endpoints in one request. That approach is not appropriate here because a participant may fail after another has already succeeded, a browser connection can disappear, and a human approval can take longer than a web request. It also provides no durable record from which to retry or compensate. FlowGuard instead stores the current step and future work before the worker performs the next participant action.

## Prototype hypotheses and measurable checks

| Hypothesis | Controlled test | Observable outcome |
|---|---|---|
| Duplicate starts do not produce duplicate executions. | Submit the same start idempotency key twice. | Both responses contain the same execution identifier. |
| A transient participant fault can recover without manual intervention. | Configure inventory to fail once. | `STEP_RETRY_SCHEDULED` is persisted, then the workflow reaches the approval wait state. |
| A rejected human decision reverses previous compensable work. | Reject after CRM, inventory, and payment authorization succeed. | The execution reaches `COMPENSATED` and eligible forward steps are marked `COMPENSATED`. |
| Recovery mutations are not available to unprivileged operators. | Call cancellation with the operator token. | The API returns `403`; an administrator action creates a durable audit record. |

## Scope boundary

FlowGuard is a working prototype of a **single predefined purchase-request workflow**. The current implementation does not claim generic workflow definition publishing, real payment settlement, real CRM/invoice integrations, multi-stage approval voting, or automatic human resolution of ambiguous external outcomes. Those belong to future-scope plan, not the demonstrated core claim.

## References

[1]: [Microsoft Azure Architecture Center — Saga distributed transactions pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga)
[2]: [Microsoft Azure Architecture Center — Compensating Transaction pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/compensating-transaction)
[3]: [MongoDB Documentation — Compound operations](https://www.mongodb.com/docs/drivers/go/current/crud/compound-operations/)
[4]: [Temporal Documentation — Human-in-the-loop workflow pattern](https://docs.temporal.io/ai-cookbook/human-in-the-loop-python)
