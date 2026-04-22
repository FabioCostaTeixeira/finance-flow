import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const ALL_MODULES = [
  { key: 'insights', label: 'Insights IA', parent: null },
  { key: 'receitas', label: 'Receitas', parent: null },
  { key: 'despesas', label: 'Despesas', parent: null },
  { key: 'categorias', label: 'Categorias', parent: null },
  { key: 'bancos', label: 'Bancos', parent: null },
  { key: 'fluxo-caixa', label: 'Fluxo de Caixa', parent: null },
  { key: 'api', label: 'API', parent: null },
  { key: 'api-docs', label: 'Documentação API', parent: 'api' },
  { key: 'telegram', label: 'Bot Telegram', parent: null },
  { key: 'ai-settings', label: 'Configurações de IA', parent: null },
  { key: 'usuarios', label: 'Usuários', parent: null },
] as const;

export type ModuleKey = typeof ALL_MODULES[number]['key'];

// Map route paths to module keys
export const ROUTE_TO_MODULE: Record<string, ModuleKey> = {
  '/insights': 'insights',
  '/receitas': 'receitas',
  '/despesas': 'despesas',
  '/categorias': 'categorias',
  '/bancos': 'bancos',
  '/fluxo-caixa': 'fluxo-caixa',
  '/api': 'api',
  '/api/docs': 'api-docs',
  '/telegram': 'telegram',
  '/ai-settings': 'ai-settings',
  '/usuarios': 'usuarios',
};

type Permission = {
  id: string;
  user_id: string;
  module_key: string;
  allowed: boolean;
};

// Fetch permissions for all users (master view)
export function useAllPermissions() {
  return useQuery({
    queryKey: ['user_permissions_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*');
      if (error) throw error;
      return data as Permission[];
    },
  });
}

// Fetch permissions for the current user
export function useMyPermissions() {
  return useQuery({
    queryKey: ['user_permissions_mine'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;
      return data as Permission[];
    },
  });
}

// Toggle a permission (upsert)
export function useTogglePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, moduleKey, allowed }: { userId: string; moduleKey: string; allowed: boolean }) => {
      const { data, error } = await supabase
        .from('user_permissions')
        .upsert(
          { user_id: userId, module_key: moduleKey, allowed },
          { onConflict: 'user_id,module_key' }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_permissions_all'] });
      queryClient.invalidateQueries({ queryKey: ['user_permissions_mine'] });
    },
  });
}

// Helper: check if user has permission from a permissions array
export function hasModuleAccess(permissions: Permission[], moduleKey: string, role: string | null): boolean {
  if (role === 'master') return true;
  const perm = permissions.find(p => p.module_key === moduleKey);
  return perm?.allowed ?? false;
}
