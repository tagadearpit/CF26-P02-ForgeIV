/** FlowGuard Calm Operations Console: profile identity and user-scoped workflow history are shown as accountable, time-ordered operational evidence. */
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Camera, CheckCircle2, CircleAlert, Clock3, ListChecks, RefreshCw, Save, ShieldCheck, UserRound } from "lucide-react";
import { Link } from "wouter";
import { AppShell } from "@/components/flowguard/AppShell";
import { PageHeader } from "@/components/flowguard/PageHeader";
import { StatusBadge } from "@/components/flowguard/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { flowguardApi, type ProfileActivity } from "@/lib/flowguard-api";
import { toast } from "sonner";

const supportedTypes = ["image/png", "image/jpeg", "image/webp"];
const maxAvatarBytes = 240_000;
const formatDate = (value: string) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

function eventCopy(event: ProfileActivity) {
  const step = event.stepKey?.replaceAll("-", " ");
  const labels: Record<string, string> = {
    WORKFLOW_STARTED: "Workflow request submitted",
    STEP_SUCCEEDED: step ? `${step} completed` : "Participant step completed",
    APPROVAL_REQUESTED: "Waiting for human approval",
    APPROVAL_APPROVED: "Approval recorded",
    APPROVAL_REJECTED: "Approval rejected; recovery started",
    CHANGES_REQUESTED: "Changes requested",
    STEP_RETRY_SCHEDULED: step ? `${step} retry scheduled` : "Retry scheduled",
    COMPENSATION_STARTED: "Compensation started",
    STEP_COMPENSATED: step ? `${step} compensated` : "Step compensated",
    WORKFLOW_COMPENSATED: "Workflow safely compensated",
    WORKFLOW_COMPLETED: "Workflow completed",
    MANUAL_RECOVERY_REQUIRED: "Manual recovery required",
  };
  return labels[event.eventType] ?? event.eventType.replaceAll("_", " ").toLowerCase();
}

export default function ProfileSettings() {
  const { auth, updateUser } = useAuth();
  const [name, setName] = useState(auth?.user.name ?? "");
  const [email, setEmail] = useState(auth?.user.email ?? "");
  const [avatarDataUrl, setAvatarDataUrl] = useState(auth?.user.avatarDataUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [activity, setActivity] = useState<ProfileActivity[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [activityError, setActivityError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const initials = name.split(" ").filter(Boolean).map(part => part[0]).join("").slice(0, 2).toUpperCase() || "FG";
  const nameError = name.trim().length > 0 && name.trim().length < 2 ? "Enter at least 2 characters." : "";
  const emailError = email.trim().length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "Enter a valid email address." : "";

  const loadActivity = async () => {
    if (!auth) return;
    setLoadingActivity(true);
    try {
      setActivity(await flowguardApi.profileActivity(auth.token));
      setActivityError("");
    } catch (error) {
      setActivityError(error instanceof Error ? error.message : "Activity history could not be loaded.");
    } finally {
      setLoadingActivity(false);
    }
  };
  useEffect(() => { void loadActivity(); }, [auth?.token]);

  const chooseAvatar = (file?: File) => {
    if (!file) return;
    if (!supportedTypes.includes(file.type)) return toast.error("Choose a PNG, JPEG, or WebP image.");
    if (file.size > maxAvatarBytes) return toast.error("Choose an image smaller than 240 KB.");
    const reader = new FileReader();
    reader.onload = () => setAvatarDataUrl(String(reader.result));
    reader.onerror = () => toast.error("The avatar image could not be read.");
    reader.readAsDataURL(file);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (nameError || emailError || !name.trim() || !email.trim()) return toast.error("Review your name and email before saving.");
    if (!auth) return;
    setSaving(true);
    try {
      const user = await flowguardApi.updateProfile(auth.token, { name: name.trim(), email: email.trim(), avatarDataUrl: avatarDataUrl || undefined });
      updateUser(user);
      toast.success("Profile settings saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Profile could not be updated.");
    } finally { setSaving(false); }
  };

  return <AppShell><PageHeader eyebrow="PROFILE SETTINGS" title="Your identity and workflow history." description="Update the workspace identity shown to your team, then review the durable activity record for requests you submitted." />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]"><form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] dark:border-slate-700 sm:p-7"><div className="flex flex-col gap-5 border-b border-slate-100 pb-6 dark:border-slate-800 sm:flex-row sm:items-center"><button type="button" onClick={() => fileInput.current?.click()} className="group relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-blue-100 text-lg font-extrabold text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/25" aria-label="Choose a custom avatar">{avatarDataUrl ? <img src={avatarDataUrl} alt="Profile avatar preview" className="size-full object-cover" /> : initials}<span className="absolute inset-0 flex items-center justify-center bg-slate-950/55 text-white opacity-0 transition-opacity group-hover:opacity-100"><Camera className="size-5" /></span></button><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={event => chooseAvatar(event.target.files?.[0])} /><div><p className="text-sm font-bold text-slate-800 dark:text-slate-100">Profile avatar</p><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">PNG, JPEG, or WebP; up to 240 KB. This avatar is stored with your protected account profile.</p><div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()} className="border-slate-200 dark:border-slate-700"><Camera className="mr-1.5 size-3.5" />Choose image</Button>{avatarDataUrl && <Button type="button" variant="ghost" size="sm" onClick={() => setAvatarDataUrl("")} className="text-rose-700 hover:bg-rose-50 dark:text-rose-300">Remove</Button>}</div></div></div><div className="mt-6 grid gap-5 sm:grid-cols-2"><label className="block sm:col-span-2"><span className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-200">Full name</span><Input value={name} onChange={event => setName(event.target.value)} aria-invalid={Boolean(nameError)} className="h-11 border-slate-200 bg-white aria-invalid:border-rose-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />{nameError && <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-rose-600 dark:text-rose-300"><CircleAlert className="size-3" />{nameError}</p>}</label><label className="block sm:col-span-2"><span className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-200">Email address</span><Input value={email} onChange={event => setEmail(event.target.value)} type="email" aria-invalid={Boolean(emailError)} className="h-11 border-slate-200 bg-white aria-invalid:border-rose-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />{emailError && <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-rose-600 dark:text-rose-300"><CircleAlert className="size-3" />{emailError}</p>}</label></div><div className="mt-7 flex justify-end"><Button type="submit" disabled={saving || Boolean(nameError || emailError)} className="bg-blue-600 hover:bg-blue-700">{saving ? "Saving profile…" : <><Save className="mr-2 size-4" />Save profile</>}</Button></div></form>
      <aside className="space-y-4"><div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700"><div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"><UserRound className="size-4" /></div><h2 className="mt-4 text-sm font-bold text-slate-800 dark:text-slate-100">Account scope</h2><p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">Your role is <strong>{auth?.user.role}</strong>. Only an administrator can change access permissions or recovery controls.</p></div><div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/25"><ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-300" /><p className="mt-3 text-sm font-bold text-emerald-900 dark:text-emerald-100">Protected profile data</p><p className="mt-1 text-xs leading-5 text-emerald-800 dark:text-emerald-200">Your password is not available here and cannot be viewed. Avatar uploads are limited to a small, safe image format set.</p></div><div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 dark:border-blue-900/50 dark:bg-blue-950/25"><CheckCircle2 className="size-5 text-blue-600 dark:text-blue-300" /><p className="mt-3 text-sm font-bold text-blue-900 dark:text-blue-100">Immediate workspace update</p><p className="mt-1 text-xs leading-5 text-blue-800 dark:text-blue-200">Saved changes update the signed-in account and the workspace profile menu immediately.</p></div></aside></div>
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)] dark:border-slate-700"><div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"><ListChecks className="size-4" /></span><div><h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Your activity history</h2><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Only workflow requests submitted by your account are shown.</p></div></div><Button type="button" onClick={() => void loadActivity()} variant="outline" size="sm" disabled={loadingActivity} className="border-slate-200 dark:border-slate-700"><RefreshCw className={`mr-1.5 size-3.5 ${loadingActivity ? "animate-spin" : ""}`} />Refresh</Button></div>{loadingActivity ? <div className="flex min-h-[170px] items-center justify-center gap-2 text-xs font-semibold text-slate-400"><RefreshCw className="size-4 animate-spin" />Loading your activity…</div> : activityError ? <div className="p-5"><p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/25 dark:text-rose-200">{activityError}</p></div> : activity.length === 0 ? <div className="flex min-h-[190px] flex-col items-center justify-center p-8 text-center"><Clock3 className="size-6 text-slate-300 dark:text-slate-600" /><p className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-100">No workflow activity yet.</p><p className="mt-1 max-w-sm text-xs leading-5 text-slate-500 dark:text-slate-400">Start a workflow to build a durable timeline of its progress, decisions, retries, and final outcome.</p><Button asChild size="sm" className="mt-4 bg-blue-600 hover:bg-blue-700"><Link href="/new">Start workflow <ArrowRight className="ml-1.5 size-3.5" /></Link></Button></div> : <ol className="relative divide-y divide-slate-100 dark:divide-slate-800">{activity.map((entry, index) => <li key={entry.id} className="relative flex gap-4 px-5 py-4"><div className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-extrabold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{index + 1}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-bold text-slate-800 dark:text-slate-100">{eventCopy(entry)}</p><StatusBadge status={entry.status} /></div><p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400"><span className="font-mono font-semibold text-slate-600 dark:text-slate-300">{entry.businessKey}</span> · {entry.stepKey?.replaceAll("-", " ") ?? "workflow"}</p><p className="mt-1.5 flex items-center gap-1.5 text-[10px] font-medium text-slate-400"><Clock3 className="size-3" />{formatDate(entry.createdAt)}</p></div><Link href={`/executions/${entry.executionId}`} className="self-center text-slate-300 transition-colors hover:text-blue-600 dark:text-slate-600 dark:hover:text-blue-300" aria-label={`Open ${entry.businessKey}`}><ArrowRight className="size-4" /></Link></li>)}</ol>}</section>
  </AppShell>;
}
