/** FlowGuard Calm Operations Console: an anchored, theme-aware sidebar shell where restrained motion explains route changes and live state without decoration. */
import { useState, type ReactNode } from "react";
import { BarChart3, Bell, ChevronDown, CircleHelp, Command, LayoutDashboard, ListChecks, Moon, Plus, ShieldCheck, Sun, Split } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

const navigation = [
  { href: "/", label: "Control room", icon: LayoutDashboard },
  { href: "/new", label: "Start workflow", icon: Plus },
  { href: "/approvals", label: "Approval inbox", icon: ListChecks },
  { href: "/recovery", label: "Recovery center", icon: ShieldCheck },
  { href: "/analytics", label: "Reliability analytics", icon: BarChart3 },
  { href: "/architecture", label: "System design", icon: Split },
  { href: "/tour", label: "Judge tour", icon: CircleHelp },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { auth, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);
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
              {navigation.map(item => <SidebarMenuItem key={item.href}><SidebarMenuButton asChild isActive={location === item.href || (item.href === "/" && location.startsWith("/executions"))} tooltip={item.label} className="h-10 rounded-lg px-3 data-[active=true]:bg-blue-50 data-[active=true]:text-blue-700"><Link href={item.href}><item.icon /><span>{item.label}</span></Link></SidebarMenuButton></SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <Link href="/tour" className="fg-interactive mx-3 mt-4 block rounded-xl bg-slate-900 p-3 text-white no-underline hover:-translate-y-0.5 dark:bg-slate-800 group-data-[collapsible=icon]:hidden">
          <div className="mb-2 flex items-center gap-2"><span className="flex size-5 items-center justify-center rounded-md bg-blue-500"><Command className="size-3" /></span><span className="text-xs font-semibold">Demo controls</span></div>
          <p className="text-[11px] leading-4 text-slate-300">Walk judges through retries, approval, and compensation evidence.</p>
        </Link>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <button onClick={() => setProfileOpen(value => !value)} className="fg-interactive flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-slate-100 dark:hover:bg-slate-900">
          <span className="flex size-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{auth?.user.name?.split(" ").map(part => part[0]).join("")}</span>
          <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><span className="block truncate text-xs font-bold text-slate-800">{auth?.user.name}</span><span className="block truncate text-[10px] font-medium text-slate-400">{auth?.user.role.toLowerCase()}</span></span><ChevronDown className="size-3.5 text-slate-400 group-data-[collapsible=icon]:hidden" />
        </button>
        {profileOpen && <div className="fg-surface-enter mt-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900 group-data-[collapsible=icon]:hidden"><button onClick={signOut} className="fg-interactive w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50">Sign out</button></div>}
      </SidebarFooter>
    </Sidebar>
    <SidebarInset className="min-h-svh bg-[#F5F7FB] dark:bg-slate-950">
      <header className="flex h-[70px] shrink-0 items-center justify-between border-b border-slate-200/80 bg-[#F9FAFC]/90 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 sm:px-7">
        <div className="flex items-center gap-3"><SidebarTrigger className="md:hidden" /><div><p className="text-[10px] font-bold tracking-[0.13em] text-slate-400">FLOWGUARD / PRODUCTION</p><p className="mt-0.5 text-sm font-semibold text-slate-700">Human-in-the-loop coordination</p></div></div>
        <div className="flex items-center gap-2"><div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 sm:flex"><span className="fg-health-signal size-1.5 rounded-full bg-emerald-500" />All participants healthy</div><Button onClick={toggleTheme} variant="ghost" size="icon" className="fg-interactive text-slate-500 dark:text-slate-300" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>{theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}</Button><Button variant="ghost" size="icon" className="fg-interactive relative text-slate-500 dark:text-slate-300"><Bell className="size-4" /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-amber-400" /></Button><Button asChild variant="ghost" size="icon" className="fg-interactive text-slate-500 dark:text-slate-300"><Link href="/tour" aria-label="Open judge tour"><CircleHelp className="size-4" /></Link></Button></div>
      </header>
      <div key={location} className={cn("fg-page-enter flex-1 p-4 sm:p-7")}>{children}</div>
    </SidebarInset>
  </SidebarProvider>;
}
