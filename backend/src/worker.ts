import "dotenv/config";
import { config, createStore } from "./config.js";
import { WorkflowEngine } from "./engine.js";
import { seedDemoUsers } from "./seed.js";
import { startWorkerLoop } from "./worker-runner.js";

async function main() {
  const store = await createStore();
  await seedDemoUsers(store);
  const engine = new WorkflowEngine(store, { approvalTimeoutSeconds: config.approvalTimeoutSeconds, maxRetryAttempts: config.maxRetryAttempts, retryBaseMs: 1_000 });
  startWorkerLoop(engine, store, config.workerPollMs);
  console.log(`FlowGuard worker is polling every ${config.workerPollMs}ms`);
}

void main().catch(error => { console.error(error); process.exit(1); });
