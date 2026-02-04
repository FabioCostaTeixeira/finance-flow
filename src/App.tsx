import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppSidebar } from "@/components/AppSidebar";
import { AlertasNotificacao } from "@/components/AlertasNotificacao";
import Auth from "./pages/Auth";
import Insights from "./pages/Insights";
import Receitas from "./pages/Receitas";
import Despesas from "./pages/Despesas";
import Categorias from "./pages/Categorias";
import Bancos from "./pages/Bancos";
import ApiKeys from "./pages/ApiKeys";
import ApiDocumentation from "./pages/ApiDocumentation";
import Usuarios from "./pages/Usuarios";
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
      {children}
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
      <Route path="/insights" element={<ProtectedLayout><Insights /></ProtectedLayout>} />
      <Route path="/receitas" element={<ProtectedLayout><Receitas /></ProtectedLayout>} />
      <Route path="/despesas" element={<ProtectedLayout><Despesas /></ProtectedLayout>} />
      <Route path="/categorias" element={<ProtectedLayout><Categorias /></ProtectedLayout>} />
      <Route path="/bancos" element={<ProtectedLayout><Bancos /></ProtectedLayout>} />
      <Route path="/api" element={<ProtectedLayout><ApiKeys /></ProtectedLayout>} />
      <Route path="/api/docs" element={<ProtectedLayout><ApiDocumentation /></ProtectedLayout>} />
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
