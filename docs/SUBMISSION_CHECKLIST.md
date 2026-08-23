# CODEFORGE Submission Checklist

The evaluation framework rewards a focused, defensible prototype. Use this list before submission.

| Evaluation area | Evidence in this repository | Final team action |
|---|---|---|
| Problem understanding | `README.md` problem and constraints. | Explain why ordinary request-response systems do not handle human waiting safely. |
| Research depth | `docs/RESEARCH_AND_DECISIONS.md` with source-backed decisions and experiment hypothesis. | Explain Saga compensation, durable approval, atomic job claim, and why MongoDB is used for prototype scope. |
| Architecture | `docs/ARCHITECTURE.md`, `docs/RESEARCH_AND_DECISIONS.md`, and UI System Design page. | Explain Vercel, Render API, Worker, MongoDB roles. |
| Working prototype | Frontend, API, worker, mock participants. | Rehearse login, start, approval, rejection, and event history. |
| Experimental evidence | `docs/VALIDATION.md`, API smoke test, and `docs/DEPLOYMENT_VERIFICATION.md`. | Run the smoke test once before demo; show the monitor if asked about live deployment checks. |
| Resilience | Fault controls plus retry, compensation, manual recovery, and audit events. | Demo inventory fail-once and manager rejection. |
| Security / privacy | `docs/SECURITY_AND_CORRECTNESS.md`; JWT, hashed passwords, roles, environment secrets, and audit trail. | State demo credentials are not production credentials. |
| Technical defense | `docs/TECHNICAL_DEFENSE.md`, architecture, and limitations sections. | State why MongoDB-backed jobs were selected for prototype scope. |
| Real-world value | Purchase request workflow. | Explain how it generalizes to approvals, claims, onboarding, and incident handling. |

## Required manual edits before submitting

1. Replace the team-member placeholder in `README.md` with the actual names, roles, and contributions.
2. Confirm that every team member understands the code they present.
3. Keep the AI-assistance disclosure in `README.md` accurate.
4. Do not commit live passwords, MongoDB URIs, JWT secrets, or private API keys.
5. Record the final Vercel and Render URLs in the submission form, not in source code.
6. Read `docs/COMPLIANCE_AUDIT.md` and confirm the remaining team-information requirement is complete.
