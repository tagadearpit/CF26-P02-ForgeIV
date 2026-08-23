import "dotenv/config";
import { createApp } from "./api.js";
import { config, createStore } from "./config.js";
import { WorkflowEngine } from "./engine.js";
import { seedDemoUsers } from "./seed.js";
import { startWorkerLoop } from "./worker-runner.js";

async function main() {
  const store = await createStore();
  await seedDemoUsers(store, config.configuredAdmin);
  const engine = new WorkflowEngine(store, { approvalTimeoutSeconds: config.approvalTimeoutSeconds, maxRetryAttempts: config.maxRetryAttempts, retryBaseMs: 1_000 });
  if (config.enableInProcessWorker) startWorkerLoop(engine, store, config.workerPollMs);
  const app = createApp(engine, store, { jwtSecret: config.jwtSecret, frontendUrl: config.frontendUrl });
  app.listen(config.port, () => console.log(`FlowGuard API listening on port ${config.port}`));
}

void main().catch(error => { console.error(error); process.exit(1); });
