import { MongoStore } from "./mongo-store.js";
import { MemoryStore, type WorkflowStore } from "./store.js";

export const config = {
  port: Number(process.env.PORT ?? 8080),
  mongoUri: process.env.MONGODB_URI,
  mongoDatabase: process.env.MONGODB_DATABASE ?? "flowguard",
  jwtSecret: process.env.JWT_SECRET ?? "flowguard-local-development-secret",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
  approvalTimeoutSeconds: Number(process.env.APPROVAL_TIMEOUT_SECONDS ?? 60),
  workerPollMs: Number(process.env.WORKER_POLL_MS ?? 1500),
  maxRetryAttempts: Number(process.env.MAX_RETRY_ATTEMPTS ?? 3),
  enableInProcessWorker: process.env.ENABLE_IN_PROCESS_WORKER === "true",
  configuredAdmin: {
    email: process.env.FLOWGUARD_ADMIN_EMAIL?.trim().toLowerCase(),
    password: process.env.FLOWGUARD_ADMIN_PASSWORD,
    name: process.env.FLOWGUARD_ADMIN_NAME?.trim() || "Configured Administrator",
  },
};

export async function createStore(): Promise<WorkflowStore> {
  const store = config.mongoUri ? new MongoStore(config.mongoUri, config.mongoDatabase) : new MemoryStore();
  await store.init();
  return store;
}
