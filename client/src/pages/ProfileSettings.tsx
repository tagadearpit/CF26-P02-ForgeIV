/** FlowGuard Calm Operations Console: profile editing is explicit, bounded, and immediately reflected in the authenticated identity rather than hidden in a generic account screen. */
import { useRef, useState } from "react";
import { Camera, CheckCircle2, CircleAlert, Save, ShieldCheck, UserRound } from "lucide-react";
import { AppShell } from "@/components/flowguard/AppShell";
import { PageHeader } from "@/components/flowguard/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { flowguardApi } from "@/lib/flowguard-api";
import { toast } from "sonner";

const supportedTypes = ["image/png", "image/jpeg", "image/webp"];
const maxAvatarBytes = 240_000;

export default function ProfileSettings() {
  const { auth, updateUser } = useAuth();
  const [name, setName] = useState(auth?.user.name ?? "");
  const [email, setEmail] = useState(auth?.user.email ?? "");
  const [avatarDataUrl, setAvatarDataUrl] = useState(auth?.user.avatarDataUrl ?? "");
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const initials = name.split(" ").filter(Boolean).map(part => part[0]).join("").slice(0, 2).toUpperCase() || "FG";
  const nameError = name.trim().length > 0 && name.trim().length < 2 ? "Enter at least 2 characters." : "";
  const emailError = email.trim().length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "Enter a valid email address." : "";

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
    } finally {
      setSaving(false);
    }
  };

  return <AppShell><PageHeader eyebrow="PROFILE SETTINGS" title="Your identity, clearly represented." description="Update the name, email address, and avatar shown in your FlowGuard workspace. Account role and workflow permissions remain server-controlled." />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]"><form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] dark:border-slate-700 sm:p-7"><div className="flex flex-col gap-5 border-b border-slate-100 pb-6 dark:border-slate-800 sm:flex-row sm:items-center"><button type="button" onClick={() => fileInput.current?.click()} className="group relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-blue-100 text-lg font-extrabold text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/25" aria-label="Choose a custom avatar">{avatarDataUrl ? <img src={avatarDataUrl} alt="Profile avatar preview" className="size-full object-cover" /> : initials}<span className="absolute inset-0 flex items-center justify-center bg-slate-950/55 text-white opacity-0 transition-opacity group-hover:opacity-100"><Camera className="size-5" /></span></button><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={event => chooseAvatar(event.target.files?.[0])} /><div><p className="text-sm font-bold text-slate-800 dark:text-slate-100">Profile avatar</p><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">PNG, JPEG, or WebP; up to 240 KB. This avatar is stored with your protected account profile.</p><div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()} className="border-slate-200 dark:border-slate-700"><Camera className="mr-1.5 size-3.5" />Choose image</Button>{avatarDataUrl && <Button type="button" variant="ghost" size="sm" onClick={() => setAvatarDataUrl("")} className="text-rose-700 hover:bg-rose-50 dark:text-rose-300">Remove</Button>}</div></div></div><div className="mt-6 grid gap-5 sm:grid-cols-2"><label className="block sm:col-span-2"><span className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-200">Full name</span><Input value={name} onChange={event => setName(event.target.value)} aria-invalid={Boolean(nameError)} className="h-11 border-slate-200 bg-white aria-invalid:border-rose-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />{nameError && <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-rose-600 dark:text-rose-300"><CircleAlert className="size-3" />{nameError}</p>}</label><label className="block sm:col-span-2"><span className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-200">Email address</span><Input value={email} onChange={event => setEmail(event.target.value)} type="email" aria-invalid={Boolean(emailError)} className="h-11 border-slate-200 bg-white aria-invalid:border-rose-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />{emailError && <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-rose-600 dark:text-rose-300"><CircleAlert className="size-3" />{emailError}</p>}</label></div><div className="mt-7 flex justify-end"><Button type="submit" disabled={saving || Boolean(nameError || emailError)} className="bg-blue-600 hover:bg-blue-700">{saving ? "Saving profile…" : <><Save className="mr-2 size-4" />Save profile</>}</Button></div></form>
      <aside className="space-y-4"><div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700"><div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"><UserRound className="size-4" /></div><h2 className="mt-4 text-sm font-bold text-slate-800 dark:text-slate-100">Account scope</h2><p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">Your role is <strong>{auth?.user.role}</strong>. Only an administrator can change access permissions or recovery controls.</p></div><div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/25"><ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-300" /><p className="mt-3 text-sm font-bold text-emerald-900 dark:text-emerald-100">Protected profile data</p><p className="mt-1 text-xs leading-5 text-emerald-800 dark:text-emerald-200">Your password is not available here and cannot be viewed. Avatar uploads are limited to a small, safe image format set.</p></div><div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 dark:border-blue-900/50 dark:bg-blue-950/25"><CheckCircle2 className="size-5 text-blue-600 dark:text-blue-300" /><p className="mt-3 text-sm font-bold text-blue-900 dark:text-blue-100">Immediate workspace update</p><p className="mt-1 text-xs leading-5 text-blue-800 dark:text-blue-200">Saved changes update the signed-in account and the workspace profile menu immediately.</p></div></aside></div>
  </AppShell>;
}
