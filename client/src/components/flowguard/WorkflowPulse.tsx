/** FlowGuard Calm Operations Console: the workflow pulse rail makes operational state and next action visible at a glance. */
import { Check, CircleDashed, Clock3, RotateCcw, TriangleAlert } from "lucide-react";
import type { StepExecution } from "@/lib/flowguard-api";
import { StatusBadge } from "./StatusBadge";

const prettyName = (key: string) => key.replaceAll("-", " ").replace(/\b\w/g, letter => letter.toUpperCase());

function iconFor(status: StepExecution["status"]) {
  if (["SUCCEEDED", "COMPENSATED"].includes(status)) return <Check className="size-3.5" />;
  if (["FAILED", "MANUAL_REVIEW"].includes(status)) return <TriangleAlert className="size-3.5" />;
  if (["WAITING", "RETRYING"].includes(status)) return <Clock3 className="size-3.5" />;
  if (status === "COMPENSATING") return <RotateCcw className="size-3.5" />;
  return <CircleDashed className="size-3.5" />;
}

export function WorkflowPulse({ steps, compact = false }: { steps: StepExecution[]; compact?: boolean }) {
  return <div className="relative space-y-0">
    <div className="absolute bottom-5 left-[17px] top-5 w-px bg-slate-200" />
    {steps.map((step, index) => {
      const isSuccess = ["SUCCEEDED", "COMPENSATED"].includes(step.status);
      const isProblem = ["FAILED", "MANUAL_REVIEW"].includes(step.status);
      const tone = isSuccess ? "bg-emerald-500 text-white" : isProblem ? "bg-rose-500 text-white" : step.status === "WAITING" ? "bg-amber-400 text-white" : step.status === "COMPENSATING" ? "bg-violet-500 text-white" : "bg-white text-slate-500 ring-2 ring-slate-200";
      return <div className="relative z-10 flex gap-3 py-2.5" key={step.id}>
        <div className={`mt-0.5 flex size-[34px] shrink-0 items-center justify-center rounded-full ${tone}`}>{iconFor(step.status)}</div>
        <div className="min-w-0 flex-1 pb-1">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-800">{index + 1}. {prettyName(step.stepKey)}</p><StatusBadge status={step.status} /></div>
          {!compact && <p className="mt-1 text-xs leading-5 text-slate-500">{step.error ?? (step.output?.externalId ? `External record ${String(step.output.externalId)}` : step.status === "PENDING" ? "Queued for the coordinator." : "Coordinator state has been persisted.")}</p>}
          {!compact && <p className="mt-1 font-mono text-[10px] text-slate-400">{step.idempotencyKey}</p>}
        </div>
      </div>;
    })}
  </div>;
}
