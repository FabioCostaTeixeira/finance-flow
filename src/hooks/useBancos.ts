import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Banco {
  id: string;
  nome: string;
  created_at: string;
  updated_at: string;
}

export interface BancoComSaldo {
  banco_id: string;
  banco_nome: string;
  total_entradas: number;
  total_saidas: number;
  saldo: number;
}

export function useBancos() {
  return useQuery({
    queryKey: ['bancos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bancos')
        .select('*')
        .order('nome');

      if (error) throw error;
      return data as Banco[];
    },
  });
}

export function useBancosComSaldos(dataInicio?: Date, dataFim?: Date) {
  return useQuery({
    queryKey: ['bancos-saldos', dataInicio?.toISOString(), dataFim?.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_bancos_com_saldos', {
        data_inicio: dataInicio ? dataInicio.toISOString().split('T')[0] : null,
        data_fim: dataFim ? dataFim.toISOString().split('T')[0] : null,
      });

      if (error) throw error;
      return data as BancoComSaldo[];
    },
  });
}

export function useCreateBanco() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (nome: string) => {
      const { data, error } = await supabase
        .from('bancos')
        .insert({ nome })
        .select()
        .single();

      if (error) throw error;
      return data as Banco;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bancos'] });
      queryClient.invalidateQueries({ queryKey: ['bancos-saldos'] });
    },
  });
}

export function useUpdateBanco() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { data, error } = await supabase
        .from('bancos')
        .update({ nome })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Banco;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bancos'] });
      queryClient.invalidateQueries({ queryKey: ['bancos-saldos'] });
    },
  });
}

export function useDeleteBanco() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bancos')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bancos'] });
      queryClient.invalidateQueries({ queryKey: ['bancos-saldos'] });
    },
  });
}
