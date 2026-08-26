import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

export type Profile = {
  id: string;
  user_id: string;
  email: string;
  nome: string | null;
  created_at: string;
};

export type UserRole = {
  user_id: string;
  role: 'master' | 'admin' | 'user';
};

export function useProfiles() {
  const { activeTenant } = useTenant();
  return useQuery({
    queryKey: ['profiles', activeTenant?.id], enabled: !!activeTenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Profile[];
    },
  });
}

export function useUserRoles() {
  const { activeTenant } = useTenant();
  return useQuery({
    queryKey: ['tenant_members', activeTenant?.id], enabled: !!activeTenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_members')
        .select('user_id, role').eq('tenant_id', activeTenant!.id);
      if (error) throw error;
      return data as UserRole[];
    },
  });
}

export function useCreateUsuario() {
  const queryClient = useQueryClient();
  const { activeTenant } = useTenant();
  return useMutation({
    mutationFn: async (userData: { email: string; password: string; nome: string; role: 'admin' | 'user' }) => {
      if (!activeTenant) throw new Error('Nenhuma organização ativa');
      const { data, error } = await supabase.functions.invoke('create-user', { body: { ...userData, tenantId: activeTenant.id } });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['user_roles'] });
    },
  });
}

export function useDeleteUsuario() {
  const queryClient = useQueryClient();
  const { activeTenant } = useTenant();
  return useMutation({
    mutationFn: async (userId: string) => {
      if (!activeTenant) throw new Error('Nenhuma organização ativa');
      const { data, error } = await supabase.functions.invoke('delete-user', { body: { userId, tenantId: activeTenant.id } });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['user_roles'] });
    },
  });
}
