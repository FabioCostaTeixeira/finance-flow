import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toISODateLocal } from '@/lib/date';

export interface CreateTransferenciaInput {
  data: Date;
  banco_origem_id: string;
  banco_destino_id: string;
  valor: number;
}

export interface UpdateTransferenciaInput {
  vinculo_id: string;
  data: Date;
  banco_origem_id: string;
  banco_destino_id: string;
  valor: number;
}

export function useCreateTransferencia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTransferenciaInput) => {
      const dataFormatada = toISODateLocal(input.data);
      const vinculoId = crypto.randomUUID();

      // Buscar nomes dos bancos para descrição
      const { data: bancoOrigem } = await supabase
        .from('bancos')
        .select('nome')
        .eq('id', input.banco_origem_id)
        .single();

      const { data: bancoDestino } = await supabase
        .from('bancos')
        .select('nome')
        .eq('id', input.banco_destino_id)
        .single();

      const nomeOrigem = bancoOrigem?.nome || 'Origem';
      const nomeDestino = bancoDestino?.nome || 'Destino';

      // Criar lançamento de saída (despesa) no banco de origem
      const { error: errorSaida } = await supabase
        .from('lancamentos')
        .insert({
          data_vencimento: dataFormatada,
          cliente_credor: `Transferência para ${nomeDestino}`,
          valor: input.valor,
          valor_pago: input.valor,
          banco_id: input.banco_origem_id,
          status: 'transferencia' as any,
          tipo: 'despesa',
          data_pagamento: dataFormatada,
          parcela_atual: 1,
          total_parcelas: 1,
          transferencia_vinculo_id: vinculoId,
        });

      if (errorSaida) throw errorSaida;

      // Criar lançamento de entrada (receita) no banco de destino
      const { error: errorEntrada } = await supabase
        .from('lancamentos')
        .insert({
          data_vencimento: dataFormatada,
          cliente_credor: `Transferência de ${nomeOrigem}`,
          valor: input.valor,
          valor_pago: input.valor,
          banco_id: input.banco_destino_id,
          status: 'transferencia' as any,
          tipo: 'receita',
          data_pagamento: dataFormatada,
          parcela_atual: 1,
          total_parcelas: 1,
          transferencia_vinculo_id: vinculoId,
        });

      if (errorEntrada) throw errorEntrada;

      return { success: true, vinculoId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      queryClient.invalidateQueries({ queryKey: ['bancos'] });
    },
  });
}

export function useUpdateTransferencia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateTransferenciaInput) => {
      const dataFormatada = toISODateLocal(input.data);

      // Buscar nomes dos bancos para descrição
      const { data: bancoOrigem } = await supabase
        .from('bancos')
        .select('nome')
        .eq('id', input.banco_origem_id)
        .single();

      const { data: bancoDestino } = await supabase
        .from('bancos')
        .select('nome')
        .eq('id', input.banco_destino_id)
        .single();

      const nomeOrigem = bancoOrigem?.nome || 'Origem';
      const nomeDestino = bancoDestino?.nome || 'Destino';

      // Atualizar lançamento de saída (despesa)
      const { error: errorSaida } = await supabase
        .from('lancamentos')
        .update({
          data_vencimento: dataFormatada,
          cliente_credor: `Transferência para ${nomeDestino}`,
          valor: input.valor,
          valor_pago: input.valor,
          banco_id: input.banco_origem_id,
          data_pagamento: dataFormatada,
        })
        .eq('transferencia_vinculo_id', input.vinculo_id)
        .eq('tipo', 'despesa');

      if (errorSaida) throw errorSaida;

      // Atualizar lançamento de entrada (receita)
      const { error: errorEntrada } = await supabase
        .from('lancamentos')
        .update({
          data_vencimento: dataFormatada,
          cliente_credor: `Transferência de ${nomeOrigem}`,
          valor: input.valor,
          valor_pago: input.valor,
          banco_id: input.banco_destino_id,
          data_pagamento: dataFormatada,
        })
        .eq('transferencia_vinculo_id', input.vinculo_id)
        .eq('tipo', 'receita');

      if (errorEntrada) throw errorEntrada;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      queryClient.invalidateQueries({ queryKey: ['bancos'] });
    },
  });
}

export function useDeleteTransferencia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vinculoId: string) => {
      // Deletar ambos os lançamentos vinculados
      const { error } = await supabase
        .from('lancamentos')
        .delete()
        .eq('transferencia_vinculo_id', vinculoId);

      if (error) throw error;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      queryClient.invalidateQueries({ queryKey: ['bancos'] });
    },
  });
}

// Hook para buscar o par de transferência vinculado
export function useGetTransferenciaPar() {
  return async (vinculoId: string) => {
    const { data, error } = await supabase
      .from('lancamentos')
      .select('*, bancos(*)')
      .eq('transferencia_vinculo_id', vinculoId);

    if (error) throw error;
    return data;
  };
}
