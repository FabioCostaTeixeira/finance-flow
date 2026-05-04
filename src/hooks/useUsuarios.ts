import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
  return useQuery({
    queryKey: ['profiles'],
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
  return useQuery({
    queryKey: ['user_roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (error) throw error;
      return data as UserRole[];
    },
  });
}

export function useCreateUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userData: { email: string; password: string; nome: string; role: 'admin' | 'user' }) => {
      const { data, error } = await supabase.functions.invoke('create-user', { body: userData });
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
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('delete-user', { body: { userId } });
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
