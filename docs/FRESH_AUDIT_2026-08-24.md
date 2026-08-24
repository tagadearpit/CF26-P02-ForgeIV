# FlowGuard Fresh Verification Audit — 24 August 2026

## Scope and Method

This audit exercises the repository from a clean validation path. It distinguishes direct local evidence from live-environment observations. It does not claim formal proof that every source line is defect-free.

## Final Audit Verdict

The current repository build is **locally validated for the audited critical flows**: static checks, production builds, unit coverage, the full API smoke suite, public entry routes, registration, role-scoped visibility, profile access, workflow progression, human approval, and completion. Two demonstrated source defects were repaired and revalidated. The deployed Render API and cross-origin contract are reachable, but the public Vercel domain is **not release-current** because Vercel blocked the public-product commit for an account/project-collaboration configuration reason. The separately configured Render worker is also not externally verifiable without dashboard access. These are explicit deployment follow-ups rather than unproven claims of application failure.

## Completed Local Static and API Validation

| Check | Result | Evidence |
| --- | --- | --- |
| Frontend type check | Pass | `pnpm check` completed with no TypeScript errors. |
| Frontend production build | Pass with follow-up | `pnpm vercel-build` completed. Vite reported a non-blocking main-chunk size warning (924.07 kB minified; 227.18 kB gzip). |
| Backend type check and build | Pass | `pnpm check` and `pnpm build` completed. |
| Backend unit tests | Pass | Vitest reported 2 files and 6 tests passing. |
| End-to-end API smoke | Pass | All 14 scenarios passed against a fresh in-memory local API with an in-process worker and `WORKER_POLL_MS=50`. |

> The first smoke attempt used the production-like default 1.5-second worker poll and exceeded the smoke suite's short polling window before the workflow reached approval. Re-running with the documented smoke configuration (`WORKER_POLL_MS=50`) passed all 14 scenarios. This is a test-environment timing condition, not a demonstrated workflow-engine failure.

## Local Browser Evidence

| Route | Result | Evidence |
| --- | --- | --- |
| `/` | Pass | The public product page rendered its FlowGuard explanation, benefits, use cases, three product visuals, and both entry actions. No cancelled legal/support footer links were present. |
| `/login` | Pass | The dedicated normal sign-in page rendered with blank email and password inputs, a password visibility control, registration entry, and a separate prepared-demo link. |
| `/login?demo=1` | Pass | The opt-in demo route displayed the demo-ready notice and prefilled the email and password inputs, while normal `/login` remained blank. |
| Demo sign-in → `/workspace` | Pass | The prepared demo sign-in completed and redirected to the protected control room, which rendered role-aware navigation, account controls, workflow search/filter controls, empty-state guidance, and health status. |
| Browser workflow creation | Pass | The authenticated launcher submitted an admin request, redirected to its execution detail, displayed the success feedback, and preserved a correlated event trail. |
| Browser human checkpoint | Pass | The local worker completed order, inventory, and payment authorization, then rendered `Waiting For Approval`, its persisted manager-approval step, due time, and approval-request event. |
| Browser approval decision | Pass | The administrator approval inbox exposed authorized Approve/Reject/Request Changes controls. An approval with an audit note returned a continuation confirmation and immediately cleared the open inbox. |
| Browser workflow completion | Pass | The approved execution subsequently reached `Completed`; all seven forward actions and the approval result were rendered with the immutable event history. |
| Browser registration form | Pass | The public registration route rendered inline validation, password-strength feedback, password visibility controls, and the expected secure-account messaging. |
| Registration → sign-in → requester workspace | Pass | The newly registered requester account signed in successfully after the routing repair and landed on `/workspace`. Its dashboard showed no administrator-created workflow, corroborating requester isolation in the browser. |
| Requester profile route | Pass | The protected profile settings page rendered the authenticated identity, bounded avatar guidance, editable profile controls, requester-only access explanation, and an empty user-scoped activity history. |
| Local browser diagnostics | Pass | The console contained only the React development-tools informational notice; no client-side errors or failed runtime integration messages were observed after the tested flows. |

## Production Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Render `/health` | Pass after cold-start allowance | Direct request returned HTTP 200 and the expected `{"status":"ok","service":"flowguard-api"}` payload in 2.68 seconds after the service was warm. |
| Production CORS preflight | Pass | `OPTIONS /api/auth/login` returned HTTP 204 with `Access-Control-Allow-Origin: https://flowguard-forgevi.vercel.app`. |
| Current Vercel frontend and API connection | Pass, but on older release | The currently served root authenticated the prepared demo user against the live Render API and rendered the control room with persisted execution data. |
| Intended public product route | Fail — deployment blocker, not source failure | The public root still renders the old prefilled login screen rather than the product page. Vercel records commit `3e64ab6fa147c2d0fec7b3da92b114e85410a5f3` (the public-product commit) as `BLOCKED`; the last ready production release predates it. The deployment detail points to Vercel project-collaboration account configuration and its build-error query returned no build error events. |
| Intended production `/login` route | Fail — deployment blocker, not source failure | The current deployed application returns its client-side 404 page at `/login`, as expected for the pre-product release. The local product release rendered `/login` correctly. |
| Live browser diagnostics | Pass | No browser console output, including no CORS-related or runtime error, was observed after successful production demo authentication. |
| Uptime monitor cold-start behavior | Follow-up | The standard monitor’s 20-second health timeout aborted on its first Render health request while the subsequent CORS preflight took 15.9 seconds. A direct warm health request then passed. This is a cold-start sensitivity in monitoring, not evidence of an API functional failure. |

> The Vercel release block is external account/project configuration, identified by Vercel as a project-collaboration configuration issue. It cannot be repaired by changing application source alone.

## Production Limitations and Repairs

| Item | Status | Notes |
| --- | --- | --- |
| Post-registration route repair | Repaired and revalidated locally | The authenticated `/login` route was missing and produced a 404 after registration from an existing session. The route now renders the sign-in component in both session states. |
| Uptime monitor cold-start resilience | Repaired and revalidated | The default monitor allowance was increased from 20 to 75 seconds while keeping `FLOWGUARD_MONITOR_TIMEOUT_MS` configurable. The revised monitor passed: Render health 200, Vercel frontend 200, and CORS preflight 204. |
| Actual Render background-worker service | Unverified | `render.yaml` declares a separate worker, but the available Render dashboard session requires sign-in and therefore could not be inspected. API health and CORS do not prove that a separately deployed worker service is active. |

## Confirmed Defect Repaired During Audit

| Defect | Repair | Revalidation |
| --- | --- | --- |
| A browser session that was already authenticated could visit `/register`, create a new account, and then be redirected to `/login`, which was absent from the authenticated route set and therefore displayed the 404 page. | Added the existing `Login` component to the authenticated route set. This lets a user intentionally switch accounts after registration while preserving the normal public `/login` route. | Browser retest at `/login` rendered the normal blank sign-in page. `pnpm check` and `pnpm vercel-build` both passed after the change. |

## Remaining External Follow-Ups

- Resolve the Vercel project-collaboration account configuration block, then redeploy the current `main` branch and recheck `/`, `/login`, `/login?demo=1`, and the product image requests on `https://flowguard-forgevi.vercel.app`.
- Sign in to the Render dashboard and confirm that the separately declared background worker is deployed, healthy, and configured with the same durable MongoDB environment contract as the API service.
- Consider further client-side code splitting for the non-blocking Vite bundle-size warning before a high-traffic release.
