import type { LancamentoExtendido } from '@/hooks/useLancamentos';
import { getComputedStatus } from '@/lib/statusUtils';
import type { FiltrosPainel } from './types';

interface OpcoesFiltrosLancamento {
  ignorarBanco?: boolean;
  incluirTransferencias?: boolean;
}

export function correspondeAosFiltros(
  lancamento: LancamentoExtendido,
  filtros: FiltrosPainel,
  opcoes: OpcoesFiltrosLancamento = {},
): boolean {
  const status = getComputedStatus(lancamento);
  const categoriaPaiId = lancamento.categorias?.categoria_pai_id;
  const correspondeCategoria = filtros.categoriaIds.length === 0
    || filtros.categoriaIds.includes(lancamento.categoria_id ?? '')
    || (categoriaPaiId ? filtros.categoriaIds.includes(categoriaPaiId) : false);
  const correspondeSubcategoria = filtros.subcategoriaIds.length === 0
    || filtros.subcategoriaIds.includes(lancamento.categoria_id ?? '');
  const correspondeBanco = opcoes.ignorarBanco
    || filtros.bancoIds.length === 0
    || filtros.bancoIds.includes(lancamento.banco_id ?? '');
  const correspondeStatus = filtros.statusList.length === 0 || filtros.statusList.includes(status);
  const incluirTransferencia = opcoes.incluirTransferencias
    || !lancamento.transferencia_vinculo_id
    || filtros.bancoIds.length > 0;

  return correspondeCategoria
    && correspondeSubcategoria
    && correspondeBanco
    && correspondeStatus
    && incluirTransferencia;
}
