import { describe, expect, it } from 'vitest';
import type { Categoria } from '@/hooks/useCategorias';
import type { LancamentoExtendido } from '@/hooks/useLancamentos';
import type { FiltrosPainel } from './types';
import { agruparDespesasPorCategoria, agruparEntradasPorCategoria } from './agregacaoCategorias';

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

const categoria = (override: Partial<Categoria>): Categoria => ({
  id: 'cat1',
  nome: 'Categoria 1',
  nome_normalizado: 'categoria 1',
  tipo: 'receita',
  categoria_pai_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
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

describe('agruparEntradasPorCategoria', () => {
  it('agrupa pela categoria pai e ordena do maior para o menor', () => {
    const categorias = [
      categoria({ id: 'cat1', nome: 'Vendas' }),
      categoria({ id: 'sub1', nome: 'Sub A', categoria_pai_id: 'cat1' }),
      categoria({ id: 'cat2', nome: 'Serviços' }),
      categoria({ id: 'sub2', nome: 'Sub B', categoria_pai_id: 'cat2' }),
    ];

    const ranking = agruparEntradasPorCategoria([
      lancamento({
        status: 'recebido', valor: 300, valor_pago: 300, data_pagamento: '2026-09-22',
        categoria_id: 'sub1', categorias: { id: 'sub1', nome: 'Sub A', categoria_pai_id: 'cat1' },
      }),
      lancamento({
        status: 'recebido', valor: 900, valor_pago: 900, data_pagamento: '2026-09-23',
        categoria_id: 'sub2', categorias: { id: 'sub2', nome: 'Sub B', categoria_pai_id: 'cat2' },
      }),
    ], categorias, filtros());

    expect(ranking).toEqual([
      { categoriaId: 'cat2', nome: 'Serviços', recebido: 900, aReceber: 0, total: 900 },
      { categoriaId: 'cat1', nome: 'Vendas', recebido: 300, aReceber: 0, total: 300 },
    ]);
  });

  it('agrupa pela própria categoria quando ela não tem pai', () => {
    const categorias = [categoria({ id: 'cat1', nome: 'Vendas', categoria_pai_id: null })];

    const ranking = agruparEntradasPorCategoria([
      lancamento({
        status: 'recebido', valor: 500, valor_pago: 500, data_pagamento: '2026-09-22',
        categoria_id: 'cat1', categorias: { id: 'cat1', nome: 'Vendas', categoria_pai_id: null },
      }),
    ], categorias, filtros());

    expect(ranking).toEqual([
      { categoriaId: 'cat1', nome: 'Vendas', recebido: 500, aReceber: 0, total: 500 },
    ]);
  });

  it('separa recebido e a receber dentro da mesma categoria', () => {
    const categorias = [categoria({ id: 'cat1', nome: 'Vendas' })];

    const ranking = agruparEntradasPorCategoria([
      lancamento({
        status: 'recebido', valor: 300, valor_pago: 300, data_pagamento: '2026-09-22',
      }),
      lancamento({
        status: 'a_receber', valor: 200, data_vencimento: '2026-09-25',
      }),
    ], categorias, filtros());

    expect(ranking).toEqual([
      { categoriaId: 'cat1', nome: 'Vendas', recebido: 300, aReceber: 200, total: 500 },
    ]);
  });

  it('divide lançamento parcial entre recebido e a receber quando ambas as datas estão no período', () => {
    const categorias = [categoria({ id: 'cat1', nome: 'Vendas' })];

    const ranking = agruparEntradasPorCategoria([
      lancamento({
        status: 'parcial', valor: 1000, valor_pago: 400,
        data_pagamento: '2026-09-22', data_vencimento: '2026-09-26',
      }),
    ], categorias, filtros());

    expect(ranking).toEqual([
      { categoriaId: 'cat1', nome: 'Vendas', recebido: 400, aReceber: 600, total: 1000 },
    ]);
  });

  it('ignora despesas', () => {
    const categorias = [categoria({ id: 'cat1', nome: 'Vendas' })];

    const ranking = agruparEntradasPorCategoria([
      lancamento({ tipo: 'despesa', status: 'pago', valor: 500, valor_pago: 500, data_pagamento: '2026-09-22' }),
    ], categorias, filtros());

    expect(ranking).toEqual([]);
  });

  it('ignora lançamentos cujas datas ficam fora do período filtrado', () => {
    const categorias = [categoria({ id: 'cat1', nome: 'Vendas' })];

    const ranking = agruparEntradasPorCategoria([
      lancamento({ status: 'recebido', valor: 500, valor_pago: 500, data_pagamento: '2026-08-10' }),
      lancamento({ status: 'a_receber', valor: 500, data_vencimento: '2026-10-10' }),
    ], categorias, filtros());

    expect(ranking).toEqual([]);
  });

  it('respeita filtro de categoria, subcategoria, banco e status', () => {
    const categorias = [
      categoria({ id: 'cat1', nome: 'Vendas' }),
      categoria({ id: 'cat2', nome: 'Serviços' }),
    ];

    const base = lancamento({
      status: 'recebido', valor: 100, valor_pago: 100, data_pagamento: '2026-09-22',
      categoria_id: 'sub1', categorias: { id: 'sub1', nome: 'Sub A', categoria_pai_id: 'cat1' },
      banco_id: 'b1',
    });
    const outraCategoria = lancamento({
      status: 'recebido', valor: 200, valor_pago: 200, data_pagamento: '2026-09-22',
      categoria_id: 'sub2', categorias: { id: 'sub2', nome: 'Sub B', categoria_pai_id: 'cat2' },
      banco_id: 'b2',
    });

    expect(agruparEntradasPorCategoria([base, outraCategoria], categorias, filtros({ categoriaIds: ['cat1'] })))
      .toEqual([{ categoriaId: 'cat1', nome: 'Vendas', recebido: 100, aReceber: 0, total: 100 }]);

    expect(agruparEntradasPorCategoria([base, outraCategoria], categorias, filtros({ bancoIds: ['b2'] })))
      .toEqual([{ categoriaId: 'cat2', nome: 'Serviços', recebido: 200, aReceber: 0, total: 200 }]);

    expect(agruparEntradasPorCategoria([base, outraCategoria], categorias, filtros({ statusList: ['a_receber'] })))
      .toEqual([]);
  });

  it('agrupa lançamento sem categoria em "Sem categoria"', () => {
    const ranking = agruparEntradasPorCategoria([
      lancamento({ status: 'recebido', valor: 150, valor_pago: 150, data_pagamento: '2026-09-22', categoria_id: null, categorias: null }),
    ], [], filtros());

    expect(ranking).toEqual([
      { categoriaId: 'sem-categoria', nome: 'Sem categoria', recebido: 150, aReceber: 0, total: 150 },
    ]);
  });

  it('agrega o restante em "Outros" quando exceder o limite de categorias exibidas', () => {
    const categorias = Array.from({ length: 9 }, (_, index) => categoria({ id: `cat${index}`, nome: `Categoria ${index}` }));

    const lancamentos = categorias.map((cat, index) => lancamento({
      status: 'recebido',
      valor: (index + 1) * 100,
      valor_pago: (index + 1) * 100,
      data_pagamento: '2026-09-22',
      categoria_id: cat.id,
      categorias: { id: cat.id, nome: cat.nome, categoria_pai_id: null },
    }));

    const ranking = agruparEntradasPorCategoria(lancamentos, categorias, filtros());

    expect(ranking).toHaveLength(8);
    expect(ranking[7]).toEqual({
      categoriaId: 'outros',
      nome: 'Outros',
      recebido: 100 + 200,
      aReceber: 0,
      total: 300,
    });
    expect(ranking.slice(0, 7).map((item) => item.nome)).toEqual([
      'Categoria 8', 'Categoria 7', 'Categoria 6', 'Categoria 5', 'Categoria 4', 'Categoria 3', 'Categoria 2',
    ]);
  });
});

describe('agruparDespesasPorCategoria', () => {
  it('agrupa despesas por categoria pai separando pago e a pagar', () => {
    const categorias = [
      categoria({ id: 'cat1', nome: 'Aluguel', tipo: 'despesa' }),
      categoria({ id: 'cat2', nome: 'Fornecedores', tipo: 'despesa' }),
    ];

    const ranking = agruparDespesasPorCategoria([
      lancamento({
        tipo: 'despesa', status: 'pago', valor: 2000, valor_pago: 2000, data_pagamento: '2026-09-22',
        categoria_id: 'cat1', categorias: { id: 'cat1', nome: 'Aluguel', categoria_pai_id: null },
      }),
      lancamento({
        tipo: 'despesa', status: 'a_pagar', valor: 800, data_vencimento: '2026-09-25',
        categoria_id: 'cat2', categorias: { id: 'cat2', nome: 'Fornecedores', categoria_pai_id: null },
      }),
    ], categorias, filtros());

    expect(ranking).toEqual([
      { categoriaId: 'cat1', nome: 'Aluguel', pago: 2000, aPagar: 0, total: 2000 },
      { categoriaId: 'cat2', nome: 'Fornecedores', pago: 0, aPagar: 800, total: 800 },
    ]);
  });

  it('ignora receitas ao agrupar despesas', () => {
    const categorias = [categoria({ id: 'cat1', nome: 'Vendas', tipo: 'receita' })];

    const ranking = agruparDespesasPorCategoria([
      lancamento({ tipo: 'receita', status: 'recebido', valor: 500, valor_pago: 500, data_pagamento: '2026-09-22' }),
    ], categorias, filtros());

    expect(ranking).toEqual([]);
  });

  it('limita o resultado ao top 5 unificando excedentes em Outros', () => {
    const categorias = Array.from({ length: 6 }, (_, index) => categoria({ id: `cat${index}`, nome: `Despesa ${index}`, tipo: 'despesa' }));

    const lancamentos = categorias.map((cat, index) => lancamento({
      tipo: 'despesa',
      status: 'pago',
      valor: (index + 1) * 100,
      valor_pago: (index + 1) * 100,
      data_pagamento: '2026-09-22',
      categoria_id: cat.id,
      categorias: { id: cat.id, nome: cat.nome, categoria_pai_id: null },
    }));

    const ranking = agruparDespesasPorCategoria(lancamentos, categorias, filtros());

    expect(ranking).toHaveLength(5);
    expect(ranking[4]).toEqual({
      categoriaId: 'outros',
      nome: 'Outros',
      pago: 100 + 200,
      aPagar: 0,
      total: 300,
    });
    expect(ranking.slice(0, 4).map((item) => item.nome)).toEqual([
      'Despesa 5', 'Despesa 4', 'Despesa 3', 'Despesa 2',
    ]);
  });
});
