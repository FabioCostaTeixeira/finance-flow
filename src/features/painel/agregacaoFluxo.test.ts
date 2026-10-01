import { describe, expect, it, vi } from 'vitest';
import { format } from 'date-fns';
import type { LancamentoExtendido } from '@/hooks/useLancamentos';
import type { FiltrosPainel } from './types';
import { agruparFluxo, moverSemana, obterIntervaloSemana } from './agregacaoFluxo';

const lancamento = (override: Partial<LancamentoExtendido>): LancamentoExtendido => ({
  id: crypto.randomUUID(),
  data_vencimento: '2026-09-24',
  cliente_credor: 'Teste',
  valor: 100,
  valor_pago: 0,
  banco_id: 'b1',
  status: 'a_receber',
  tipo: 'receita',
  categoria_id: 'sub1',
  recorrencia_id: null,
  parcela_atual: 1,
  total_parcelas: 1,
  observacao: null,
  data_pagamento: null,
  transferencia_vinculo_id: null,
  frequencia: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  categorias: { id: 'sub1', nome: 'Sub', categoria_pai_id: 'cat1' },
  bancos: { id: 'b1', nome: 'Banco 1' },
  ...override,
});

const filtros = (override: Partial<FiltrosPainel> = {}): FiltrosPainel => ({
  inicio: new Date(2026, 8, 21),
  fim: new Date(2026, 8, 27),
  categoriaIds: [],
  subcategoriaIds: [],
  bancoIds: [],
  statusList: [],
  ...override,
});

describe('agregação do painel', () => {
  it('normaliza qualquer dia para segunda a domingo', () => {
    const periodo = obterIntervaloSemana(new Date(2026, 8, 24));

    expect(format(periodo.inicio, 'yyyy-MM-dd')).toBe('2026-09-21');
    expect(format(periodo.fim, 'yyyy-MM-dd')).toBe('2026-09-27');
  });

  it('move a data por semanas completas', () => {
    expect(format(moverSemana(new Date(2026, 8, 24), 2), 'yyyy-MM-dd')).toBe('2026-10-08');
    expect(format(moverSemana(new Date(2026, 8, 24), -1), 'yyyy-MM-dd')).toBe('2026-09-17');
  });

  it('mantém sete dias para a visão semanal e inclui toda a semana normalizada', () => {
    const pontos = agruparFluxo([
      lancamento({ tipo: 'receita', valor: 100, data_vencimento: '2026-09-21' }),
      lancamento({ tipo: 'receita', valor: 200, data_vencimento: '2026-09-27' }),
    ], filtros({
      inicio: new Date(2026, 8, 24),
      fim: new Date(2026, 8, 24),
    }), 'semana');

    expect(pontos).toHaveLength(7);
    expect(pontos[0].entradas).toBe(100);
    expect(pontos[6].entradas).toBe(200);
  });

  it('coloca realizado no pagamento e pendente no vencimento', () => {
    const pontos = agruparFluxo([
      lancamento({ tipo: 'receita', status: 'recebido', valor: 8420, valor_pago: 8420, data_pagamento: '2026-09-24', data_vencimento: '2026-09-28' }),
      lancamento({ tipo: 'despesa', status: 'pago', valor: 4160, valor_pago: 4160, data_pagamento: '2026-09-24' }),
      lancamento({ tipo: 'despesa', status: 'a_pagar', valor: 1280, data_vencimento: '2026-09-24' }),
    ], filtros(), 'semana');

    expect(pontos[3]).toMatchObject({
      recebido: 8420,
      aReceber: 0,
      entradas: 8420,
      pago: 4160,
      aPagar: 1280,
      saldoAtual: 4260,
      saldoPrevisto: 2980,
    });
  });

  it('divide lançamento parcial entre pagamento e vencimento', () => {
    const pontos = agruparFluxo([
      lancamento({ tipo: 'despesa', status: 'parcial', valor: 1000, valor_pago: 400, data_pagamento: '2026-09-22', data_vencimento: '2026-09-26' }),
    ], filtros(), 'semana');

    expect(pontos[1].pago).toBe(400);
    expect(pontos[5].aPagar).toBe(600);
  });

  it('acumula o realizado desde o primeiro dia do mês, inclusive antes da semana visível', () => {
    const pontos = agruparFluxo([
      lancamento({ tipo: 'receita', status: 'recebido', valor: 1000, valor_pago: 1000, data_pagamento: '2026-09-05' }),
      lancamento({ tipo: 'despesa', status: 'pago', valor: 300, valor_pago: 300, data_pagamento: '2026-09-10' }),
      lancamento({ tipo: 'receita', status: 'recebido', valor: 200, valor_pago: 200, data_pagamento: '2026-09-23' }),
    ], filtros(), 'semana');

    expect(pontos.map((ponto) => ponto.saldoAcumulado)).toEqual([
      700, 700, 900, 900, 900, 900, 900,
    ]);
  });

  it('considera somente o realizado no saldo acumulado', () => {
    const pontos = agruparFluxo([
      lancamento({ tipo: 'receita', status: 'a_receber', valor: 1200, data_vencimento: '2026-09-22' }),
      lancamento({ tipo: 'despesa', status: 'a_pagar', valor: 700, data_vencimento: '2026-09-23' }),
      lancamento({ tipo: 'receita', status: 'parcial', valor: 1000, valor_pago: 400, data_pagamento: '2026-09-24', data_vencimento: '2026-09-26' }),
    ], filtros(), 'semana');

    expect(pontos[2].saldoAcumulado).toBe(0);
    expect(pontos[3].saldoAcumulado).toBe(400);
    expect(pontos[6].saldoAcumulado).toBe(400);
  });

  it('reinicia o saldo acumulado no primeiro dia de cada mês', () => {
    const pontos = agruparFluxo([
      lancamento({ tipo: 'receita', status: 'recebido', valor: 1000, valor_pago: 1000, data_pagamento: '2026-09-10' }),
      lancamento({ tipo: 'despesa', status: 'pago', valor: 100, valor_pago: 100, data_pagamento: '2026-09-30' }),
      lancamento({ tipo: 'receita', status: 'recebido', valor: 200, valor_pago: 200, data_pagamento: '2026-10-01' }),
    ], filtros({
      inicio: new Date(2026, 8, 28),
      fim: new Date(2026, 9, 4),
    }), 'semana');

    expect(pontos.map((ponto) => ponto.saldoAcumulado)).toEqual([
      1000, 1000, 900, 200, 200, 200, 200,
    ]);
  });

  it('preserva saldo acumulado negativo', () => {
    const pontos = agruparFluxo([
      lancamento({ tipo: 'despesa', status: 'pago', valor: 500, valor_pago: 500, data_pagamento: '2026-09-03' }),
    ], filtros(), 'semana');

    expect(pontos.every((ponto) => ponto.saldoAcumulado === -500)).toBe(true);
  });

  it('inclui lançamento filho ao filtrar pela categoria pai', () => {
    const pontos = agruparFluxo([
      lancamento({ valor: 100, categoria_id: 'sub1', categorias: { id: 'sub1', nome: 'Sub 1', categoria_pai_id: 'cat1' } }),
      lancamento({ valor: 200, categoria_id: 'sub2', categorias: { id: 'sub2', nome: 'Sub 2', categoria_pai_id: 'cat2' } }),
    ], filtros({ categoriaIds: ['cat1'] }), 'semana');

    expect(pontos[3].entradas).toBe(100);
  });

  it('inclui somente a subcategoria selecionada', () => {
    const pontos = agruparFluxo([
      lancamento({ valor: 100, categoria_id: 'sub1' }),
      lancamento({ valor: 200, categoria_id: 'sub2', categorias: { id: 'sub2', nome: 'Sub 2', categoria_pai_id: 'cat1' } }),
    ], filtros({ subcategoriaIds: ['sub1'] }), 'semana');

    expect(pontos[3].entradas).toBe(100);
  });

  it('inclui somente o banco selecionado', () => {
    const pontos = agruparFluxo([
      lancamento({ valor: 100, banco_id: 'b1' }),
      lancamento({ valor: 200, banco_id: 'b2', bancos: { id: 'b2', nome: 'Banco 2' } }),
    ], filtros({ bancoIds: ['b1'] }), 'semana');

    expect(pontos[3].entradas).toBe(100);
  });

  it('filtra pelo status computado', () => {
    vi.setSystemTime(new Date(2026, 8, 24));

    const pontos = agruparFluxo([
      lancamento({ tipo: 'despesa', status: 'a_pagar', valor: 100, data_vencimento: '2026-09-23' }),
      lancamento({ tipo: 'despesa', status: 'a_pagar', valor: 200, data_vencimento: '2026-09-24' }),
    ], filtros({ statusList: ['atrasado'] }), 'semana');

    expect(pontos[2].aPagar).toBe(100);
    vi.useRealTimers();
  });

  it('exclui transferências sem banco e inclui com banco selecionado', () => {
    const transferencia = lancamento({
      tipo: 'receita',
      status: 'transferencia',
      valor: 500,
      valor_pago: 500,
      data_pagamento: '2026-09-24',
      transferencia_vinculo_id: 'transferencia-1',
    });

    expect(agruparFluxo([transferencia], filtros(), 'semana')[3].entradas).toBe(0);
    expect(agruparFluxo([transferencia], filtros({ bancoIds: ['b1'] }), 'semana')[3].entradas).toBe(500);
  });

  it('mostra nos buckets mensais o acumulado até o fim de cada semana', () => {
    const pontos = agruparFluxo([
      lancamento({ tipo: 'receita', status: 'recebido', valor: 100, valor_pago: 100, data_pagamento: '2026-09-02' }),
      lancamento({ tipo: 'despesa', status: 'pago', valor: 30, valor_pago: 30, data_pagamento: '2026-09-09' }),
      lancamento({ tipo: 'receita', status: 'recebido', valor: 50, valor_pago: 50, data_pagamento: '2026-09-16' }),
    ], filtros({
      inicio: new Date(2026, 8, 1),
      fim: new Date(2026, 8, 20),
    }), 'mes');

    expect(pontos.map((ponto) => ponto.saldoAcumulado)).toEqual([100, 70, 120]);
  });

  it('usa o mês do fim efetivo quando um bucket mensal cruza a virada', () => {
    const pontos = agruparFluxo([
      lancamento({ tipo: 'receita', status: 'recebido', valor: 1000, valor_pago: 1000, data_pagamento: '2026-09-15' }),
      lancamento({ tipo: 'receita', status: 'recebido', valor: 250, valor_pago: 250, data_pagamento: '2026-10-02' }),
    ], filtros({
      inicio: new Date(2026, 8, 28),
      fim: new Date(2026, 9, 4),
    }), 'mes');

    expect(pontos).toHaveLength(1);
    expect(pontos[0].saldoAcumulado).toBe(250);
  });

  it('gera semanas mensais e inclui somente parcelas nas pontas do intervalo', () => {
    const pontos = agruparFluxo([
      lancamento({ valor: 100, data_vencimento: '2026-09-21' }),
      lancamento({ valor: 200, data_vencimento: '2026-10-11' }),
      lancamento({ valor: 300, data_vencimento: '2026-09-20' }),
      lancamento({ valor: 400, data_vencimento: '2026-10-12' }),
    ], filtros({
      inicio: new Date(2026, 8, 21),
      fim: new Date(2026, 9, 11),
    }), 'mes');

    expect(pontos.map((ponto) => ponto.rotulo)).toEqual(['Semana 01', 'Semana 02', 'Semana 03']);
    expect(pontos[0].entradas).toBe(100);
    expect(pontos[2].entradas).toBe(200);
    expect(pontos.reduce((total, ponto) => total + ponto.entradas, 0)).toBe(300);
  });

  it('mantém sete dias quando semana contém datas futuras', () => {
    vi.setSystemTime(new Date(2026, 8, 24));
    const pontos = agruparFluxo([], filtros({
      inicio: new Date(2026, 8, 28),
      fim: new Date(2026, 9, 4),
    }), 'semana');

    expect(pontos).toHaveLength(7);
    expect(format(pontos[6].inicio, 'yyyy-MM-dd')).toBe('2026-10-04');
    vi.useRealTimers();
  });
});
