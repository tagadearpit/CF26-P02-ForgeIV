# Production Verification Notes

## Current deployed endpoints

| Surface | URL | Observed status |
|---|---|---|
| Render API health | `https://flowguard-z4kk.onrender.com/health` | Returned `200` with `status: ok` before the latest configuration redeploy. |
| Vercel frontend | `https://flowguard-forgevi.vercel.app` | Publicly reachable after Vercel Authentication was disabled. |
| CORS preflight | `OPTIONS /api/auth/login` with the configured Vercel Origin | Returned an exact `Access-Control-Allow-Origin` match after the Render API redeploy. |

## Pending validation

The deployed demo login completed successfully on the Vercel frontend, confirming browser-to-API connectivity. Run `node scripts/uptime-monitor.mjs` to repeat the deterministic API-health, frontend-availability, and CORS-header checks.
