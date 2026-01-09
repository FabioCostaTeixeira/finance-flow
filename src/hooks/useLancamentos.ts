import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calcularRecorrencia, gerarRecorrenciaId, Frequencia } from '@/lib/recurrence';

export interface Lancamento {
  id: string;
  data_vencimento: string;
  cliente_credor: string;
  valor: number;
  valor_pago: number;
  banco_id: string | null;
  status: 'a_receber' | 'recebido' | 'pago' | 'a_pagar' | 'parcial';
  tipo: 'receita' | 'despesa';
  categoria_id: string | null;
  recorrencia_id: string | null;
  parcela_atual: number;
  total_parcelas: number;
  observacao: string | null;
  data_pagamento: string | null;
  created_at: string;
  updated_at: string;
}

export interface LancamentoWithCategoria extends Lancamento {
  categorias: {
    id: string;
    nome: string;
    categoria_pai_id: string | null;
  } | null;
  bancos: {
    id: string;
    nome: string;
  } | null;
}

export interface LancamentoWithCategoria extends Lancamento {
  categorias: {
    id: string;
    nome: string;
    categoria_pai_id: string | null;
  } | null;
}

export interface CreateLancamentoInput {
  data_vencimento: Date;
  cliente_credor: string;
  valor: number;
  banco_id?: string;
  tipo: 'receita' | 'despesa';
  categoria_id?: string;
  observacao?: string;
  recorrente?: boolean;
  frequencia?: Frequencia;
  qtd_parcelas?: number;
}

export function useLancamentos(tipo?: 'receita' | 'despesa') {
  return useQuery({
    queryKey: ['lancamentos', tipo],
    queryFn: async () => {
      let query = supabase
        .from('lancamentos')
        .select(`
          *,
          categorias (
            id,
            nome,
            categoria_pai_id
          ),
          bancos (
            id,
            nome
          )
        `)
        .order('data_vencimento', { ascending: true });

      if (tipo) {
        query = query.eq('tipo', tipo);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as LancamentoWithCategoria[];
    },
  });
}

export function useCreateLancamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateLancamentoInput) => {
      const baseStatus: 'a_receber' | 'a_pagar' = input.tipo === 'receita' ? 'a_receber' : 'a_pagar';

      if (input.recorrente && input.frequencia && input.qtd_parcelas) {
        // Gera lançamentos recorrentes
        const recorrenciaId = gerarRecorrenciaId();
        const parcelas = calcularRecorrencia(
          input.data_vencimento,
          input.frequencia,
          input.qtd_parcelas
        );

        const lancamentos = parcelas.map((parcela) => ({
          data_vencimento: parcela.data_vencimento.toISOString().split('T')[0],
          cliente_credor: input.cliente_credor,
          valor: input.valor,
          banco_id: input.banco_id || null,
          status: baseStatus as 'a_receber' | 'a_pagar',
          tipo: input.tipo,
          categoria_id: input.categoria_id || null,
          observacao: input.observacao || null,
          recorrencia_id: recorrenciaId,
          parcela_atual: parcela.parcela_atual,
          total_parcelas: parcela.total_parcelas,
        }));

        const { data, error } = await supabase
          .from('lancamentos')
          .insert(lancamentos)
          .select();

        if (error) throw error;
        return data;
      } else {
        // Lançamento único
        const { data, error } = await supabase
          .from('lancamentos')
          .insert({
            data_vencimento: input.data_vencimento.toISOString().split('T')[0],
            cliente_credor: input.cliente_credor,
            valor: input.valor,
            banco_id: input.banco_id || null,
            status: baseStatus,
            tipo: input.tipo,
            categoria_id: input.categoria_id || null,
            observacao: input.observacao || null,
            parcela_atual: 1,
            total_parcelas: 1,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
    },
  });
}

export function useBaixarLancamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      valorPago,
      dataPagamento,
    }: {
      id: string;
      valorPago: number;
      dataPagamento: Date;
    }) => {
      // Busca o lançamento atual
      const { data: lancamento, error: fetchError } = await supabase
        .from('lancamentos')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const valorTotal = Number(lancamento.valor);
      const valorPagoAtual = Number(lancamento.valor_pago) || 0;
      const novoValorPago = valorPagoAtual + valorPago;

      let novoStatus: 'recebido' | 'pago' | 'parcial';
      if (novoValorPago >= valorTotal) {
        novoStatus = lancamento.tipo === 'receita' ? 'recebido' : 'pago';
      } else {
        novoStatus = 'parcial';
      }

      const { data, error } = await supabase
        .from('lancamentos')
        .update({
          valor_pago: novoValorPago,
          status: novoStatus,
          data_pagamento: dataPagamento.toISOString().split('T')[0],
        })
        .eq('id', id)
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

export function useDeleteLancamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('lancamentos')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
    },
  });
}
