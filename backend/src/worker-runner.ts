import { nanoid } from "nanoid";
import { WorkflowEngine } from "./engine.js";
import type { WorkflowStore } from "./store.js";

export async function processOneCycle(engine: WorkflowEngine, store: WorkflowStore, workerId = `worker_${nanoid(6)}`) {
  const current = new Date().toISOString();
  const [job, expiredApprovals] = await Promise.all([
    store.claimNextJob(workerId, current),
    engine.expireApprovals(),
  ]);
  if (job) await engine.processJob(job);
  return { processedJob: Boolean(job), expiredApprovals };
}

export function startWorkerLoop(engine: WorkflowEngine, store: WorkflowStore, pollMs: number) {
  const workerId = `worker_${nanoid(6)}`;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await processOneCycle(engine, store, workerId);
    } catch (error) {
      console.error("Worker cycle failed", error);
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), pollMs);
  return () => clearInterval(timer);
}
