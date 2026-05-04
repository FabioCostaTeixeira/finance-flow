import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, addMonths, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { calcularRecorrencia, gerarRecorrenciaId, Frequencia } from '@/lib/recurrence';
import { toISODateLocal } from '@/lib/date';
import { Banco } from './useBancos';
import { StatusLancamento } from '@/lib/statusUtils';

export interface Lancamento {
  id: string;
  data_vencimento: string;
  cliente_credor: string;
  valor: number;
  valor_pago: number;
  banco_id: string | null;
  status: StatusLancamento;
  tipo: 'receita' | 'despesa';
  categoria_id: string | null;
  recorrencia_id: string | null;
  parcela_atual: number;
  total_parcelas: number;
  observacao: string | null;
  data_pagamento: string | null;
  transferencia_vinculo_id: string | null;
  frequencia: string | null;
  created_at: string;
  updated_at: string;
}

export interface LancamentoExtendido extends Lancamento {
  categorias: {
    id: string;
    nome: string;
    categoria_pai_id: string | null;
  } | null;
  bancos: Pick<Banco, 'id' | 'nome'> | null;
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
  lancar_como_pago?: boolean;
  data_pagamento?: Date;
}

export function useLancamentos(tipo?: 'receita' | 'despesa') {
  return useQuery({
    queryKey: ['lancamentos', tipo],
    queryFn: async () => {
      let query = supabase
        .from('lancamentos')
        .select(`
          *,
          categorias ( id, nome, categoria_pai_id ),
          bancos ( id, nome )
        `)
        .order('data_vencimento', { ascending: false });

      if (tipo) {
        query = query.eq('tipo', tipo);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as LancamentoExtendido[];
    },
  });
}

export function useCreateLancamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateLancamentoInput) => {
      const baseStatus: 'a_receber' | 'a_pagar' = input.tipo === 'receita' ? 'a_receber' : 'a_pagar';

      if (input.recorrente && input.frequencia) {
        // Gera lançamentos recorrentes
        // Se qtd_parcelas não informado ou 0, é infinito → gera 12 parcelas com total_parcelas=0
        const isInfinite = !input.qtd_parcelas || input.qtd_parcelas === 0;
        const qtdParaGerar = isInfinite ? 12 : input.qtd_parcelas;
        const recorrenciaId = gerarRecorrenciaId();
        const parcelas = calcularRecorrencia(
          input.data_vencimento,
          input.frequencia,
          qtdParaGerar
        );

        const lancamentos = parcelas.map((parcela) => ({
          data_vencimento: toISODateLocal(parcela.data_vencimento),
          cliente_credor: input.cliente_credor,
          valor: input.valor,
          banco_id: input.banco_id || null,
          status: baseStatus as 'a_receber' | 'a_pagar',
          tipo: input.tipo,
          categoria_id: input.categoria_id || null,
          observacao: input.observacao || null,
          recorrencia_id: recorrenciaId,
          parcela_atual: parcela.parcela_atual,
          total_parcelas: isInfinite ? 0 : parcela.total_parcelas,
          frequencia: input.frequencia,
        }));

        const { data, error } = await supabase
          .from('lancamentos')
          .insert(lancamentos)
          .select();

        if (error) throw error;
        return data;
      } else {
        // Lançamento único
        // Para receitas: marcar como 'recebido', para despesas: marcar como 'pago'
        const shouldMarkAsQuitado = input.lancar_como_pago;
        const quitadoStatus = input.tipo === 'receita' ? 'recebido' : 'pago';
        const finalStatus = shouldMarkAsQuitado ? quitadoStatus : baseStatus;

        const insertData: Record<string, unknown> = {
          data_vencimento: toISODateLocal(input.data_vencimento),
          cliente_credor: input.cliente_credor,
          valor: input.valor,
          banco_id: input.banco_id || null,
          status: finalStatus,
          tipo: input.tipo,
          categoria_id: input.categoria_id || null,
          observacao: input.observacao || null,
          parcela_atual: 1,
          total_parcelas: 1,
        };

        // Se marcado como quitado (pago/recebido), adicionar valor_pago e data_pagamento
        if (shouldMarkAsQuitado) {
          insertData.valor_pago = input.valor;
          insertData.data_pagamento = input.data_pagamento 
            ? toISODateLocal(input.data_pagamento) 
            : toISODateLocal(new Date());
        }

        const { data, error } = await supabase
          .from('lancamentos')
          .insert(insertData as any)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      queryClient.invalidateQueries({ queryKey: ['bancosComSaldos'] });
    },
  });
}

function proximaData(dataStr: string, frequencia: string): Date {
  const data = parseISO(dataStr);
  switch (frequencia) {
    case 'semanal': return addDays(data, 7);
    case 'mensal': return addMonths(data, 1);
    case 'trimestral': return addMonths(data, 3);
    case 'semestral': return addMonths(data, 6);
    default: return addMonths(data, 1);
  }
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
          data_pagamento: format(dataPagamento, 'yyyy-MM-dd'),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Recorrência infinita: se total_parcelas === 0 e status ficou quitado, cria nova parcela
      if (
        lancamento.total_parcelas === 0 &&
        lancamento.recorrencia_id &&
        (novoStatus === 'recebido' || novoStatus === 'pago')
      ) {
        // Busca a última parcela da série
        const { data: ultimaParcela } = await supabase
          .from('lancamentos')
          .select('*')
          .eq('recorrencia_id', lancamento.recorrencia_id)
          .order('data_vencimento', { ascending: false })
          .limit(1)
          .single();

        if (ultimaParcela) {
          const freq = lancamento.frequencia || 'mensal';
          const novaData = proximaData(ultimaParcela.data_vencimento, freq);
          const baseStatus = lancamento.tipo === 'receita' ? 'a_receber' : 'a_pagar';

          await supabase.from('lancamentos').insert({
            data_vencimento: toISODateLocal(novaData),
            cliente_credor: lancamento.cliente_credor,
            valor: lancamento.valor,
            banco_id: lancamento.banco_id,
            status: baseStatus,
            tipo: lancamento.tipo,
            categoria_id: lancamento.categoria_id,
            observacao: lancamento.observacao,
            recorrencia_id: lancamento.recorrencia_id,
            parcela_atual: (ultimaParcela.parcela_atual || 0) + 1,
            total_parcelas: 0,
            frequencia: freq,
          } as any);
        }
      }

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

export function useDeleteRecurringLancamentos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recorrenciaId: string) => {
      const { data, error } = await supabase
        .from('lancamentos')
        .delete()
        .eq('recorrencia_id', recorrenciaId)
        .select('id');

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
    },
  });
}
