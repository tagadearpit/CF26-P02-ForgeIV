# Production Monitoring

The GitHub Actions workflow at `.github/workflows/uptime-monitor.yml` runs every 15 minutes and can also be run manually from the repository’s **Actions** tab.

It performs three deterministic checks:

| Check | Expected condition |
|---|---|
| Render API | `GET /health` returns `200` and `{ "status": "ok" }` |
| Vercel frontend | The configured production URL returns `2xx` and contains the `FlowGuard` page marker |
| CORS contract | `OPTIONS /api/auth/login` returns `Access-Control-Allow-Origin` equal to the Vercel production URL |

The workflow intentionally fails when CORS is misconfigured. Set Render API environment variable `FRONTEND_URL` to `https://flowguard-error-handlers.vercel.app`, redeploy the API, and run the workflow manually to confirm the CORS check turns green.

To run the same monitor locally, use:

```bash
node scripts/uptime-monitor.mjs
```

Override either URL without changing source code:

```bash
FLOWGUARD_API_URL=https://api.example.com FLOWGUARD_FRONTEND_URL=https://app.example.com node scripts/uptime-monitor.mjs
```
