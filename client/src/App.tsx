import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import Dashboard from "./pages/dashboard";
import HistoryPage from "./pages/history";
import StatementDetailPage from "./pages/statement-detail";
import AdminPage from "./pages/admin";
import CompanyProfilePage from "./pages/company-profile";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ component: Component, path }: { component: React.ComponentType<any>, path: string }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (!user) return <Redirect to="/login" />;
  return <Route path={path} component={Component} />;
}

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/history" component={HistoryPage} />
      <ProtectedRoute path="/statement/:id" component={StatementDetailPage} />
      <ProtectedRoute path="/admin" component={AdminPage} />
      <ProtectedRoute path="/company" component={CompanyProfilePage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
