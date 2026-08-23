# FlowGuard Enhancement Checklist

- [x] Review existing recovery, execution, and dashboard data contracts.
- [x] Define clearer failed-job states, recovery actions, and loading feedback.
- [x] Add analytics calculations and an outcome-focused dashboard view.
- [x] Build the interactive judge tour for retry and compensation scenarios.
- [x] Validate frontend types, production build, and core workflow behavior.
- [x] Save the project checkpoint and push the enhancement commit to GitHub.

## Time Filter and Recovery Authorization Update

- [x] Confirm analytics derives time windows from durable execution timestamps.
- [x] Add 24-hour and 7-day outcome filters to Reliability Analytics.
- [x] Enforce administrator-only recovery mutations in the API and Recovery Center.
- [ ] Validate role restrictions, filtered metrics, tests, builds, and GitHub push.

## Administrator Action Audit Update

- [x] Identify recovery and manual-retry events that carry administrator actor IDs.
- [x] Add an administrator audit table with workflow, action, actor, timestamp, and event metadata.
- [x] Validate event aggregation, empty states, type checks, build, and GitHub push.

## Deployment Settings Guide

- [x] Verify the exact environment variables used by the API, worker, and frontend.
- [x] Prepare MongoDB Atlas, Render API/worker, and Vercel build settings.
- [x] Provide the deployment sequence and cross-platform verification checklist.

## Vercel Deployment Preparation

- [ ] Verify the connected Vercel workspace and locate the target FlowGuard project.
- [ ] Configure `VITE_API_BASE_URL` for the Render API in the proper environment.
- [ ] Verify Vercel build settings and report readiness for the user-controlled release step.

## Render MongoDB Authentication Fix

- [ ] Correct the Atlas database-user credentials and URL encoding in `MONGODB_URI`.
- [ ] Verify Atlas network access and Render environment-variable update steps.
- [ ] Redeploy the Render service and validate the `/health` response.

## Deployment Health and Monitoring

- [x] Check Render API health, Vercel availability, and deployed CORS behavior.
- [x] Inspect the available browser diagnostics for cross-origin errors.
- [x] Add a reusable uptime-monitoring script and validate it against both deployments.

## Production Connectivity and GitHub Monitor

- [x] Re-check the deployed CORS response and real browser login flow.
- [x] Add a GitHub Actions monitor for API health, frontend availability, and CORS headers.
- [x] Set Render `FRONTEND_URL` to the actual Vercel production URL, then re-run the monitor successfully.

## Hackathon Submission Compliance Audit

- [x] Review the theme, evaluation framework, submitted blueprint, README, and existing project evidence.
- [x] Map each required README outcome to a clear section and verifiable repository artifact.
- [x] Add or correct missing technical, validation, limitation, and AI-disclosure documentation.
- [x] Re-run frontend and backend validation, including the end-to-end resilience smoke experiment.
- [ ] Add real team-member information, then commit the compliance fixes and publish the final audit result.
