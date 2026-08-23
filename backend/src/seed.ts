import bcrypt from "bcryptjs";
import type { WorkflowStore } from "./store.js";
import type { User } from "./types.js";

const DEMO_PASSWORD = "demo123";

export type ConfiguredAdmin = { email?: string; password?: string; name?: string };

export async function seedDemoUsers(store: WorkflowStore, configuredAdmin: ConfiguredAdmin = {}) {
  const configuredEmail = configuredAdmin.email?.trim().toLowerCase();
  const configuredPassword = configuredAdmin.password;
  if (Boolean(configuredEmail) !== Boolean(configuredPassword)) {
    throw new Error("FLOWGUARD_ADMIN_EMAIL and FLOWGUARD_ADMIN_PASSWORD must be configured together.");
  }
  if (configuredEmail === "admin@flowguard.demo") {
    throw new Error("FLOWGUARD_ADMIN_EMAIL must be different from the built-in demo administrator.");
  }
  if (configuredPassword && configuredPassword.length < 10) {
    throw new Error("FLOWGUARD_ADMIN_PASSWORD must contain at least 10 characters.");
  }
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users: User[] = [
    { id: "user_admin", name: "Arpit Tagade", email: "admin@flowguard.demo", passwordHash, role: "ADMIN", department: "Platform Operations", active: true, createdAt: new Date().toISOString() },
    { id: "user_manager", name: "Asha Manager", email: "manager@flowguard.demo", passwordHash, role: "APPROVER", department: "Finance", active: true, createdAt: new Date().toISOString() },
    { id: "user_operator", name: "Omar Recovery", email: "operator@flowguard.demo", passwordHash, role: "OPERATOR", department: "Operations", active: true, createdAt: new Date().toISOString() },
    { id: "user_requester", name: "Priya Shah", email: "requester@flowguard.demo", passwordHash, role: "REQUESTER", department: "Procurement", active: true, createdAt: new Date().toISOString() },
  ];
  if (configuredEmail && configuredPassword) {
    users.push({
      id: "user_configured_admin",
      name: configuredAdmin.name?.trim() || "Configured Administrator",
      email: configuredEmail,
      passwordHash: await bcrypt.hash(configuredPassword, 12),
      role: "ADMIN",
      department: "Configured Administration",
      active: true,
      createdAt: new Date().toISOString(),
    });
  }
  await store.seedUsers(users);
}

export const demoCredentials = [
  { role: "Administrator", email: "admin@flowguard.demo", password: DEMO_PASSWORD },
  { role: "Approver", email: "manager@flowguard.demo", password: DEMO_PASSWORD },
  { role: "Operator", email: "operator@flowguard.demo", password: DEMO_PASSWORD },
  { role: "Requester", email: "requester@flowguard.demo", password: DEMO_PASSWORD },
];
