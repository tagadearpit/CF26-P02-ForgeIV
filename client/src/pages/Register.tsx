/** FlowGuard Calm Operations Console: a distinct, security-forward registration surface with real-time feedback and a deliberate handoff to sign-in. */
import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, CircleAlert, Eye, EyeOff, Moon, ShieldCheck, Sun, UserPlus } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/contexts/ThemeContext";
import { flowguardApi } from "@/lib/flowguard-api";
import { toast } from "sonner";

type FieldName = "firstName" | "surname" | "email" | "password" | "confirmPassword";
type RegistrationForm = Record<FieldName, string>;

const initialForm: RegistrationForm = { firstName: "", surname: "", email: "", password: "", confirmPassword: "" };

function fieldErrors(form: RegistrationForm): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};
  if (form.firstName.trim().length < 2) errors.firstName = "Enter at least 2 characters.";
  if (form.surname.trim().length < 2) errors.surname = "Enter at least 2 characters.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = "Enter a valid email address.";
  const rules = [form.password.length >= 10, /[a-z]/.test(form.password), /[A-Z]/.test(form.password), /[0-9]/.test(form.password), /[^A-Za-z0-9]/.test(form.password)];
  if (!rules.every(Boolean)) errors.password = "Use 10+ characters with uppercase, lowercase, number, and symbol.";
  if (form.confirmPassword !== form.password || !form.confirmPassword) errors.confirmPassword = "Passwords must match.";
  return errors;
}

function PasswordStrength({ password }: { password: string }) {
  const score = [password.length >= 10, /[a-z]/.test(password), /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  const detail = score === 0 ? { label: "Add a password", tone: "bg-slate-200 dark:bg-slate-700", text: "text-slate-500" } : score <= 2 ? { label: "Weak", tone: "bg-rose-500", text: "text-rose-600 dark:text-rose-300" } : score <= 3 ? { label: "Fair", tone: "bg-amber-500", text: "text-amber-700 dark:text-amber-300" } : score <= 4 ? { label: "Good", tone: "bg-blue-500", text: "text-blue-700 dark:text-blue-300" } : { label: "Strong", tone: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300" };
  return <div className="mt-2" aria-live="polite"><div className="flex items-center justify-between gap-3"><span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Password strength</span><span className={`text-[10px] font-bold ${detail.text}`}>{detail.label}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"><div className={`h-full rounded-full transition-[width,background-color] duration-200 ${detail.tone}`} style={{ width: `${score * 20}%` }} /></div></div>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 flex items-start gap-1.5 text-[10px] leading-4 text-rose-600 dark:text-rose-300"><CircleAlert className="mt-0.5 size-3 shrink-0" />{message}</p>;
}

export default function Register() {
  const { theme, toggleTheme } = useTheme();
  const [, navigate] = useLocation();
  const [form, setForm] = useState<RegistrationForm>(initialForm);
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const errors = useMemo(() => fieldErrors(form), [form]);
  const update = (field: FieldName, value: string) => setForm(current => ({ ...current, [field]: value }));
  const touch = (field: FieldName) => setTouched(current => ({ ...current, [field]: true }));
  const errorFor = (field: FieldName) => touched[field] ? errors[field] : undefined;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched({ firstName: true, surname: true, email: true, password: true, confirmPassword: true });
    if (Object.keys(errors).length) return toast.error("Review the highlighted fields before creating your account.");
    setLoading(true);
    try {
      const result = await flowguardApi.register(form);
      toast.success(result.message);
      navigate("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Account could not be created.");
    } finally {
      setLoading(false);
    }
  };

  return <main className="min-h-svh bg-slate-950 p-4 lg:p-7"><div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1440px] overflow-hidden rounded-3xl bg-[#F7F8FA] shadow-2xl dark:bg-slate-900 dark:shadow-black/35 lg:grid-cols-[0.9fr_1.1fr]">
    <section className="relative hidden overflow-hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col"><img src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=85" alt="Collaborative workspace" className="absolute inset-0 size-full object-cover opacity-45" /><div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(15,23,42,0.96)_0%,rgba(15,23,42,0.80)_58%,rgba(30,64,175,0.64)_100%)]" /><div className="relative z-10 flex items-center gap-3"><img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663889343004/TJucKfGMGLCqWyAe.png" alt="FlowGuard mark" className="size-10 rounded-xl" /><span className="text-lg font-extrabold tracking-[-0.04em]">FlowGuard</span></div><div className="relative z-10 my-auto max-w-md"><p className="mb-4 text-[11px] font-bold tracking-[0.18em] text-blue-200">CREATE A SECURE WORKSPACE</p><h1 className="text-5xl font-extrabold leading-[0.98] tracking-[-0.065em]">Start with a trusted identity.</h1><p className="mt-6 text-base leading-7 text-slate-200">Your account is created with a protected password hash and the safest default access for starting and tracking workflow requests.</p><div className="mt-8 space-y-3 rounded-xl border border-white/15 bg-slate-950/35 p-5 backdrop-blur-sm"><p className="text-xs font-bold text-white">Account safeguards</p><p className="flex items-start gap-2 text-xs leading-5 text-slate-300"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" />Passwords are never stored in plain text.</p><p className="flex items-start gap-2 text-xs leading-5 text-slate-300"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" />New accounts begin with requester-level access.</p><p className="flex items-start gap-2 text-xs leading-5 text-slate-300"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" />Sign in separately after registration to start a secure session.</p></div></div><div className="relative z-10 flex items-center gap-2 text-xs text-slate-300"><ShieldCheck className="size-4 text-emerald-300" />Durable execution. Human judgment. Complete history.</div></section>
    <section className="relative flex items-center justify-center p-6 dark:bg-slate-900 sm:p-12"><Button onClick={toggleTheme} variant="outline" size="icon" className="fg-interactive absolute right-5 top-5 border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>{theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}</Button><div className="w-full max-w-md"><Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300"><ArrowLeft className="size-3.5" />Back to sign in</Link><p className="mt-8 text-[10px] font-bold tracking-[0.16em] text-blue-600 dark:text-blue-300">ACCOUNT REGISTRATION</p><h2 className="mt-3 text-3xl font-extrabold tracking-[-0.055em] text-slate-900 dark:text-slate-100">Create your FlowGuard account</h2><p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">Use your own email and a strong password. You will return to sign in after your account is created.</p><form onSubmit={submit} className="mt-7 space-y-4" noValidate><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-200">First name</span><Input value={form.firstName} onChange={event => update("firstName", event.target.value)} onBlur={() => touch("firstName")} autoComplete="given-name" aria-invalid={Boolean(errorFor("firstName"))} className="h-11 border-slate-200 bg-white aria-invalid:border-rose-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" /><FieldError message={errorFor("firstName")} /></label><label className="block"><span className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-200">Surname</span><Input value={form.surname} onChange={event => update("surname", event.target.value)} onBlur={() => touch("surname")} autoComplete="family-name" aria-invalid={Boolean(errorFor("surname"))} className="h-11 border-slate-200 bg-white aria-invalid:border-rose-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" /><FieldError message={errorFor("surname")} /></label></div><label className="block"><span className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-200">Email address</span><Input value={form.email} onChange={event => update("email", event.target.value)} onBlur={() => touch("email")} autoComplete="email" type="email" aria-invalid={Boolean(errorFor("email"))} className="h-11 border-slate-200 bg-white aria-invalid:border-rose-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" /><FieldError message={errorFor("email")} /></label><label className="block"><span className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-200">Password</span><div className="relative"><Input value={form.password} onChange={event => update("password", event.target.value)} onBlur={() => touch("password")} autoComplete="new-password" type={showPassword ? "text" : "password"} aria-invalid={Boolean(errorFor("password"))} className="h-11 border-slate-200 bg-white pr-11 aria-invalid:border-rose-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div><PasswordStrength password={form.password} /><FieldError message={errorFor("password")} /></label><label className="block"><span className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-200">Confirm password</span><div className="relative"><Input value={form.confirmPassword} onChange={event => update("confirmPassword", event.target.value)} onBlur={() => touch("confirmPassword")} autoComplete="new-password" type={showConfirmation ? "text" : "password"} aria-invalid={Boolean(errorFor("confirmPassword"))} className="h-11 border-slate-200 bg-white pr-11 aria-invalid:border-rose-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" /><button type="button" aria-label={showConfirmation ? "Hide confirmed password" : "Show confirmed password"} onClick={() => setShowConfirmation(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">{showConfirmation ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div><FieldError message={errorFor("confirmPassword")} /></label><Button type="submit" disabled={loading} className="h-11 w-full bg-blue-600 font-bold hover:bg-blue-700">{loading ? "Creating secure account…" : <><UserPlus className="mr-2 size-4" />Create account</>}</Button></form><p className="mt-5 text-center text-xs text-slate-500 dark:text-slate-400">Already have an account? <Link href="/" className="font-bold text-blue-600 hover:text-blue-700 dark:text-blue-300">Sign in</Link></p></div></section>
  </div></main>;
}
