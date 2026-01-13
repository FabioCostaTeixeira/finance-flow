import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Banco {
  id: string;
  nome: string;
  created_at: string;
}

export interface BancoComSaldo extends Banco {
  total_entradas: number;
  total_saidas: number;
  saldo: number;
}

// Hook to get simple list of banks (for dropdowns)
export function useBancos() {
  return useQuery({
    queryKey: ['bancos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bancos')
        .select('*')
        .order('nome', { ascending: true });
      if (error) throw error;
      return data as Banco[];
    },
  });
}

export interface BancoComSaldoRPC {
  banco_id: string;
  banco_nome: string;
  total_entradas: number;
  total_saidas: number;
  saldo: number;
}

// Hook to get banks with their calculated balances
export function useBancosComSaldos(startDate?: Date, endDate?: Date) {
  const queryKey = ['bancosComSaldos', startDate, endDate];

  return useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_bancos_com_saldos', {
        data_inicio: startDate?.toISOString().split('T')[0],
        data_fim: endDate?.toISOString().split('T')[0],
      });

      if (error) throw error;
      
      // Map RPC result to BancoComSaldo
      return (data as BancoComSaldoRPC[]).map((item) => ({
        id: item.banco_id,
        nome: item.banco_nome,
        created_at: '',
        total_entradas: item.total_entradas,
        total_saidas: item.total_saidas,
        saldo: item.saldo,
      })) as BancoComSaldo[];
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
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bancos'] });
      queryClient.invalidateQueries({ queryKey: ['bancosComSaldos'] });
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
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bancos'] });
      queryClient.invalidateQueries({ queryKey: ['bancosComSaldos'] });
    },
  });
}

export function useDeleteBanco() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bancos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bancos'] });
      queryClient.invalidateQueries({ queryKey: ['bancosComSaldos'] });
    },
  });
}
