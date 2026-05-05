import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addDays, addMonths, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toISODateLocal } from '@/lib/date';
import type { LancamentoRowWithFrequencia } from '@/integrations/supabase/types-extended';

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
        updateData.data_vencimento = toISODateLocal(input.data_vencimento);
      }
      if (input.cliente_credor !== undefined) updateData.cliente_credor = input.cliente_credor;
      if (input.valor !== undefined) updateData.valor = input.valor;
      if (input.banco_id !== undefined) updateData.banco_id = input.banco_id;
      if (input.categoria_id !== undefined) updateData.categoria_id = input.categoria_id;
      if (input.observacao !== undefined) updateData.observacao = input.observacao;

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

export interface UpdateRecurringInput {
  recorrencia_id: string;
  /** The ID of the lancamento being edited (used as reference for date recalculation) */
  lancamento_id: string;
  data_vencimento?: Date;
  cliente_credor?: string;
  valor?: number;
  banco_id?: string | null;
  categoria_id?: string | null;
  observacao?: string | null;
}

function addFrequencia(date: Date, frequencia: string, multiplier: number): Date {
  switch (frequencia) {
    case 'semanal': return addDays(date, 7 * multiplier);
    case 'mensal': return addMonths(date, 1 * multiplier);
    case 'trimestral': return addMonths(date, 3 * multiplier);
    case 'semestral': return addMonths(date, 6 * multiplier);
    default: return addMonths(date, 1 * multiplier);
  }
}

export function useUpdateRecurringLancamentos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateRecurringInput) => {
      // Fetch all open lancamentos in this series, sorted by date
      const { data: openLancamentos, error: fetchError } = await supabase
        .from('lancamentos')
        .select('*')
        .eq('recorrencia_id', input.recorrencia_id)
        .in('status', ['a_receber', 'a_pagar', 'parcial', 'atrasado', 'vencida'])
        .order('data_vencimento', { ascending: true });

      if (fetchError) throw fetchError;
      if (!openLancamentos || openLancamentos.length === 0) return [];

      // Determine frequency from the first entry that has it, or default to 'mensal'
      const frequencia = (openLancamentos[0] as unknown as LancamentoRowWithFrequencia).frequencia || 'mensal';

      // Build non-date update fields
      const baseUpdate: Record<string, unknown> = {};
      if (input.cliente_credor !== undefined) baseUpdate.cliente_credor = input.cliente_credor;
      if (input.valor !== undefined) baseUpdate.valor = input.valor;
      if (input.banco_id !== undefined) baseUpdate.banco_id = input.banco_id;
      if (input.categoria_id !== undefined) baseUpdate.categoria_id = input.categoria_id;
      if (input.observacao !== undefined) baseUpdate.observacao = input.observacao;

      if (input.data_vencimento !== undefined) {
        // Recalculate dates maintaining frequency intervals
        // The edited lancamento gets the new date, subsequent ones get incremented
        const editedIndex = openLancamentos.findIndex(l => l.id === input.lancamento_id);
        const startIndex = editedIndex >= 0 ? editedIndex : 0;
        const newStartDate = input.data_vencimento;

        const promises = openLancamentos.map((lanc, i) => {
          const offset = i - startIndex;
          const newDate = addFrequencia(newStartDate, frequencia, offset);
          return supabase
            .from('lancamentos')
            .update({ ...baseUpdate, data_vencimento: toISODateLocal(newDate) })
            .eq('id', lanc.id)
            .select()
            .single();
        });

        const results = await Promise.all(promises);
        const errors = results.filter(r => r.error);
        if (errors.length > 0) throw errors[0].error;
        return results.map(r => r.data);
      } else {
        // No date change: bulk update all open entries with same fields
        const { data, error } = await supabase
          .from('lancamentos')
          .update(baseUpdate)
          .eq('recorrencia_id', input.recorrencia_id)
          .in('status', ['a_receber', 'a_pagar', 'parcial', 'atrasado', 'vencida'])
          .select();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
    },
  });
}
