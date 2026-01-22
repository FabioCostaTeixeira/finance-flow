import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toISODateLocal } from '@/lib/date';

export interface CreateTransferenciaInput {
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
        });

      if (errorEntrada) throw errorEntrada;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      queryClient.invalidateQueries({ queryKey: ['bancos'] });
    },
  });
}
