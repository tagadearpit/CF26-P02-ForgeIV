import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Approvals from "./pages/Approvals";
import Architecture from "./pages/Architecture";
import ExecutionDetail from "./pages/ExecutionDetail";
import Home from "./pages/Home";
import Login from "./pages/Login";
import NewWorkflow from "./pages/NewWorkflow";
import Recovery from "./pages/Recovery";

function Router() {
  const { auth } = useAuth();
  if (!auth) return <Login />;
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/new"} component={NewWorkflow} />
      <Route path={"/approvals"} component={Approvals} />
      <Route path={"/recovery"} component={Recovery} />
      <Route path={"/architecture"} component={Architecture} />
      <Route path={"/executions/:id"} component={ExecutionDetail} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
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
