import {
  addDays,
  eachDayOfInterval,
  endOfDay,
  endOfWeek,
  format,
  isSameMonth,
  isWithinInterval,
  min,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { LancamentoExtendido } from '@/hooks/useLancamentos';
import { calcularSaldoLancamento } from '@/lib/saldo';
import { correspondeAosFiltros } from './filtrosLancamento';
import type { FiltrosPainel, PontoFluxo, VisaoPainel } from './types';

export function obterIntervaloSemana(data: Date): { inicio: Date; fim: Date } {
  return {
    inicio: startOfWeek(data, { weekStartsOn: 1 }),
    fim: endOfWeek(data, { weekStartsOn: 1 }),
  };
}

export function moverSemana(data: Date, quantidade: number): Date {
  return addDays(data, quantidade * 7);
}

function criarPontoDia(data: Date): PontoFluxo {
  const inicio = startOfDay(data);
  const fim = endOfDay(data);

  return {
    chave: format(inicio, 'yyyy-MM-dd'),
    rotulo: format(inicio, 'EEE dd', { locale: ptBR }),
    rotuloCompleto: format(inicio, 'EEEE, dd/MM', { locale: ptBR }),
    inicio,
    fim,
    recebido: 0,
    aReceber: 0,
    entradas: 0,
    pago: 0,
    aPagar: 0,
    saldoAtual: 0,
    saldoPrevisto: 0,
    saldoAcumulado: 0,
  };
}

function criarPontosSemana(filtros: FiltrosPainel): PontoFluxo[] {
  return eachDayOfInterval({
    start: startOfWeek(filtros.inicio, { weekStartsOn: 1 }),
    end: endOfWeek(filtros.inicio, { weekStartsOn: 1 }),
  }).map(criarPontoDia);
}

function criarPontosMes(filtros: FiltrosPainel): PontoFluxo[] {
  const pontos: PontoFluxo[] = [];
  const ultimoInicio = startOfWeek(filtros.fim, { weekStartsOn: 1 });

  for (
    let inicio = startOfWeek(filtros.inicio, { weekStartsOn: 1 });
    inicio <= ultimoInicio;
    inicio = addDays(inicio, 7)
  ) {
    const fim = endOfWeek(inicio, { weekStartsOn: 1 });
    const numeroSemana = pontos.length + 1;

    pontos.push({
      chave: format(inicio, 'yyyy-MM-dd'),
      rotulo: `Semana ${String(numeroSemana).padStart(2, '0')}`,
      rotuloCompleto: `${format(inicio, 'dd/MM')} a ${format(fim, 'dd/MM')}`,
      inicio,
      fim,
      recebido: 0,
      aReceber: 0,
      entradas: 0,
      pago: 0,
      aPagar: 0,
      saldoAtual: 0,
      saldoPrevisto: 0,
      saldoAcumulado: 0,
    });
  }

  return pontos;
}

function encontrarPonto(
  pontos: PontoFluxo[],
  data: Date,
  filtros: FiltrosPainel,
  visao: VisaoPainel,
): PontoFluxo | undefined {
  const dataNormalizada = startOfDay(data);

  if (visao === 'mes' && !isWithinInterval(dataNormalizada, {
    start: startOfDay(filtros.inicio),
    end: endOfDay(filtros.fim),
  })) {
    return undefined;
  }

  return pontos.find((ponto) => isWithinInterval(dataNormalizada, {
    start: ponto.inicio,
    end: ponto.fim,
  }));
}

function adicionar(
  pontos: PontoFluxo[],
  data: Date,
  filtros: FiltrosPainel,
  visao: VisaoPainel,
  valores: Pick<PontoFluxo, 'recebido' | 'aReceber' | 'pago' | 'aPagar'>,
): void {
  const ponto = encontrarPonto(pontos, data, filtros, visao);
  if (!ponto) return;

  ponto.recebido += valores.recebido;
  ponto.aReceber += valores.aReceber;
  ponto.entradas += valores.recebido + valores.aReceber;
  ponto.pago += valores.pago;
  ponto.aPagar += valores.aPagar;
}

export function agruparFluxo(
  lancamentos: LancamentoExtendido[],
  filtros: FiltrosPainel,
  visao: VisaoPainel,
): PontoFluxo[] {
  const pontos = visao === 'semana' ? criarPontosSemana(filtros) : criarPontosMes(filtros);
  const movimentosRealizados: Array<{ data: Date; valor: number }> = [];

  lancamentos
    .filter((lancamento) => correspondeAosFiltros(lancamento, filtros))
    .forEach((lancamento) => {
      const { realizado, pendente } = calcularSaldoLancamento(lancamento);
      const dataRealizado = lancamento.data_pagamento
        ? parseISO(lancamento.data_pagamento)
        : parseISO(lancamento.data_vencimento);
      const dataPendente = parseISO(lancamento.data_vencimento);

      if (lancamento.tipo === 'receita') {
        adicionar(pontos, dataRealizado, filtros, visao, { recebido: realizado, aReceber: 0, pago: 0, aPagar: 0 });
        adicionar(pontos, dataPendente, filtros, visao, { recebido: 0, aReceber: pendente, pago: 0, aPagar: 0 });
      } else {
        adicionar(pontos, dataRealizado, filtros, visao, { recebido: 0, aReceber: 0, pago: realizado, aPagar: 0 });
        adicionar(pontos, dataPendente, filtros, visao, { recebido: 0, aReceber: 0, pago: 0, aPagar: pendente });
      }

      if (realizado > 0) {
        movimentosRealizados.push({
          data: startOfDay(dataRealizado),
          valor: lancamento.tipo === 'receita' ? realizado : -realizado,
        });
      }
    });

  return pontos.map((ponto) => {
    const dataCorte = visao === 'mes' ? min([ponto.fim, filtros.fim]) : ponto.fim;
    const inicioMes = startOfMonth(dataCorte);
    const saldoAcumulado = movimentosRealizados.reduce((total, movimento) => {
      if (!isSameMonth(movimento.data, dataCorte) || movimento.data < inicioMes || movimento.data > dataCorte) {
        return total;
      }
      return total + movimento.valor;
    }, 0);

    return {
      ...ponto,
      saldoAtual: ponto.recebido - ponto.pago,
      saldoPrevisto: ponto.entradas - ponto.pago - ponto.aPagar,
      saldoAcumulado,
    };
  });
}
