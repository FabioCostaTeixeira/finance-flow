import { describe, expect, it } from 'vitest';
import type { Banco } from '@/hooks/useBancos';
import type { LancamentoExtendido } from '@/hooks/useLancamentos';
import type { FiltrosPainel } from './types';
import { agruparSaldosPorBanco } from './agregacaoBancos';

const banco = (override: Partial<Banco>): Banco => ({
  id: 'b1',
  nome: 'Banco 1',
  created_at: '2026-09-01T00:00:00Z',
  ...override,
});

const lancamento = (override: Partial<LancamentoExtendido>): LancamentoExtendido => ({
  id: crypto.randomUUID(),
  data_vencimento: '2026-09-24',
  cliente_credor: 'Teste',
  valor: 100,
  valor_pago: 0,
  banco_id: 'b1',
  status: 'a_receber',
  tipo: 'receita',
  categoria_id: 'cat1',
  recorrencia_id: null,
  parcela_atual: 1,
  total_parcelas: 1,
  observacao: null,
  data_pagamento: null,
  transferencia_vinculo_id: null,
  frequencia: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  categorias: { id: 'cat1', nome: 'Categoria 1', categoria_pai_id: null },
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

describe('agruparSaldosPorBanco', () => {
  it('calcula saldos realizado e previsto por banco no período filtrado', () => {
    const saldos = agruparSaldosPorBanco([
      lancamento({
        tipo: 'receita',
        status: 'recebido',
        valor: 1000,
        valor_pago: 1000,
        data_pagamento: '2026-09-22',
      }),
      lancamento({
        id: 'despesa-paga',
        tipo: 'despesa',
        status: 'pago',
        valor: 300,
        valor_pago: 300,
        data_pagamento: '2026-09-23',
      }),
      lancamento({
        id: 'receita-pendente',
        tipo: 'receita',
        status: 'a_receber',
        valor: 200,
        data_vencimento: '2026-09-24',
      }),
      lancamento({
        id: 'despesa-pendente',
        tipo: 'despesa',
        status: 'a_pagar',
        valor: 150,
        data_vencimento: '2026-09-25',
      }),
    ], [banco({ id: 'b1', nome: 'Conta principal' })], filtros());

    expect(saldos).toEqual([{
      bancoId: 'b1',
      nome: 'Conta principal',
      recebido: 1000,
      pago: 300,
      aReceber: 200,
      aPagar: 150,
      saldoAtual: 700,
      saldoPrevisto: 750,
    }]);
  });

  it('divide lançamento parcial entre realizado e pendente pelas respectivas datas', () => {
    const saldos = agruparSaldosPorBanco([
      lancamento({
        status: 'parcial',
        valor: 1000,
        valor_pago: 400,
        data_pagamento: '2026-09-22',
        data_vencimento: '2026-10-05',
      }),
    ], [banco({})], filtros());

    expect(saldos[0]).toMatchObject({
      recebido: 400,
      pago: 0,
      aReceber: 0,
      aPagar: 0,
      saldoAtual: 400,
      saldoPrevisto: 400,
    });
  });

  it('mantém todos os bancos e ordena pelo nome mesmo sem movimento', () => {
    const saldos = agruparSaldosPorBanco([], [
      banco({ id: 'b2', nome: 'Zeta' }),
      banco({ id: 'b1', nome: 'Alfa' }),
    ], filtros());

    expect(saldos).toEqual([
      {
        bancoId: 'b1', nome: 'Alfa', recebido: 0, pago: 0, aReceber: 0, aPagar: 0,
        saldoAtual: 0, saldoPrevisto: 0,
      },
      {
        bancoId: 'b2', nome: 'Zeta', recebido: 0, pago: 0, aReceber: 0, aPagar: 0,
        saldoAtual: 0, saldoPrevisto: 0,
      },
    ]);
  });

  it('respeita categoria, subcategoria e status, mas não muda cards ao filtrar banco', () => {
    const base = lancamento({
      id: 'b1-cat1',
      banco_id: 'b1',
      status: 'recebido',
      valor: 100,
      valor_pago: 100,
      data_pagamento: '2026-09-22',
      categoria_id: 'cat1',
      categorias: { id: 'cat1', nome: 'Vendas', categoria_pai_id: null },
    });
    const outroBanco = lancamento({
      id: 'b2-cat1',
      banco_id: 'b2',
      status: 'recebido',
      valor: 200,
      valor_pago: 200,
      data_pagamento: '2026-09-22',
      categoria_id: 'cat1',
      categorias: { id: 'cat1', nome: 'Vendas', categoria_pai_id: null },
    });
    const outraCategoria = lancamento({
      id: 'b1-cat2',
      banco_id: 'b1',
      status: 'recebido',
      valor: 500,
      valor_pago: 500,
      data_pagamento: '2026-09-22',
      categoria_id: 'cat2',
      categorias: { id: 'cat2', nome: 'Serviços', categoria_pai_id: null },
    });

    const saldos = agruparSaldosPorBanco(
      [base, outroBanco, outraCategoria],
      [banco({ id: 'b1', nome: 'Banco 1' }), banco({ id: 'b2', nome: 'Banco 2' })],
      filtros({ categoriaIds: ['cat1'], bancoIds: ['b1'], statusList: ['recebido'] }),
    );

    expect(saldos.map(({ bancoId, saldoAtual }) => ({ bancoId, saldoAtual }))).toEqual([
      { bancoId: 'b1', saldoAtual: 100 },
      { bancoId: 'b2', saldoAtual: 200 },
    ]);
  });

  it('aplica transferências realizadas nas contas de origem e destino', () => {
    const saldos = agruparSaldosPorBanco([
      lancamento({
        id: 'transferencia-origem',
        banco_id: 'b1',
        tipo: 'despesa',
        status: 'transferencia',
        valor: 250,
        valor_pago: 250,
        data_pagamento: '2026-09-22',
        transferencia_vinculo_id: 'transferencia-1',
      }),
      lancamento({
        id: 'transferencia-destino',
        banco_id: 'b2',
        tipo: 'receita',
        status: 'transferencia',
        valor: 250,
        valor_pago: 250,
        data_pagamento: '2026-09-22',
        transferencia_vinculo_id: 'transferencia-1',
      }),
    ], [banco({ id: 'b1', nome: 'Origem' }), banco({ id: 'b2', nome: 'Destino' })], filtros());

    expect(saldos.map(({ bancoId, saldoAtual, saldoPrevisto }) => ({ bancoId, saldoAtual, saldoPrevisto }))).toEqual([
      { bancoId: 'b2', saldoAtual: 250, saldoPrevisto: 250 },
      { bancoId: 'b1', saldoAtual: -250, saldoPrevisto: -250 },
    ]);
  });
});
