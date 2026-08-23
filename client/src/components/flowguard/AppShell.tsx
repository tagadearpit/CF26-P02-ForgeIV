/** FlowGuard Calm Operations Console: a theme-aware sidebar shell with a concise account menu for role clarity, appearance control, and safe exit. */
import { useEffect, useState, type ReactNode } from "react";
import { BarChart3, Bell, CircleHelp, Command, LayoutDashboard, ListChecks, LogOut, Moon, Palette, Plus, Settings2, ShieldCheck, Sun, UserRound, UsersRound, Split } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { flowguardApi } from "@/lib/flowguard-api";

const navigation = [
  { href: "/", label: "Control room", icon: LayoutDashboard },
  { href: "/new", label: "Start workflow", icon: Plus },
  { href: "/approvals", label: "Approval inbox", icon: ListChecks },
  { href: "/recovery", label: "Recovery center", icon: ShieldCheck },
  { href: "/analytics", label: "Reliability analytics", icon: BarChart3 },
  { href: "/architecture", label: "System design", icon: Split },
  { href: "/about", label: "About ForgeVI", icon: UsersRound },
  { href: "/tour", label: "Judge tour", icon: CircleHelp },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { auth, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const initials = auth?.user.name?.split(" ").map(part => part[0]).join("") ?? "FG";
  const profileAvatar = auth?.user.avatarDataUrl;
  const isAdministrator = auth?.user.role === "ADMIN";

  useEffect(() => {
    if (!auth || !isAdministrator) { setPendingRequestCount(0); return; }
    const loadPendingRequests = async () => {
      try {
        const dashboard = await flowguardApi.dashboard(auth.token);
        setPendingRequestCount((dashboard.counts.RUNNING ?? 0) + (dashboard.counts.WAITING_FOR_APPROVAL ?? 0));
      } catch { setPendingRequestCount(0); }
    };
    void loadPendingRequests();
    const timer = window.setInterval(() => void loadPendingRequests(), 5_000);
    return () => window.clearInterval(timer);
  }, [auth, isAdministrator]);
  return <SidebarProvider defaultOpen>
    <Sidebar variant="inset" collapsible="icon" className="border-r border-slate-200/70 bg-[#FBFCFE] dark:border-slate-800 dark:bg-slate-950">
      <SidebarHeader className="p-4 pb-3">
        <Link href="/" className="group flex items-center gap-3 px-1 no-underline">
          <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663889343004/TJucKfGMGLCqWyAe.png" alt="FlowGuard" className="size-9 rounded-xl shadow-sm transition-transform duration-200 group-hover:scale-105" />
          <span className="min-w-0"><span className="block text-base font-extrabold tracking-[-0.04em] text-slate-900">FlowGuard</span><span className="block text-[10px] font-bold tracking-[0.12em] text-slate-400">OPS CONSOLE</span></span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-2 pt-2">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-3 text-[10px] font-bold tracking-[0.14em] text-slate-400">WORKSPACE</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="fg-nav-stagger">
              {navigation.map(item => { const badge = item.href === "/" && isAdministrator ? pendingRequestCount : 0; return <SidebarMenuItem key={item.href}><SidebarMenuButton asChild isActive={location === item.href || (item.href === "/" && location.startsWith("/executions"))} tooltip={badge ? `${item.label}: ${badge} pending requests` : item.label} className="h-10 rounded-lg px-3 data-[active=true]:bg-blue-50 data-[active=true]:text-blue-700"><Link href={item.href}><item.icon /><span>{item.label}</span>{badge > 0 && <span className="ml-auto flex min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 group-data-[collapsible=icon]:hidden">{badge > 99 ? "99+" : badge}</span>}</Link></SidebarMenuButton></SidebarMenuItem>})}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <Link href="/tour" className="fg-interactive mx-3 mt-4 block rounded-xl bg-slate-900 p-3 text-white no-underline hover:-translate-y-0.5 dark:bg-slate-800 group-data-[collapsible=icon]:hidden">
          <div className="mb-2 flex items-center gap-2"><span className="flex size-5 items-center justify-center rounded-md bg-blue-500"><Command className="size-3" /></span><span className="text-xs font-semibold">Demo controls</span></div>
          <p className="text-[11px] leading-4 text-slate-300">Walk judges through retries, approval, and compensation evidence.</p>
        </Link>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="fg-interactive flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-slate-100 dark:hover:bg-slate-900" aria-label="Open account menu">
              {profileAvatar ? <img src={profileAvatar} alt="Your profile avatar" className="size-8 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700" /> : <span className="flex size-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">{initials}</span>}
              <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><span className="block truncate text-xs font-bold text-slate-800 dark:text-slate-100">{auth?.user.name}</span><span className="block truncate text-[10px] font-medium text-slate-400">{auth?.user.role.toLowerCase()}</span></span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="fg-surface-enter w-64 rounded-xl border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <DropdownMenuLabel className="px-2 py-2"><div className="flex items-center gap-2">{profileAvatar ? <img src={profileAvatar} alt="Your profile avatar" className="size-8 rounded-lg object-cover" /> : <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"><UserRound className="size-4" /></span>}<span className="min-w-0"><span className="block truncate text-xs font-bold text-slate-800 dark:text-slate-100">{auth?.user.name}</span><span className="block truncate text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">{auth?.user.role} access</span></span></div></DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate("/settings/profile")} className="rounded-lg py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"><Settings2 className="size-4 text-slate-400" />Profile settings</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toggleTheme?.()} className="rounded-lg py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"><Palette className="size-4 text-blue-600 dark:text-blue-300" /><span>Appearance</span><span className="ml-auto text-[10px] font-medium text-slate-400">{theme === "dark" ? "Dark" : "Light"}</span></DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate("/tour")} className="rounded-lg py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"><CircleHelp className="size-4 text-slate-400" />Open judge tour</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut} variant="destructive" className="rounded-lg py-2 text-xs font-semibold"><LogOut className="size-4" />Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
    <SidebarInset className="min-h-svh bg-[#F5F7FB] dark:bg-slate-950">
      <header className="flex h-[70px] shrink-0 items-center justify-between border-b border-slate-200/80 bg-[#F9FAFC]/90 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 sm:px-7">
        <div className="flex items-center gap-3"><SidebarTrigger className="md:hidden" /><div><p className="text-[10px] font-bold tracking-[0.13em] text-slate-400">FLOWGUARD / PRODUCTION</p><p className="mt-0.5 text-sm font-semibold text-slate-700">Human-in-the-loop coordination</p></div></div>
        <div className="flex items-center gap-2"><div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 sm:flex"><span className="fg-health-signal size-1.5 rounded-full bg-emerald-500" />All participants healthy</div><Button onClick={toggleTheme} variant="ghost" size="icon" className="fg-interactive text-slate-500 dark:text-slate-300" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>{theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}</Button><Button asChild variant="ghost" size="icon" className="fg-interactive relative text-slate-500 dark:text-slate-300" aria-label={pendingRequestCount ? `${pendingRequestCount} pending workflow requests` : "No pending workflow requests"} title={pendingRequestCount ? `${pendingRequestCount} pending workflow requests` : "No pending workflow requests"}><Link href="/"><Bell className="size-4" />{pendingRequestCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-extrabold leading-4 text-amber-950">{pendingRequestCount > 9 ? "9+" : pendingRequestCount}</span>}</Link></Button><Button asChild variant="ghost" size="icon" className="fg-interactive text-slate-500 dark:text-slate-300"><Link href="/tour" aria-label="Open judge tour"><CircleHelp className="size-4" /></Link></Button></div>
      </header>
      <div key={location} className={cn("fg-page-enter flex-1 p-4 sm:p-7")}>{children}</div>
    </SidebarInset>
  </SidebarProvider>;
}
