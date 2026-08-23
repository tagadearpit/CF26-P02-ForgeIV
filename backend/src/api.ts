import bcrypt from "bcryptjs";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { WorkflowEngine } from "./engine.js";
import { newId, type WorkflowStore } from "./store.js";
import type { FaultMode, Role, ServiceName, User } from "./types.js";

type AuthUser = { id: string; role: Role; email: string; name: string; avatarDataUrl?: string };
type AuthedRequest = Request & { auth?: AuthUser };

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const registerSchema = z.object({
  firstName: z.string().trim().min(2, "First name must have at least 2 characters.").max(60),
  surname: z.string().trim().min(2, "Surname must have at least 2 characters.").max(60),
  email: z.string().trim().email().max(254),
  password: z.string().min(10, "Password must contain at least 10 characters.").max(128)
    .regex(/[a-z]/, "Password must include a lowercase letter.")
    .regex(/[A-Z]/, "Password must include an uppercase letter.")
    .regex(/[0-9]/, "Password must include a number.")
    .regex(/[^A-Za-z0-9]/, "Password must include a symbol."),
  confirmPassword: z.string(),
}).refine(value => value.password === value.confirmPassword, { message: "Passwords do not match.", path: ["confirmPassword"] });
const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must have at least 2 characters.").max(120),
  email: z.string().trim().email().max(254),
  avatarDataUrl: z.string().max(350_000, "Avatar image is too large.").regex(/^data:image\/(png|jpeg|webp);base64,/, "Avatar must be a PNG, JPEG, or WebP image.").optional().or(z.literal("")),
});
const startSchema = z.object({
  businessKey: z.string().min(3).max(100),
  idempotencyKey: z.string().min(5).max(200),
  input: z.object({
    requester: z.string().min(2),
    sku: z.string().min(2),
    quantity: z.number().int().positive(),
    amount: z.number().positive(),
    currency: z.string().length(3).default("USD"),
    reason: z.string().max(400).optional(),
  }),
});
const decisionSchema = z.object({ decision: z.enum(["APPROVE", "REJECT", "REQUEST_CHANGES"]), comment: z.string().max(500).optional() });
const faultSchema = z.object({ participant: z.enum(["crm", "inventory", "payment", "invoice", "notification"]), mode: z.enum(["FAIL_ONCE", "FAIL_ALWAYS", "DELAY", "UNKNOWN_ONCE"]), delayMs: z.number().int().min(100).max(15_000).optional() });

function publicUser(user: AuthUser | User) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, avatarDataUrl: user.avatarDataUrl };
}

function isDuplicateEmailError(error: unknown) {
  return error instanceof Error && error.message === "EMAIL_ALREADY_EXISTS" || (typeof error === "object" && error !== null && "code" in error && error.code === 11000);
}

export function createApp(engine: WorkflowEngine, store: WorkflowStore, options: { jwtSecret: string; frontendUrl: string }) {
  const app = express();
  app.use(cors({ origin: [options.frontendUrl, "http://localhost:3000", "http://localhost:5173"], credentials: false }));
  app.use(express.json({ limit: "1mb" }));

  const authenticate = async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Authentication is required." });
    try {
      const decoded = jwt.verify(token, options.jwtSecret) as { sub: string; role: Role; email: string; name: string; avatarDataUrl?: string };
      req.auth = { id: decoded.sub, role: decoded.role, email: decoded.email, name: decoded.name };
      next();
    } catch {
      return res.status(401).json({ error: "Your session has expired. Please sign in again." });
    }
  };

  const authorize = (...roles: Role[]) => (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) return res.status(403).json({ error: "You do not have permission for this action." });
    next();
  };

  app.get("/health", (_req, res) => res.json({ status: "ok", service: "flowguard-api", timestamp: new Date().toISOString() }));

  app.post("/api/auth/login", async (req, res, next) => {
    try {
      const input = loginSchema.parse(req.body);
      const user = await store.findUserByEmail(input.email);
      if (!user || !user.active || !(await bcrypt.compare(input.password, user.passwordHash))) {
        return res.status(401).json({ error: "Email or password is incorrect." });
      }
      const auth: AuthUser = { id: user.id, role: user.role, email: user.email, name: user.name, avatarDataUrl: user.avatarDataUrl };
      const token = jwt.sign({ sub: auth.id, role: auth.role, email: auth.email, name: auth.name }, options.jwtSecret, { expiresIn: "8h" });
      return res.json({ data: { token, user: { ...publicUser(auth), avatarDataUrl: user.avatarDataUrl } } });
    } catch (error) { next(error); }
  });

  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const input = registerSchema.parse(req.body);
      const email = input.email.toLowerCase();
      const passwordHash = await bcrypt.hash(input.password, 12);
      await store.createUser({
        id: newId("user"),
        name: `${input.firstName} ${input.surname}`,
        email,
        passwordHash,
        role: "REQUESTER",
        department: "Self-registered",
        active: true,
        createdAt: new Date().toISOString(),
      });
      return res.status(201).json({ data: { message: "Account created. Please sign in with your email and password." } });
    } catch (error) {
      if (isDuplicateEmailError(error)) return res.status(409).json({ error: "An account with this email already exists. Please sign in instead." });
      next(error);
    }
  });

  app.get("/api/me", authenticate, (req: AuthedRequest, res) => res.json({ data: publicUser(req.auth!) }));

  app.patch("/api/me", authenticate, async (req: AuthedRequest, res, next) => {
    try {
      const input = profileSchema.parse(req.body);
      const updated = await store.updateUser(req.auth!.id, { name: input.name, email: input.email, avatarDataUrl: input.avatarDataUrl || undefined });
      if (!updated) return res.status(404).json({ error: "Your account could not be found." });
      return res.json({ data: { ...publicUser(updated), avatarDataUrl: updated.avatarDataUrl } });
    } catch (error) {
      if (isDuplicateEmailError(error)) return res.status(409).json({ error: "An account with this email already exists." });
      next(error);
    }
  });

  app.get("/api/dashboard", authenticate, async (_req, res, next) => {
    try {
      const [executions, approvals] = await Promise.all([store.listExecutions(), store.listApprovals()]);
      const counts = executions.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.status]: (acc[item.status] ?? 0) + 1 }), {});
      res.json({ data: { counts, recentExecutions: executions.slice(0, 8), openApprovals: approvals.filter(item => item.status === "OPEN") } });
    } catch (error) { next(error); }
  });

  app.get("/api/executions", authenticate, async (_req, res, next) => {
    try { res.json({ data: await store.listExecutions() }); } catch (error) { next(error); }
  });

  app.post("/api/executions", authenticate, authorize("ADMIN", "REQUESTER"), async (req: AuthedRequest, res, next) => {
    try {
      const input = startSchema.parse(req.body);
      const execution = await engine.startPurchaseWorkflow(input.input, req.auth!.id, input.businessKey, input.idempotencyKey);
      res.status(201).json({ data: execution });
    } catch (error) { next(error); }
  });

  app.get("/api/executions/:id", authenticate, async (req, res, next) => {
    try {
      const executionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!executionId) return res.status(400).json({ error: "Workflow execution ID is required." });
      const detail = await engine.getExecutionDetail(executionId);
      if (!detail) return res.status(404).json({ error: "Workflow execution was not found." });
      return res.json({ data: detail });
    } catch (error) { next(error); }
  });

  app.get("/api/approvals", authenticate, authorize("APPROVER", "ADMIN"), async (req: AuthedRequest, res, next) => {
    try {
      const tasks = await store.listApprovals(req.auth!.role === "ADMIN" ? undefined : req.auth!.id);
      res.json({ data: tasks });
    } catch (error) { next(error); }
  });

  app.post("/api/approvals/:id/decision", authenticate, authorize("APPROVER", "ADMIN"), async (req: AuthedRequest, res, next) => {
    try {
      const input = decisionSchema.parse(req.body);
      const approvalId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!approvalId) return res.status(400).json({ error: "Approval ID is required." });
      const task = await store.getApproval(approvalId);
      if (!task) return res.status(404).json({ error: "Approval task was not found." });
      if (req.auth!.role !== "ADMIN" && task.assignedTo !== req.auth!.id) return res.status(403).json({ error: "This approval is assigned to another user." });
      const result = await engine.decideApproval(task.id, input.decision, req.auth!.id, input.comment);
      return res.json({ data: result });
    } catch (error) { next(error); }
  });

  app.post("/api/executions/:id/cancel", authenticate, authorize("ADMIN"), async (req: AuthedRequest, res, next) => {
    try {
      const executionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!executionId) return res.status(400).json({ error: "Workflow execution ID is required." });
      await engine.cancelExecution(executionId, req.auth!.id);
      res.status(202).json({ data: { message: "Compensation has started." } });
    } catch (error) { next(error); }
  });

  app.post("/api/executions/:id/retry", authenticate, authorize("ADMIN"), async (req: AuthedRequest, res, next) => {
    try {
      const executionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!executionId) return res.status(400).json({ error: "Workflow execution ID is required." });
      await engine.retryManualRecovery(executionId, req.auth!.id);
      res.status(202).json({ data: { message: "Manual recovery retry has been queued." } });
    } catch (error) { next(error); }
  });

  app.get("/api/audit/admin-actions", authenticate, authorize("ADMIN"), async (_req, res, next) => {
    try {
      const executions = await store.listExecutions();
      const collected = (await Promise.all(executions.map(async execution => {
        const events = await store.listEvents(execution.id);
        return events
          .filter(event => ["WORKFLOW_CANCELLED", "MANUAL_RECOVERY_RETRY_REQUESTED"].includes(event.type) && Boolean(event.actorId))
          .map(event => ({ execution, event }));
      }))).flat();
      const actions = await Promise.all(collected.map(async ({ execution, event }) => {
        const actor = event.actorId ? await store.getUser(event.actorId) : undefined;
        return {
          id: event.id,
          executionId: execution.id,
          businessKey: execution.businessKey,
          action: event.type,
          stepKey: event.stepKey,
          createdAt: event.createdAt,
          payload: event.payload,
          actor: actor ? { id: actor.id, name: actor.name, email: actor.email, role: actor.role } : { id: event.actorId, name: "Unknown administrator", email: "—", role: "ADMIN" },
        };
      }));
      res.json({ data: actions.sort((left, right) => right.createdAt.localeCompare(left.createdAt)) });
    } catch (error) { next(error); }
  });

  app.post("/api/demo/faults", authenticate, authorize("ADMIN"), async (req, res, next) => {
    try {
      const input = faultSchema.parse(req.body);
      await store.setFault({ id: `fault_${input.participant}`, participant: input.participant as ServiceName, mode: input.mode as FaultMode, remaining: input.mode === "FAIL_ALWAYS" ? 99 : 1, delayMs: input.delayMs, updatedAt: new Date().toISOString() });
      res.json({ data: { message: `${input.participant} is configured for ${input.mode}.` } });
    } catch (error) { next(error); }
  });

  app.get("/api/participants/health", authenticate, (_req, res) => {
    res.json({ data: ["crm", "inventory", "payment", "invoice", "notification"].map(participant => ({ participant, status: "healthy" })) });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues[0]?.message ?? "Invalid request." });
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    res.status(400).json({ error: message });
  });
  return app;
}
