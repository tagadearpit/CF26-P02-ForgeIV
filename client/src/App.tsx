/** FlowGuard Calm Operations Console: system-aware theme selection supports focused work across different operating environments. */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Approvals from "./pages/Approvals";
import About from "./pages/About";
import Architecture from "./pages/Architecture";
import ExecutionDetail from "./pages/ExecutionDetail";
import Home from "./pages/Home";
import Login from "./pages/Login";
import NewWorkflow from "./pages/NewWorkflow";
import Recovery from "./pages/Recovery";

const Analytics = lazy(() => import("./pages/Analytics"));
const JudgeTour = lazy(() => import("./pages/JudgeTour"));

function Router() {
  const { auth } = useAuth();
  if (!auth) return <Login />;
  return (
    <Suspense fallback={<div className="flex min-h-svh items-center justify-center bg-slate-50 text-sm font-semibold text-slate-500">Loading FlowGuard workspace…</div>}>
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/new"} component={NewWorkflow} />
      <Route path={"/approvals"} component={Approvals} />
      <Route path={"/recovery"} component={Recovery} />
      <Route path={"/analytics"} component={Analytics} />
      <Route path={"/architecture"} component={Architecture} />
      <Route path={"/about"} component={About} />
      <Route path={"/tour"} component={JudgeTour} />
      <Route path={"/executions/:id"} component={ExecutionDetail} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        switchable
      >
        <TooltipProvider>
          <AuthProvider>
            <Toaster richColors position="top-right" />
            <Router />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
