import { useAuth } from '@/contexts/AuthContext';
import { useWhoAmIOperator } from '@/hooks/useOperatorConsole';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Navigate } from 'react-router-dom';

/**
 * Gate de rota do console de operador. Não usa TenantContext nem AppSidebar de propósito:
 * esta é uma área administrativa interna, separada do app de tenant.
 */
export function OperatorGuard({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <OperatorCheck>{children}</OperatorCheck>;
}

function OperatorCheck({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isError } = useWhoAmIOperator();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !data?.isOperator) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center gap-3 bg-background text-center px-4">
        <div className="glass-card flex flex-col items-center gap-3 px-8 py-10 max-w-md">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 border border-destructive/20">
            <ShieldAlert className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold">Acesso restrito</h1>
          <p className="text-muted-foreground">
            Esta área é exclusiva para operadores de plataforma. Sua conta não tem essa permissão.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
