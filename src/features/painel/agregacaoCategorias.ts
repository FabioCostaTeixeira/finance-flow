import { endOfDay, isWithinInterval, parseISO, startOfDay } from 'date-fns';
import type { Categoria } from '@/hooks/useCategorias';
import type { LancamentoExtendido } from '@/hooks/useLancamentos';
import { calcularSaldoLancamento } from '@/lib/saldo';
import { correspondeAosFiltros } from './filtrosLancamento';
import type { CategoriaRanking, CategoriaDespesaRanking, FiltrosPainel } from './types';

const LIMITE_CATEGORIAS = 8;
const LIMITE_DESPESAS = 5;
const ID_OUTROS = 'outros';
const NOME_OUTROS = 'Outros';
const ID_SEM_CATEGORIA = 'sem-categoria';
const NOME_SEM_CATEGORIA = 'Sem categoria';

function resolverGrupo(
  lancamento: LancamentoExtendido,
  categoriaPorId: Map<string, Categoria>,
): { id: string; nome: string } {
  const subcategoria = lancamento.categorias;

  if (!subcategoria) {
    return { id: ID_SEM_CATEGORIA, nome: NOME_SEM_CATEGORIA };
  }

  if (subcategoria.categoria_pai_id) {
    const pai = categoriaPorId.get(subcategoria.categoria_pai_id);
    return { id: subcategoria.categoria_pai_id, nome: pai?.nome ?? subcategoria.nome };
  }

  return { id: subcategoria.id, nome: subcategoria.nome };
}

export function agruparEntradasPorCategoria(
  lancamentos: LancamentoExtendido[],
  categorias: Categoria[],
  filtros: FiltrosPainel,
): CategoriaRanking[] {
  const categoriaPorId = new Map(categorias.map((categoria) => [categoria.id, categoria]));
  const periodo = { start: startOfDay(filtros.inicio), end: endOfDay(filtros.fim) };
  const totais = new Map<string, CategoriaRanking>();

  lancamentos
    .filter((lancamento) => lancamento.tipo === 'receita' && correspondeAosFiltros(lancamento, filtros))
    .forEach((lancamento) => {
      const { realizado, pendente } = calcularSaldoLancamento(lancamento);
      const dataRealizado = lancamento.data_pagamento
        ? parseISO(lancamento.data_pagamento)
        : parseISO(lancamento.data_vencimento);
      const dataPendente = parseISO(lancamento.data_vencimento);

      const recebidoNoPeriodo = realizado > 0 && isWithinInterval(dataRealizado, periodo) ? realizado : 0;
      const aReceberNoPeriodo = pendente > 0 && isWithinInterval(dataPendente, periodo) ? pendente : 0;

      if (recebidoNoPeriodo === 0 && aReceberNoPeriodo === 0) return;

      const grupo = resolverGrupo(lancamento, categoriaPorId);
      const atual = totais.get(grupo.id) ?? {
        categoriaId: grupo.id,
        nome: grupo.nome,
        recebido: 0,
        aReceber: 0,
        total: 0,
      };

      atual.recebido += recebidoNoPeriodo;
      atual.aReceber += aReceberNoPeriodo;
      atual.total += recebidoNoPeriodo + aReceberNoPeriodo;
      totais.set(grupo.id, atual);
    });

  const ranking = Array.from(totais.values()).sort((a, b) => b.total - a.total);

  if (ranking.length <= LIMITE_CATEGORIAS) {
    return ranking;
  }

  const principais = ranking.slice(0, LIMITE_CATEGORIAS - 1);
  const restante = ranking.slice(LIMITE_CATEGORIAS - 1);
  const outros = restante.reduce<CategoriaRanking>((acumulado, item) => ({
    categoriaId: ID_OUTROS,
    nome: NOME_OUTROS,
    recebido: acumulado.recebido + item.recebido,
    aReceber: acumulado.aReceber + item.aReceber,
    total: acumulado.total + item.total,
  }), { categoriaId: ID_OUTROS, nome: NOME_OUTROS, recebido: 0, aReceber: 0, total: 0 });

  return [...principais, outros];
}

export function agruparDespesasPorCategoria(
  lancamentos: LancamentoExtendido[],
  categorias: Categoria[],
  filtros: FiltrosPainel,
): CategoriaDespesaRanking[] {
  const categoriaPorId = new Map(categorias.map((categoria) => [categoria.id, categoria]));
  const periodo = { start: startOfDay(filtros.inicio), end: endOfDay(filtros.fim) };
  const totais = new Map<string, CategoriaDespesaRanking>();

  lancamentos
    .filter((lancamento) => lancamento.tipo === 'despesa' && correspondeAosFiltros(lancamento, filtros))
    .forEach((lancamento) => {
      const { realizado, pendente } = calcularSaldoLancamento(lancamento);
      const dataRealizado = lancamento.data_pagamento
        ? parseISO(lancamento.data_pagamento)
        : parseISO(lancamento.data_vencimento);
      const dataPendente = parseISO(lancamento.data_vencimento);

      const pagoNoPeriodo = realizado > 0 && isWithinInterval(dataRealizado, periodo) ? realizado : 0;
      const aPagarNoPeriodo = pendente > 0 && isWithinInterval(dataPendente, periodo) ? pendente : 0;

      if (pagoNoPeriodo === 0 && aPagarNoPeriodo === 0) return;

      const grupo = resolverGrupo(lancamento, categoriaPorId);
      const atual = totais.get(grupo.id) ?? {
        categoriaId: grupo.id,
        nome: grupo.nome,
        pago: 0,
        aPagar: 0,
        total: 0,
      };

      atual.pago += pagoNoPeriodo;
      atual.aPagar += aPagarNoPeriodo;
      atual.total += pagoNoPeriodo + aPagarNoPeriodo;
      totais.set(grupo.id, atual);
    });

  const ranking = Array.from(totais.values()).sort((a, b) => b.total - a.total);

  if (ranking.length <= LIMITE_DESPESAS) {
    return ranking;
  }

  const principais = ranking.slice(0, LIMITE_DESPESAS - 1);
  const restante = ranking.slice(LIMITE_DESPESAS - 1);
  const outros = restante.reduce<CategoriaDespesaRanking>((acumulado, item) => ({
    categoriaId: ID_OUTROS,
    nome: NOME_OUTROS,
    pago: acumulado.pago + item.pago,
    aPagar: acumulado.aPagar + item.aPagar,
    total: acumulado.total + item.total,
  }), { categoriaId: ID_OUTROS, nome: NOME_OUTROS, pago: 0, aPagar: 0, total: 0 });

  return [...principais, outros];
}
