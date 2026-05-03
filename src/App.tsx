import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppSidebar } from "@/components/AppSidebar";
import { AlertasNotificacao } from "@/components/AlertasNotificacao";
import { useMyPermissions, hasModuleAccess, ROUTE_TO_MODULE } from "@/hooks/useUserPermissions";
import type { ModuleKey } from "@/hooks/useUserPermissions";
import Auth from "./pages/Auth";
import Insights from "./pages/Insights";
import Receitas from "./pages/Receitas";
import Despesas from "./pages/Despesas";
import Categorias from "./pages/Categorias";
import Bancos from "./pages/Bancos";
import FluxoCaixa from "./pages/FluxoCaixa";
import ApiKeys from "./pages/ApiKeys";
import ApiDocumentation from "./pages/ApiDocumentation";
import Usuarios from "./pages/Usuarios";
import AISettings from "./pages/AISettings";
import TelegramBot from "./pages/TelegramBot";
import ExportCredentials from "./pages/ExportCredentials";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

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
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (role !== 'master') {
    return <Navigate to="/insights" replace />;
  }

  return <>{children}</>;
}

function PermissionRoute({ moduleKey, children }: { moduleKey: ModuleKey; children: React.ReactNode }) {
  const { role, loading } = useAuth();
  const { data: permissions, isLoading } = useMyPermissions();

  if (loading || isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasModuleAccess(permissions || [], moduleKey, role)) {
    return <Navigate to="/insights" replace />;
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
      <Route path="/auth" element={user ? <Navigate to="/insights" replace /> : <Auth />} />
      <Route path="/" element={<Navigate to={user ? "/insights" : "/auth"} replace />} />
      <Route path="/insights" element={<ProtectedLayout><PermissionRoute moduleKey="insights"><Insights /></PermissionRoute></ProtectedLayout>} />
      <Route path="/receitas" element={<ProtectedLayout><PermissionRoute moduleKey="receitas"><Receitas /></PermissionRoute></ProtectedLayout>} />
      <Route path="/despesas" element={<ProtectedLayout><PermissionRoute moduleKey="despesas"><Despesas /></PermissionRoute></ProtectedLayout>} />
      <Route path="/categorias" element={<ProtectedLayout><PermissionRoute moduleKey="categorias"><Categorias /></PermissionRoute></ProtectedLayout>} />
      <Route path="/bancos" element={<ProtectedLayout><PermissionRoute moduleKey="bancos"><Bancos /></PermissionRoute></ProtectedLayout>} />
      <Route path="/fluxo-caixa" element={<ProtectedLayout><PermissionRoute moduleKey="fluxo-caixa"><FluxoCaixa /></PermissionRoute></ProtectedLayout>} />
      <Route path="/api" element={<ProtectedLayout><PermissionRoute moduleKey="api"><ApiKeys /></PermissionRoute></ProtectedLayout>} />
      <Route path="/api/docs" element={<ProtectedLayout><PermissionRoute moduleKey="api-docs"><ApiDocumentation /></PermissionRoute></ProtectedLayout>} />
      <Route path="/telegram" element={<ProtectedLayout><PermissionRoute moduleKey="telegram"><TelegramBot /></PermissionRoute></ProtectedLayout>} />
      <Route path="/ai-settings" element={<ProtectedLayout><MasterRoute><AISettings /></MasterRoute></ProtectedLayout>} />
      <Route path="/export-credentials" element={<ExportCredentials />} />
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
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
