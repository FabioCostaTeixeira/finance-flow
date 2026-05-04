import { useMemo } from 'react';
import { parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { LancamentoExtendido } from '@/hooks/useLancamentos';
import { Categoria } from '@/hooks/useCategorias';
import { LancamentosFiltersState } from '@/components/LancamentosFilters';
import { getComputedStatus } from '@/lib/statusUtils';

function getParentCategoryId(categoriaId: string | null, categorias: Categoria[]): string | null {
  if (!categoriaId) return null;
  const cat = categorias.find((c) => c.id === categoriaId);
  return cat?.categoria_pai_id || null;
}

export function useLancamentosFilter(
  lancamentos: LancamentoExtendido[],
  filters: LancamentosFiltersState,
  categorias: Categoria[],
) {
  const filteredLancamentos = useMemo(() => {
    return lancamentos.filter((lancamento) => {
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        if (!lancamento.cliente_credor.toLowerCase().includes(searchLower)) return false;
      }
      if (filters.dataInicio) {
        const lancDate = parseISO(lancamento.data_vencimento);
        if (isBefore(lancDate, startOfDay(filters.dataInicio))) return false;
      }
      if (filters.dataFim) {
        const lancDate = parseISO(lancamento.data_vencimento);
        if (isAfter(lancDate, endOfDay(filters.dataFim))) return false;
      }
      if (filters.categoriaIds.length > 0) {
        const lancCatId = lancamento.categoria_id;
        const lancParentId = getParentCategoryId(lancCatId, categorias);
        if (!lancCatId || (!filters.categoriaIds.includes(lancCatId) && (!lancParentId || !filters.categoriaIds.includes(lancParentId)))) {
          return false;
        }
      }
      if (filters.subcategoriaIds.length > 0) {
        if (!lancamento.categoria_id || !filters.subcategoriaIds.includes(lancamento.categoria_id)) return false;
      }
      if (filters.statusList.length > 0) {
        const computedStatus = getComputedStatus({
          status: lancamento.status,
          tipo: lancamento.tipo,
          data_vencimento: lancamento.data_vencimento,
          valor: lancamento.valor,
          valor_pago: lancamento.valor_pago,
        });
        if (!filters.statusList.includes(computedStatus)) return false;
      }
      if (filters.bancoIds.length > 0) {
        if (!lancamento.banco_id || !filters.bancoIds.includes(lancamento.banco_id)) return false;
      }
      return true;
    });
  }, [lancamentos, filters, categorias]);

  return { filteredLancamentos };
}
