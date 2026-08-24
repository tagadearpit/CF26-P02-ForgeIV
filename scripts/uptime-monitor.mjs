/** FlowGuard production monitor: verifies API health, Vercel availability, and the browser CORS contract. */
const apiBaseUrl = (process.env.FLOWGUARD_API_URL ?? "https://flowguard-z4kk.onrender.com").replace(/\/$/, "");
const frontendUrl = (process.env.FLOWGUARD_FRONTEND_URL ?? "https://flowguard-forgevi.vercel.app").replace(/\/$/, "");
const timeoutMs = Number(process.env.FLOWGUARD_MONITOR_TIMEOUT_MS ?? 75_000);

async function request(label, url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, redirect: "follow" });
    const durationMs = Date.now() - startedAt;
    return { label, url, response, durationMs };
  } finally {
    clearTimeout(timeout);
  }
}

const failures = [];
const outcomes = [];

async function verify(label, task) {
  try {
    const result = await task();
    outcomes.push({ label, status: result.response.status, durationMs: result.durationMs, detail: result.detail ?? "ok" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outcomes.push({ label, status: "FAIL", durationMs: 0, detail: message });
    failures.push(`${label}: ${message}`);
  }
}

await verify("Render API health", async () => {
  const result = await request("Render API health", `${apiBaseUrl}/health`);
  if (!result.response.ok) throw new Error(`expected 2xx, received ${result.response.status}`);
  const body = await result.response.json();
  if (body.status !== "ok") throw new Error(`unexpected health payload: ${JSON.stringify(body)}`);
  return { ...result, detail: `${body.service} is healthy` };
});

await verify("Vercel frontend", async () => {
  const result = await request("Vercel frontend", frontendUrl);
  if (!result.response.ok) throw new Error(`expected 2xx, received ${result.response.status}`);
  const body = await result.response.text();
  if (!body.includes("FlowGuard")) throw new Error("page did not contain the FlowGuard application marker");
  return { ...result, detail: "FlowGuard page marker present" };
});

await verify("CORS preflight", async () => {
  const result = await request("CORS preflight", `${apiBaseUrl}/api/auth/login`, {
    method: "OPTIONS",
    headers: {
      Origin: frontendUrl,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  if (!result.response.ok) throw new Error(`expected successful preflight, received ${result.response.status}`);
  const allowedOrigin = result.response.headers.get("access-control-allow-origin");
  if (allowedOrigin !== frontendUrl) throw new Error(`expected access-control-allow-origin '${frontendUrl}', received '${allowedOrigin ?? "missing"}'`);
  return { ...result, detail: `origin allowed: ${allowedOrigin}` };
});

console.table(outcomes);
if (failures.length) {
  console.error("\nFlowGuard uptime monitor failed:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log("\nFlowGuard uptime monitor passed.");
