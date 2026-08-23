/** FlowGuard Calm Operations Console: outcome analytics turn durable workflow history into an immediately defensible reliability story. */
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowUpRight, BarChart3, CheckCircle2, CircleAlert, Clock3, RefreshCcw, ShieldCheck } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/flowguard/AppShell";
import { PageHeader } from "@/components/flowguard/PageHeader";
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { useAuth } from "@/contexts/AuthContext";
import { flowguardApi, type WorkflowExecution } from "@/lib/flowguard-api";
import { cn } from "@/lib/utils";

const chartConfig = {
  total: { label: "Workflows", color: "#356AE6" },
  completed: { label: "Completed", color: "#10B981" },
  recovered: { label: "Compensated", color: "#7C5CE7" },
  manual: { label: "Manual recovery", color: "#E25555" },
} satisfies ChartConfig;

function Metric({ label, value, description, icon: Icon, tone }: { label: string; value: string; description: string; icon: typeof Activity; tone: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)]"><div className="flex items-start justify-between"><div><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-4 text-3xl font-extrabold tracking-[-0.055em] text-slate-900">{value}</p></div><span className={cn("flex size-9 items-center justify-center rounded-xl", tone)}><Icon className="size-4" /></span></div><p className="mt-3 text-xs leading-5 text-slate-500">{description}</p></div>;
}

export default function Analytics() {
  const { auth } = useAuth(); const [executions, setExecutions] = useState<WorkflowExecution[]>([]); const [window, setWindow] = useState<"24h" | "7d">("7d"); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState("");
  const load = async (background = false) => { if (!auth) return; background ? setRefreshing(true) : setLoading(true); try { setExecutions(await flowguardApi.executions(auth.token)); setError(""); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to calculate workflow analytics."); } finally { setLoading(false); setRefreshing(false); } };
  useEffect(() => { void load(); const timer = setInterval(() => void load(true), 6_000); return () => clearInterval(timer); }, [auth]);
  const filteredExecutions = useMemo(() => {
    const hours = window === "24h" ? 24 : 24 * 7;
    const cutoff = Date.now() - hours * 60 * 60 * 1_000;
    return executions.filter(item => new Date(item.updatedAt).getTime() >= cutoff);
  }, [executions, window]);
  const metrics = useMemo(() => {
    const completed = filteredExecutions.filter(item => item.status === "COMPLETED").length;
    const recovered = filteredExecutions.filter(item => item.status === "COMPENSATED").length;
    const manual = filteredExecutions.filter(item => item.status === "MANUAL_RECOVERY_REQUIRED").length;
    const active = filteredExecutions.filter(item => ["RUNNING", "WAITING_FOR_APPROVAL", "COMPENSATING"].includes(item.status)).length;
    const resolved = completed + recovered + manual;
    return { completed, recovered, manual, active, resolved, successRate: resolved ? Math.round((completed / resolved) * 100) : 0, recoveryRate: resolved ? Math.round((recovered / resolved) * 100) : 0 };
  }, [filteredExecutions]);
  const outcomeData = [{ label: "Completed", total: metrics.completed, fill: "#10B981" }, { label: "Compensated", total: metrics.recovered, fill: "#7C5CE7" }, { label: "Manual", total: metrics.manual, fill: "#E25555" }];
  const stateData = [
    { name: "Active", total: metrics.active, fill: "#356AE6" },
    { name: "Waiting", total: filteredExecutions.filter(item => item.status === "WAITING_FOR_APPROVAL").length, fill: "#F59E0B" },
    { name: "Compensating", total: filteredExecutions.filter(item => item.status === "COMPENSATING").length, fill: "#7C5CE7" },
    { name: "Manual", total: metrics.manual, fill: "#E25555" },
  ];
  const windowLabel = window === "24h" ? "Past 24 hours" : "Past 7 days";
  return <AppShell><PageHeader eyebrow="RELIABILITY ANALYTICS" title="Turn workflow history into operational evidence." description={`Outcome rates are calculated from execution records updated in the ${windowLabel.toLowerCase()}—not from mocked chart values.`} action={<div className="flex flex-wrap items-center gap-2"><div className="flex rounded-lg border border-slate-200 bg-white p-1"><Button onClick={() => setWindow("24h")} size="sm" variant={window === "24h" ? "default" : "ghost"} className={cn("h-8 text-xs", window === "24h" && "bg-blue-600 hover:bg-blue-700")}>24 hours</Button><Button onClick={() => setWindow("7d")} size="sm" variant={window === "7d" ? "default" : "ghost"} className={cn("h-8 text-xs", window === "7d" && "bg-blue-600 hover:bg-blue-700")}>7 days</Button></div><Button onClick={() => void load(true)} variant="outline" className="border-slate-200"><RefreshCcw className={cn("mr-2 size-3.5", refreshing && "animate-spin")} />Refresh</Button></div>} />
    {error && <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><strong>Analytics unavailable:</strong> {error}</div>}
    {loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div className="h-40 animate-pulse rounded-2xl bg-slate-200/70" key={index} />)}</div> : <><div className="mb-5 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800"><Clock3 className="size-4" /><span><strong>{windowLabel}</strong> · {filteredExecutions.length} workflow record{filteredExecutions.length === 1 ? "" : "s"} updated in this reporting window.</span></div><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Completion rate" value={`${metrics.successRate}%`} description={`${metrics.completed} workflow${metrics.completed === 1 ? "" : "s"} reached their intended end state.`} icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" /><Metric label="Safe recovery rate" value={`${metrics.recoveryRate}%`} description={`${metrics.recovered} rejected or failed workflow${metrics.recovered === 1 ? "" : "s"} were compensated.`} icon={ShieldCheck} tone="bg-violet-50 text-violet-600" /><Metric label="Manual exceptions" value={String(metrics.manual)} description="Cases where automation stopped rather than hiding uncertainty." icon={CircleAlert} tone="bg-rose-50 text-rose-600" /><Metric label="Currently active" value={String(metrics.active)} description="Running, waiting, or actively compensating right now." icon={Activity} tone="bg-blue-50 text-blue-600" /></section>
      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] sm:p-6"><div className="flex items-start justify-between"><div><p className="text-sm font-bold text-slate-800">Resolved workflow outcomes</p><p className="mt-1 text-xs text-slate-500">A completed request is a business success. A compensated request is a safe recovery. A manual exception is intentionally visible work.</p></div><BarChart3 className="size-5 text-slate-300" /></div><ChartContainer config={chartConfig} className="mt-6 h-[270px] w-full aspect-auto"><BarChart data={outcomeData} barSize={38} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip content={<ChartTooltipContent />} /><Bar dataKey="total" radius={[8, 8, 2, 2]}>{outcomeData.map(item => <Cell key={item.label} fill={item.fill} />)}</Bar></BarChart></ChartContainer></div>
        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)]"><p className="text-sm font-bold text-slate-800">Reliability mix</p><p className="mt-1 text-xs text-slate-500">The current ledger is categorized by final outcome.</p><ChartContainer config={chartConfig} className="mx-auto mt-4 h-[180px] w-full max-w-[230px] aspect-auto"><PieChart><Tooltip content={<ChartTooltipContent nameKey="label" />} /><Pie data={outcomeData} dataKey="total" nameKey="label" innerRadius={50} outerRadius={75} paddingAngle={4}>{outcomeData.map(item => <Cell key={item.label} fill={item.fill} />)}</Pie></PieChart></ChartContainer><div className="mt-3 space-y-2">{outcomeData.map(item => <div key={item.label} className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-slate-600"><span className="size-2 rounded-full" style={{ backgroundColor: item.fill }} />{item.label}</span><span className="font-mono font-medium text-slate-800">{item.total}</span></div>)}</div></aside></section>
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-slate-800">Operational state snapshot</p><p className="mt-1 text-xs text-slate-500">Use this to explain where the coordinator is spending time today.</p></div><p className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600"><ArrowUpRight className="size-3.5" />Live data from execution documents</p></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{stateData.map(item => <div key={item.name} className="rounded-xl border border-slate-100 bg-slate-50 p-4"><span className="block size-2 rounded-full" style={{ backgroundColor: item.fill }} /><p className="mt-4 text-2xl font-extrabold tracking-[-0.04em] text-slate-900">{item.total}</p><p className="mt-1 text-xs font-semibold text-slate-500">{item.name} workflows</p></div>)}</div></section></>}
  </AppShell>;
}
