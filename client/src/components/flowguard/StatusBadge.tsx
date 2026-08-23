/** FlowGuard Calm Operations Console: restrained state signaling uses subtle activity cues only for live, waiting, or retrying workflow states. */
import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  RUNNING: "bg-blue-50 text-blue-800 ring-blue-200",
  WAITING_FOR_APPROVAL: "bg-amber-50 text-amber-800 ring-amber-200",
  COMPENSATING: "bg-violet-50 text-violet-800 ring-violet-200",
  COMPLETED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  COMPENSATED: "bg-slate-100 text-slate-700 ring-slate-200",
  MANUAL_RECOVERY_REQUIRED: "bg-rose-50 text-rose-800 ring-rose-200",
  PENDING: "bg-slate-100 text-slate-600 ring-slate-200",
  RUNNING_STEP: "bg-blue-50 text-blue-800 ring-blue-200",
  WAITING: "bg-amber-50 text-amber-800 ring-amber-200",
  SUCCEEDED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  RETRYING: "bg-amber-50 text-amber-800 ring-amber-200",
  FAILED: "bg-rose-50 text-rose-800 ring-rose-200",
  COMPENSATING_STEP: "bg-violet-50 text-violet-800 ring-violet-200",
  COMPENSATED_STEP: "bg-slate-100 text-slate-700 ring-slate-200",
  MANUAL_REVIEW: "bg-rose-50 text-rose-800 ring-rose-200",
  OPEN: "bg-amber-50 text-amber-800 ring-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  REJECTED: "bg-rose-50 text-rose-800 ring-rose-200",
  CHANGES_REQUESTED: "bg-amber-50 text-amber-800 ring-amber-200",
  EXPIRED: "bg-rose-50 text-rose-800 ring-rose-200",
};

export function labelForStatus(status: string) {
  return status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const key = status === "RUNNING" ? "RUNNING" : status === "COMPENSATING" ? "COMPENSATING" : status;
  const isActive = ["RUNNING", "RUNNING_STEP", "COMPENSATING", "COMPENSATING_STEP", "RETRYING"].includes(status);
  const isWaiting = ["WAITING_FOR_APPROVAL", "WAITING", "OPEN"].includes(status);
  return <span className={cn("fg-status-badge inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold tracking-[0.04em] ring-1", isActive && "fg-status-active", isWaiting && "fg-status-waiting", styles[key] ?? "bg-slate-100 text-slate-700 ring-slate-200", className)}><span className="fg-status-dot size-1.5 rounded-full bg-current opacity-75" />{labelForStatus(status)}</span>;
}
