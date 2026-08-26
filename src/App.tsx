import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { TenantProvider, useTenant } from "@/contexts/TenantContext";
import { AppSidebar } from "@/components/AppSidebar";
import { AlertasNotificacao } from "@/components/AlertasNotificacao";
import Auth from "./pages/Auth";
import Receitas from "./pages/Receitas";
import Despesas from "./pages/Despesas";
import Categorias from "./pages/Categorias";
import Bancos from "./pages/Bancos";
import FluxoCaixa from "./pages/FluxoCaixa";
import ApiKeys from "./pages/ApiKeys";
import ApiDocumentation from "./pages/ApiDocumentation";
import Usuarios from "./pages/Usuarios";
import TelegramBot from "./pages/TelegramBot";
import NotFound from "./pages/NotFound";
import { OperatorGuard } from "./pages/operador/OperatorGuard";
import OperatorDashboard from "./pages/operador/OperatorDashboard";
import OperatorTenantDetail from "./pages/operador/OperatorTenantDetail";
import { Loader2 } from "lucide-react";

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="fixed top-4 right-4 z-50">
        <AlertasNotificacao />
      </div>
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}

function MasterRoute({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  const { role } = useTenant();

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (role !== 'master') {
    return <Navigate to="/receitas" replace />;
  }

  return <>{children}</>;
}

function PermissionRoute({ moduleKey, children }: { moduleKey: string; children: React.ReactNode }) {
  const { loading } = useAuth();
  const { hasModule, activeTenant } = useTenant();

  if (loading || !activeTenant) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasModule(moduleKey)) {
    return <Navigate to="/receitas" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/receitas" replace /> : <Auth />} />
      <Route path="/" element={<Navigate to={user ? "/receitas" : "/auth"} replace />} />
      <Route path="/receitas" element={<ProtectedLayout><PermissionRoute moduleKey="receitas"><Receitas /></PermissionRoute></ProtectedLayout>} />
      <Route path="/despesas" element={<ProtectedLayout><PermissionRoute moduleKey="despesas"><Despesas /></PermissionRoute></ProtectedLayout>} />
      <Route path="/categorias" element={<ProtectedLayout><PermissionRoute moduleKey="categorias"><Categorias /></PermissionRoute></ProtectedLayout>} />
      <Route path="/bancos" element={<ProtectedLayout><PermissionRoute moduleKey="bancos"><Bancos /></PermissionRoute></ProtectedLayout>} />
      <Route path="/fluxo-caixa" element={<ProtectedLayout><PermissionRoute moduleKey="fluxo-caixa"><FluxoCaixa /></PermissionRoute></ProtectedLayout>} />
      <Route path="/api" element={<ProtectedLayout><PermissionRoute moduleKey="api"><ApiKeys /></PermissionRoute></ProtectedLayout>} />
      <Route path="/api/docs" element={<ProtectedLayout><PermissionRoute moduleKey="api-docs"><ApiDocumentation /></PermissionRoute></ProtectedLayout>} />
      <Route path="/telegram" element={<ProtectedLayout><PermissionRoute moduleKey="telegram"><TelegramBot /></PermissionRoute></ProtectedLayout>} />
      <Route
        path="/usuarios" 
        element={
          <ProtectedLayout>
            <MasterRoute>
              <Usuarios />
            </MasterRoute>
          </ProtectedLayout>
        } 
      />
      <Route path="/operador" element={<OperatorGuard><OperatorDashboard /></OperatorGuard>} />
      <Route path="/operador/tenants/:tenantId" element={<OperatorGuard><OperatorTenantDetail /></OperatorGuard>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => {
  const [queryClient] = useState(() => new QueryClient());
  return (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TenantProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
      </TenantProvider>
    </AuthProvider>
  </QueryClientProvider>
  );
};

export default App;
