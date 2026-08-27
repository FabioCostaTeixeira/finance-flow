import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type OperatorRole = 'master' | 'admin' | 'user';

export type OperatorTenant = {
  id: string;
  nome: string;
  slug: string;
  plano: string;
  ativo: boolean;
  created_at: string;
};

export type OperatorMember = {
  user_id: string;
  role: OperatorRole;
  created_at: string;
  email: string | null;
  nome: string | null;
};

async function callOperatorConsole<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('operator-console', { body: { action, ...params } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}

/** Confirma se o usuário logado é operador de plataforma. Usado como gate de rota. */
export function useWhoAmIOperator() {
  return useQuery({
    queryKey: ['operator-console', 'whoami'],
    queryFn: () => callOperatorConsole<{ isOperator: boolean; userId: string; email: string | null }>('whoami'),
    retry: false,
  });
}

export function useOperatorTenants() {
  return useQuery({
    queryKey: ['operator-console', 'tenants'],
    queryFn: () => callOperatorConsole<{ tenants: OperatorTenant[] }>('list_tenants').then((d) => d.tenants),
  });
}

export function useCreateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { nome: string; slug: string }) =>
      callOperatorConsole<{ tenant: OperatorTenant }>('create_tenant', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['operator-console', 'tenants'] }),
  });
}

export function useUpdateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { tenant_id: string; nome?: string; slug?: string }) =>
      callOperatorConsole<{ tenant: OperatorTenant }>('update_tenant', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['operator-console', 'tenants'] }),
  });
}

export function useToggleTenantAtivo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { tenant_id: string; ativo: boolean }) =>
      callOperatorConsole<{ tenant: OperatorTenant }>('toggle_tenant_ativo', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['operator-console', 'tenants'] }),
  });
}

export function useOperatorMembers(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['operator-console', 'members', tenantId],
    enabled: !!tenantId,
    queryFn: () => callOperatorConsole<{ members: OperatorMember[] }>('list_members', { tenant_id: tenantId }).then((d) => d.members),
  });
}

export function useAddMember(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; role: OperatorRole }) =>
      callOperatorConsole<{ success: true; userId: string }>('add_member', { tenant_id: tenantId, ...input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['operator-console', 'members', tenantId] }),
  });
}

export function useUpdateMemberRole(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { user_id: string; role: OperatorRole }) =>
      callOperatorConsole<{ success: true }>('update_member_role', { tenant_id: tenantId, ...input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['operator-console', 'members', tenantId] }),
  });
}

export function useRemoveMember(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { user_id: string }) =>
      callOperatorConsole<{ success: true }>('remove_member', { tenant_id: tenantId, ...input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['operator-console', 'members', tenantId] }),
  });
}
