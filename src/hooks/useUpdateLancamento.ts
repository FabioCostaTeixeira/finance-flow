import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UpdateLancamentoInput {
  id: string;
  data_vencimento?: Date;
  cliente_credor?: string;
  valor?: number;
  banco_id?: string | null;
  categoria_id?: string | null;
  observacao?: string | null;
}

export function useUpdateLancamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateLancamentoInput) => {
      const updateData: Record<string, unknown> = {};
      
      if (input.data_vencimento !== undefined) {
        updateData.data_vencimento = input.data_vencimento.toISOString().split('T')[0];
      }
      if (input.cliente_credor !== undefined) {
        updateData.cliente_credor = input.cliente_credor;
      }
      if (input.valor !== undefined) {
        updateData.valor = input.valor;
      }
      if (input.banco_id !== undefined) {
        updateData.banco_id = input.banco_id;
      }
      if (input.categoria_id !== undefined) {
        updateData.categoria_id = input.categoria_id;
      }
      if (input.observacao !== undefined) {
        updateData.observacao = input.observacao;
      }

      const { data, error } = await supabase
        .from('lancamentos')
        .update(updateData)
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
    },
  });
}
