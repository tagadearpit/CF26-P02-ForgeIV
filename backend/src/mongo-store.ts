import { MongoClient, type Collection, type Db } from "mongodb";
import type { ApprovalTask, Decision, FaultRule, Job, ParticipantOperation, StepExecution, User, WorkflowEvent, WorkflowExecution } from "./types.js";
import type { WorkflowStore } from "./store.js";

const cloneDocument = <T>(value: T | null): T | undefined => (value ? JSON.parse(JSON.stringify(value)) as T : undefined);
const now = () => new Date().toISOString();

export class MongoStore implements WorkflowStore {
  private client: MongoClient;
  private db!: Db;
  private users!: Collection<User>;
  private executions!: Collection<WorkflowExecution>;
  private steps!: Collection<StepExecution>;
  private events!: Collection<WorkflowEvent>;
  private approvals!: Collection<ApprovalTask>;
  private jobs!: Collection<Job>;
  private operations!: Collection<ParticipantOperation>;
  private faults!: Collection<FaultRule>;

  constructor(uri: string, private databaseName = "flowguard") {
    this.client = new MongoClient(uri);
  }

  async init() {
    await this.client.connect();
    this.db = this.client.db(this.databaseName);
    this.users = this.db.collection<User>("users");
    this.executions = this.db.collection<WorkflowExecution>("workflowExecutions");
    this.steps = this.db.collection<StepExecution>("stepExecutions");
    this.events = this.db.collection<WorkflowEvent>("workflowEvents");
    this.approvals = this.db.collection<ApprovalTask>("approvalTasks");
    this.jobs = this.db.collection<Job>("jobs");
    this.operations = this.db.collection<ParticipantOperation>("participantOperations");
    this.faults = this.db.collection<FaultRule>("participantFaults");
    await Promise.all([
      this.users.createIndex({ email: 1 }, { unique: true }),
      this.executions.createIndex({ startIdempotencyKey: 1 }, { unique: true }),
      this.executions.createIndex({ status: 1, updatedAt: -1 }),
      this.steps.createIndex({ executionId: 1, stepKey: 1 }, { unique: true }),
      this.events.createIndex({ executionId: 1, sequence: 1 }, { unique: true }),
      this.approvals.createIndex({ assignedTo: 1, status: 1, dueAt: 1 }),
      this.jobs.createIndex({ status: 1, availableAt: 1, priority: -1 }),
      this.operations.createIndex({ participant: 1, idempotencyKey: 1 }, { unique: true }),
      this.faults.createIndex({ participant: 1 }, { unique: true }),
    ]);
  }

  async seedUsers(users: User[]) {
    await Promise.all(users.map(user => this.users.updateOne(
      { email: user.email.toLowerCase() },
      {
        $set: { name: user.name, role: user.role, department: user.department, active: user.active },
        $setOnInsert: { id: user.id, email: user.email.toLowerCase(), passwordHash: user.passwordHash, createdAt: user.createdAt },
      },
      { upsert: true },
    )));
  }
  async findUserByEmail(email: string) { return cloneDocument(await this.users.findOne({ email: email.toLowerCase() })); }
  async getUser(id: string) { return cloneDocument(await this.users.findOne({ id })); }
  async createUser(user: User) { await this.users.insertOne({ ...user, email: user.email.toLowerCase() }); }
  async updateUser(id: string, patch: Pick<User, "name" | "email" | "avatarDataUrl">) {
    const { avatarDataUrl, ...identity } = patch;
    const result = await this.users.findOneAndUpdate(
      { id },
      avatarDataUrl
        ? { $set: { ...identity, email: patch.email.toLowerCase(), avatarDataUrl } }
        : { $set: { ...identity, email: patch.email.toLowerCase() }, $unset: { avatarDataUrl: "" } },
      { returnDocument: "after" },
    );
    return cloneDocument(result as unknown as User | null);
  }
  async createExecution(execution: WorkflowExecution) { await this.executions.insertOne(execution); }
  async getExecution(id: string) { return cloneDocument(await this.executions.findOne({ id })); }
  async findExecutionByStartKey(key: string) { return cloneDocument(await this.executions.findOne({ startIdempotencyKey: key })); }
  async listExecutions() { return (await this.executions.find({}).sort({ updatedAt: -1 }).toArray()).map(item => cloneDocument(item)!); }
  async updateExecution(id: string, patch: Partial<WorkflowExecution>) {
    const result = await this.executions.findOneAndUpdate({ id }, { $set: { ...patch, updatedAt: now() }, $inc: { version: 1 } }, { returnDocument: "after" });
    return cloneDocument(result as unknown as WorkflowExecution | null);
  }
  async upsertStep(step: StepExecution) {
    // MongoDB returns its internal `_id` on reads; it must never be included in a later `$set`.
    const { _id: _mongoId, ...persistedStep } = step as StepExecution & { _id?: unknown };
    await this.steps.updateOne({ executionId: step.executionId, stepKey: step.stepKey }, { $set: persistedStep }, { upsert: true });
  }
  async getStep(executionId: string, stepKey: string) { return cloneDocument(await this.steps.findOne({ executionId, stepKey })); }
  async listSteps(executionId: string) { return (await this.steps.find({ executionId }).sort({ position: 1 }).toArray()).map(item => cloneDocument(item)!); }
  async insertEvent(event: WorkflowEvent) { await this.events.insertOne(event); }
  async listEvents(executionId: string) { return (await this.events.find({ executionId }).sort({ sequence: 1 }).toArray()).map(item => cloneDocument(item)!); }
  async createApproval(task: ApprovalTask) { await this.approvals.insertOne(task); }
  async getApproval(id: string) { return cloneDocument(await this.approvals.findOne({ id })); }
  async listApprovals(assignee?: string) { return (await this.approvals.find(assignee ? { assignedTo: assignee } : {}).sort({ dueAt: 1 }).toArray()).map(item => cloneDocument(item)!); }
  async decideApproval(id: string, decision: Decision, actorId: string, comment?: string) {
    const status = decision === "APPROVE" ? "APPROVED" : decision === "REJECT" ? "REJECTED" : "CHANGES_REQUESTED";
    const result = await this.approvals.findOneAndUpdate({ id, status: "OPEN", dueAt: { $gt: now() } }, { $set: { status, decision, comment, decidedBy: actorId, decidedAt: now(), updatedAt: now() } }, { returnDocument: "after" });
    return cloneDocument(result as unknown as ApprovalTask | null);
  }
  async cancelOpenApprovals(executionId: string) {
    await this.approvals.updateMany({ executionId, status: "OPEN" }, { $set: { status: "EXPIRED", updatedAt: now() } });
  }
  async expireApprovals(current: string) {
    const tasks = await this.approvals.find({ status: "OPEN", dueAt: { $lte: current } }).toArray();
    if (tasks.length) await this.approvals.updateMany({ id: { $in: tasks.map(task => task.id) }, status: "OPEN" }, { $set: { status: "EXPIRED", updatedAt: current } });
    return tasks.map(task => ({ ...cloneDocument(task)!, status: "EXPIRED" as const, updatedAt: current }));
  }
  async createJob(job: Job) { await this.jobs.insertOne(job); }
  async claimNextJob(workerId: string, current: string) {
    const result = await this.jobs.findOneAndUpdate({ $or: [{ status: "PENDING", availableAt: { $lte: current } }, { status: "RUNNING", leaseUntil: { $lte: current } }] }, { $set: { status: "RUNNING", claimedBy: workerId, leaseUntil: new Date(Date.parse(current) + 30_000).toISOString(), updatedAt: current }, $inc: { attemptCount: 1 } }, { sort: { priority: -1, createdAt: 1 }, returnDocument: "after" });
    return cloneDocument(result as unknown as Job | null);
  }
  async completeJob(id: string) { await this.jobs.updateOne({ id }, { $set: { status: "SUCCEEDED", updatedAt: now() }, $unset: { claimedBy: "", leaseUntil: "" } }); }
  async rescheduleJob(id: string, availableAt: string, error: string) { await this.jobs.updateOne({ id }, { $set: { status: "PENDING", availableAt, lastError: error, updatedAt: now() }, $unset: { claimedBy: "", leaseUntil: "" } }); }
  async deadLetterJob(id: string, error: string) { await this.jobs.updateOne({ id }, { $set: { status: "DEAD_LETTER", lastError: error, updatedAt: now() }, $unset: { claimedBy: "", leaseUntil: "" } }); }
  async getOperation(participant: string, idempotencyKey: string) { return cloneDocument(await this.operations.findOne({ participant: participant as ParticipantOperation["participant"], idempotencyKey })); }
  async saveOperation(operation: ParticipantOperation) { await this.operations.updateOne({ participant: operation.participant, idempotencyKey: operation.idempotencyKey }, { $setOnInsert: operation }, { upsert: true }); }
  async setFault(rule: FaultRule) { await this.faults.updateOne({ participant: rule.participant }, { $set: rule }, { upsert: true }); }
  async consumeFault(participant: string) {
    const rule = await this.faults.findOne({ participant: participant as FaultRule["participant"], remaining: { $gt: 0 } });
    if (!rule) return undefined;
    if (rule.mode !== "FAIL_ALWAYS") {
      await this.faults.updateOne({ participant: rule.participant }, { $inc: { remaining: -1 }, $set: { updatedAt: now() } });
    }
    return cloneDocument(rule);
  }
}
