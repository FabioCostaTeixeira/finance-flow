import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface ApiKey {
  id: string;
  nome: string;
  chave: string;
  ativa: boolean;
  ultimo_acesso: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiAccessLog {
  id: string;
  api_key_id: string;
  endpoint: string;
  ip_address: string | null;
  user_agent: string | null;
  response_status: number | null;
  created_at: string;
}

export function useApiKeys() {
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ApiKey[];
    },
  });
}

export function useApiAccessLogs(apiKeyId?: string) {
  return useQuery({
    queryKey: ['api-access-logs', apiKeyId],
    queryFn: async () => {
      let query = supabase
        .from('api_access_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (apiKeyId) {
        query = query.eq('api_key_id', apiKeyId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ApiAccessLog[];
    },
    enabled: !!apiKeyId,
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (nome: string) => {
      const chave = `mk_${crypto.randomUUID().replace(/-/g, '')}`;
      
      const { data, error } = await supabase
        .from('api_keys')
        .insert({ nome, chave })
        .select()
        .single();

      if (error) throw error;
      return data as ApiKey;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast({ title: 'Sucesso', description: 'Chave API criada com sucesso.' });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Não foi possível criar a chave API.', variant: 'destructive' });
    },
  });
}

export function useToggleApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ativa }: { id: string; ativa: boolean }) => {
      const { error } = await supabase
        .from('api_keys')
        .update({ ativa })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast({ title: 'Sucesso', description: 'Status da chave atualizado.' });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Não foi possível atualizar a chave.', variant: 'destructive' });
    },
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast({ title: 'Sucesso', description: 'Chave API excluída.' });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Não foi possível excluir a chave.', variant: 'destructive' });
    },
  });
}
