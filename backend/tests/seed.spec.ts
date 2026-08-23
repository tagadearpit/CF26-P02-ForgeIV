import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { seedDemoUsers } from "../src/seed.js";
import { MemoryStore } from "../src/store.js";

describe("configured administrator seed", () => {
  it("creates exactly the configured second administrator with a bcrypt-protected environment password", async () => {
    const store = new MemoryStore();
    await store.init();
    await seedDemoUsers(store, { email: "configured.admin@example.test", password: "ExampleAdmin!42", name: "Configured Admin" });

    const demoAdmin = await store.findUserByEmail("admin@flowguard.demo");
    const configuredAdmin = await store.findUserByEmail("configured.admin@example.test");
    expect(demoAdmin?.role).toBe("ADMIN");
    expect(configuredAdmin?.role).toBe("ADMIN");
    expect(configuredAdmin?.name).toBe("Configured Admin");
    expect(configuredAdmin?.passwordHash).not.toBe("ExampleAdmin!42");
    expect(await bcrypt.compare("ExampleAdmin!42", configuredAdmin?.passwordHash ?? "")).toBe(true);
  });

  it("rejects a partial configured administrator credential pair", async () => {
    const store = new MemoryStore();
    await store.init();
    await expect(seedDemoUsers(store, { email: "configured.admin@example.test" })).rejects.toThrow("must be configured together");
  });
});
