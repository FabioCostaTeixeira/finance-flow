import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { TenantProvider, useTenant } from "@/contexts/TenantContext";
import { AppSidebar } from "@/components/AppSidebar";
import { AlertasNotificacao } from "@/components/AlertasNotificacao";
import Auth from "./pages/Auth";
import { Loader2 } from "lucide-react";

// Rotas carregadas sob demanda (code-splitting): reduz o chunk inicial,
// já que a maioria dessas telas não é acessada em toda sessão.
const Receitas = lazy(() => import("./pages/Receitas"));
const Despesas = lazy(() => import("./pages/Despesas"));
const Categorias = lazy(() => import("./pages/Categorias"));
const Bancos = lazy(() => import("./pages/Bancos"));
const FluxoCaixa = lazy(() => import("./pages/FluxoCaixa"));
const ApiKeys = lazy(() => import("./pages/ApiKeys"));
const ApiDocumentation = lazy(() => import("./pages/ApiDocumentation"));
const Usuarios = lazy(() => import("./pages/Usuarios"));
const NotFound = lazy(() => import("./pages/NotFound"));
const OperatorGuard = lazy(() => import("./pages/operador/OperatorGuard").then((m) => ({ default: m.OperatorGuard })));
const OperatorDashboard = lazy(() => import("./pages/operador/OperatorDashboard"));
const OperatorTenantDetail = lazy(() => import("./pages/operador/OperatorTenantDetail"));

function RouteFallback() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

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
    <Suspense fallback={<RouteFallback />}>
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
    </Suspense>
  );
}

const App = () => {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Dados financeiros não mudam a cada segundo: evita refetch agressivo
        // a cada foco de janela/troca de aba, sem deixar de refazer a query
        // quando o usuário navega de volta depois de um tempo (mutations locais
        // continuam invalidando via queryClient.invalidateQueries normalmente).
        staleTime: 1000 * 60, // 1 minuto
        gcTime: 1000 * 60 * 10, // 10 minutos
      },
    },
  }));
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
