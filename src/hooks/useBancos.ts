import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toISODateLocal } from '@/lib/date';
import { useTenant } from '@/contexts/TenantContext';

export interface Banco {
  id: string;
  nome: string;
  created_at: string;
}

export interface BancoComSaldo extends Banco {
  total_entradas: number;
  total_saidas: number;
  saldo: number;
  entradas_recebidas: number;
  entradas_a_receber: number;
  saidas_pagas: number;
  saidas_a_pagar: number;
}

// Hook to get simple list of banks (for dropdowns)
export function useBancos() {
  const { activeTenant } = useTenant();
  return useQuery({
    queryKey: ['bancos', activeTenant?.id], enabled: !!activeTenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bancos')
        .select('*')
        .order('nome', { ascending: true });
      if (error) throw error;
      return data as Banco[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export interface BancoComSaldoRPC {
  banco_id: string;
  banco_nome: string;
  total_entradas: number;
  total_saidas: number;
  saldo: number;
  entradas_recebidas: number;
  entradas_a_receber: number;
  saidas_pagas: number;
  saidas_a_pagar: number;
}

// Hook to get banks with their calculated balances
export function useBancosComSaldos(startDate?: Date, endDate?: Date) {
  const { activeTenant } = useTenant();
  const queryKey = ['bancosComSaldos', activeTenant?.id, startDate, endDate];

  return useQuery({
    queryKey, enabled: !!activeTenant,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_bancos_com_saldos', {
        data_inicio: startDate ? toISODateLocal(startDate) : undefined,
        data_fim: endDate ? toISODateLocal(endDate) : undefined,
      });

      if (error) throw error;
      
      // Map RPC result to BancoComSaldo
      return (data as BancoComSaldoRPC[]).map((item) => ({
        id: item.banco_id,
        nome: item.banco_nome,
        created_at: '',
        total_entradas: item.total_entradas ?? 0,
        total_saidas: item.total_saidas ?? 0,
        saldo: item.saldo ?? 0,
        entradas_recebidas: item.entradas_recebidas ?? 0,
        entradas_a_receber: item.entradas_a_receber ?? 0,
        saidas_pagas: item.saidas_pagas ?? 0,
        saidas_a_pagar: item.saidas_a_pagar ?? 0,
      })) as BancoComSaldo[];
    },
  });
}


export function useCreateBanco() {
  const queryClient = useQueryClient();
  const { activeTenant } = useTenant();
  return useMutation({
    mutationFn: async (nome: string) => {
      if (!activeTenant) throw new Error('Nenhuma organização ativa');
      const { data, error } = await supabase
        .from('bancos')
        .insert({ nome, tenant_id: activeTenant.id })
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
