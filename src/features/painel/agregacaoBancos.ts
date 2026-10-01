import { endOfDay, isWithinInterval, parseISO, startOfDay } from 'date-fns';
import type { Banco } from '@/hooks/useBancos';
import type { LancamentoExtendido } from '@/hooks/useLancamentos';
import { calcularSaldoLancamento } from '@/lib/saldo';
import { correspondeAosFiltros } from './filtrosLancamento';
import type { FiltrosPainel, SaldoBancoPainel } from './types';

export function agruparSaldosPorBanco(
  lancamentos: LancamentoExtendido[],
  bancos: Banco[],
  filtros: FiltrosPainel,
): SaldoBancoPainel[] {
  const periodo = { start: startOfDay(filtros.inicio), end: endOfDay(filtros.fim) };
  const saldos = new Map<string, SaldoBancoPainel>(
    bancos.map((banco) => [banco.id, {
      bancoId: banco.id,
      nome: banco.nome,
      recebido: 0,
      pago: 0,
      aReceber: 0,
      aPagar: 0,
      saldoAtual: 0,
      saldoPrevisto: 0,
    }]),
  );

  lancamentos
    .filter((lancamento) => (
      lancamento.banco_id
      && correspondeAosFiltros(lancamento, filtros, {
        ignorarBanco: true,
        incluirTransferencias: true,
      })
    ))
    .forEach((lancamento) => {
      const saldo = saldos.get(lancamento.banco_id!);
      if (!saldo) return;

      const { realizado, pendente } = calcularSaldoLancamento(lancamento);
      const dataRealizado = lancamento.data_pagamento
        ? parseISO(lancamento.data_pagamento)
        : parseISO(lancamento.data_vencimento);
      const dataPendente = parseISO(lancamento.data_vencimento);
      const realizadoNoPeriodo = realizado > 0 && isWithinInterval(dataRealizado, periodo) ? realizado : 0;
      const pendenteNoPeriodo = pendente > 0 && isWithinInterval(dataPendente, periodo) ? pendente : 0;

      if (lancamento.tipo === 'receita') {
        saldo.recebido += realizadoNoPeriodo;
        saldo.aReceber += pendenteNoPeriodo;
      } else {
        saldo.pago += realizadoNoPeriodo;
        saldo.aPagar += pendenteNoPeriodo;
      }
    });

  return Array.from(saldos.values())
    .map((saldo) => ({
      ...saldo,
      saldoAtual: saldo.recebido - saldo.pago,
      saldoPrevisto: saldo.recebido + saldo.aReceber - saldo.pago - saldo.aPagar,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
