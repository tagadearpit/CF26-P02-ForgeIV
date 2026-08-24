# Deploying FlowGuard

This guide deploys the exact architecture implemented in this repository:

```text
Vercel (React/Vite frontend)
        ↓ HTTPS
Render Web Service (Node.js API)
        ↓
MongoDB Atlas (durable state, jobs, users, events)
        ↑
Render Background Worker (jobs, retries, timeouts, compensation)
```

## 1. MongoDB Atlas

Create a project and a database deployment in [MongoDB Atlas](https://www.mongodb.com/atlas/database). Create a database user with access only to the `flowguard` database. Do not use the Atlas account owner credential in the app.

From **Database → Connect → Drivers**, copy the Node.js connection string and replace `<db_password>` with the database user password. It should look like:

```text
mongodb+srv://flowguard_app:<password>@cluster-name.mongodb.net/flowguard?retryWrites=true&w=majority
```

For a hackathon demo, configure **Network Access** so Render can reach the database. If you temporarily allow `0.0.0.0/0`, use a strong database password and remove that broad rule after the event. For a production system, restrict network access to known outbound addresses or use private networking.

## 2. Render: API and worker

Create a Render account and connect this GitHub repository. You can use the included `render.yaml` Blueprint or create the services manually.

The API starts a lease-safe in-process worker by default. This prevents an API-only deployment from leaving new workflows stuck at `create order`. Keep the separate background worker for resilience and throughput; both workers can safely coexist because they atomically lease each queued job before processing it.

### API service settings

| Setting | Value |
|---|---|
| Service type | **Web Service** |
| Name | `flowguard-api` |
| Root directory | `backend` |
| Runtime | Node |
| Build command | `pnpm install --frozen-lockfile && pnpm build` |
| Start command | `pnpm start:api` |
| Health check path | `/health` |
| Branch | `main` |
| Node version | `22` |

### Worker service settings

| Setting | Value |
|---|---|
| Service type | **Background Worker** |
| Name | `flowguard-worker` |
| Root directory | `backend` |
| Runtime | Node |
| Build command | `pnpm install --frozen-lockfile && pnpm build` |
| Start command | `pnpm start:worker` |
| Branch | `main` |
| Node version | `22` |

Render background workers continuously process asynchronous work without receiving public incoming traffic, which matches FlowGuard’s worker responsibility.[^render-worker]

### Render environment variables

Add the following variables to **both** the API and worker services unless explicitly noted.

| Variable | API | Worker | Example / note |
|---|---:|---:|---|
| `MONGODB_URI` | Yes | Yes | Atlas connection string. Secret. |
| `MONGODB_DATABASE` | Yes | Yes | `flowguard` |
| `JWT_SECRET` | Yes | Yes | One long random secret; use **the exact same value** in both services. |
| `APPROVAL_TIMEOUT_SECONDS` | Yes | Yes | `300` for a five-minute human approval window. |
| `WORKER_POLL_MS` | Yes | Yes | `1500` |
| `ENABLE_IN_PROCESS_WORKER` | Yes | No | Set `true`. The API defaults to `true`; set it to `false` only after a separate worker has been verified. |
| `MAX_RETRY_ATTEMPTS` | Yes | Yes | `3` |
| `FRONTEND_URL` | Yes | No | Your deployed Vercel URL, e.g. `https://flowguard.vercel.app` |
| `FLOWGUARD_ADMIN_EMAIL` | Yes | No | Optional second administrator email. Configure with `FLOWGUARD_ADMIN_PASSWORD`. Secret-adjacent identity. |
| `FLOWGUARD_ADMIN_PASSWORD` | Yes | No | Optional second administrator password. **Secret**; never commit it or add it to Vercel. |
| `FLOWGUARD_ADMIN_NAME` | Yes | No | Optional display name for the second administrator. |
| `NODE_VERSION` | Yes | Yes | `22` |
| `PORT` | No | No | Render supplies this automatically to the API. |

After the API deploys, open `https://<your-api>.onrender.com/health`. You should see JSON with `status: "ok"`.

To provision exactly one additional administrator beside the built-in `admin@flowguard.demo` account, set both `FLOWGUARD_ADMIN_EMAIL` and `FLOWGUARD_ADMIN_PASSWORD` in the **Render API** service. Optionally set `FLOWGUARD_ADMIN_NAME`. Do not set either credential value in source code, `.env` files that are committed, Vercel, or the worker service. The API refuses a partial email/password pair and hashes the configured password before MongoDB storage.

## 3. Vercel: React frontend

Import the same GitHub repository into Vercel. Use these project settings:

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Root directory | Leave blank; use the repository root |
| Install command | `pnpm install --frozen-lockfile` |
| Build command | `pnpm vercel-build` |
| Output directory | `dist/public` |
| Node.js version | `22.x` |

Add this Vercel environment variable for **Production**, **Preview**, and optionally **Development**:

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://<your-api>.onrender.com` |

The `VITE_` prefix is required because Vite exposes only prefixed variables to browser code.[^vercel-vite]

Deploy the frontend. Then copy the production domain and set it as `FRONTEND_URL` in the Render **API** service. Redeploy the Render API so CORS allows only the final frontend domain.

The included `vercel.json` rewrites unknown routes to `index.html`; this is required for direct visits to an SPA route such as `/executions/<id>`.[^vercel-vite]

## 4. First deployed demo

1. Open the Vercel URL.
2. Sign in using `admin@flowguard.demo` and password `demo123`.
3. Start a workflow from **Start workflow**.
4. Sign out and sign in as `manager@flowguard.demo` to make the approval decision.
5. Verify the execution page shows all forward steps and immutable events.
6. Start another workflow with **Inventory fails once** selected. Verify `STEP_RETRY_SCHEDULED` appears in the event history.
7. Reject a third workflow and verify `COMPENSATED` state and reverse-order actions.

## Important deployment note

The seeded credentials are for hackathon demonstration only. Before any real deployment, remove public demo credentials, use a proper user-provisioning process, rotate `JWT_SECRET`, and enable stronger network restrictions.

[^render-worker]: [Render — Background Workers](https://render.com/docs/background-workers)
[^vercel-vite]: [Vercel — Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
