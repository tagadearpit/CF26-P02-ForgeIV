# CODEFORGE Submission Checklist

The evaluation framework rewards a focused, defensible prototype. Use this list before submission.

| Evaluation area | Evidence in this repository | Final team action |
|---|---|---|
| Problem understanding | `README.md` problem and constraints. | Explain why ordinary request-response systems do not handle human waiting safely. |
| Research depth | `docs/DEPLOYMENT.md` references and architecture rationale. | Be ready to explain Saga compensation and idempotency. |
| Architecture | `docs/ARCHITECTURE.md` and UI System Design page. | Explain Vercel, Render API, Worker, MongoDB roles. |
| Working prototype | Frontend, API, worker, mock participants. | Rehearse login, start, approval, rejection, and event history. |
| Experimental evidence | `docs/VALIDATION.md` and API smoke test. | Run the smoke test once before demo. |
| Resilience | Fault controls plus retry and compensation events. | Demo inventory fail-once and manager rejection. |
| Security / privacy | JWT, hashed passwords, role checks, env variables. | State demo credentials are not production credentials. |
| Technical defense | Architecture and limitations sections. | State why MongoDB-backed jobs were selected for prototype scope. |
| Real-world value | Purchase request workflow. | Explain how it generalizes to approvals, claims, onboarding, and incident handling. |

## Required manual edits before submitting

1. Replace the team-member placeholder in `README.md` with the actual names and roles.
2. Confirm that every team member understands the code they present.
3. Keep the AI-assistance disclosure in `README.md` accurate.
4. Do not commit live passwords, MongoDB URIs, JWT secrets, or private API keys.
5. Record the final Vercel and Render URLs in the submission form, not in source code.
