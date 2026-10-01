import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { GripVertical, RotateCcw } from 'lucide-react';
import { Responsive, WidthProvider, type Layout, type Layouts } from 'react-grid-layout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { CardsSaldoBancos } from '@/features/painel/CardsSaldoBancos';
import { GraficoEntradasSaidas } from '@/features/painel/GraficoEntradasSaidas';
import { GraficoEntradasPorCategoria } from '@/features/painel/GraficoEntradasPorCategoria';
import { GraficoDespesasPorCategoria } from '@/features/painel/GraficoDespesasPorCategoria';
import { PainelFiltros } from '@/features/painel/PainelFiltros';
import {
  agruparFluxo,
  moverSemana,
  obterIntervaloSemana,
} from '@/features/painel/agregacaoFluxo';
import { agruparSaldosPorBanco } from '@/features/painel/agregacaoBancos';
import {
  agruparDespesasPorCategoria,
  agruparEntradasPorCategoria,
} from '@/features/painel/agregacaoCategorias';
import {
  carregarLayoutPainel,
  isLayoutPainelValido,
  LAYOUT_PADRAO,
  restaurarLayoutPainel,
  salvarLayoutPainel,
} from '@/features/painel/layoutPainel';
import type { FiltrosPainel, VisaoPainel } from '@/features/painel/types';
import { useBancos } from '@/hooks/useBancos';
import { useCategorias } from '@/hooks/useCategorias';
import { useLancamentos } from '@/hooks/useLancamentos';

const ResponsiveGridLayout = WidthProvider(Responsive);

function criarFiltrosSemana(data: Date): FiltrosPainel {
  const semana = obterIntervaloSemana(data);

  return {
    inicio: semana.inicio,
    fim: semana.fim,
    categoriaIds: [],
    subcategoriaIds: [],
    bancoIds: [],
    statusList: [],
  };
}

function criarLayouts(layoutDesktop: Layout[]): Layouts {
  const layoutMobile = layoutDesktop.map((item, index) => ({
    ...item,
    x: 0,
    y: index,
    w: 1,
  }));

  return {
    lg: layoutDesktop,
    md: layoutDesktop,
    sm: layoutDesktop,
    xs: layoutMobile,
    xxs: layoutMobile,
  };
}

function formatarPeriodo(inicio: Date, fim: Date): string {
  return `${format(inicio, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} a ${format(fim, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
}

export default function PainelControle() {
  const { user } = useAuth();
  const { activeTenant } = useTenant();
  const lancamentosQuery = useLancamentos();
  const categoriasQuery = useCategorias();
  const bancosQuery = useBancos();
  const [visao, setVisao] = useState<VisaoPainel>('semana');
  const [filtros, setFiltros] = useState<FiltrosPainel>(() => criarFiltrosSemana(new Date()));
  const [editandoLayout, setEditandoLayout] = useState(false);
  const [layout, setLayout] = useState<Layout[]>(() => LAYOUT_PADRAO.map((item) => ({ ...item })));
  const [layoutCarregadoPara, setLayoutCarregadoPara] = useState<string | null>(null);

  useEffect(() => {
    const identidadeLayout = user?.id && activeTenant?.id ? `${user.id}:${activeTenant.id}` : null;
    setLayoutCarregadoPara(null);

    if (!user?.id || !activeTenant?.id) {
      setLayout(LAYOUT_PADRAO.map((item) => ({ ...item })));
      return;
    }

    setLayout(carregarLayoutPainel(user.id, activeTenant.id));
    setLayoutCarregadoPara(identidadeLayout);
  }, [activeTenant?.id, user?.id]);

  const atualizarFiltros = useCallback((proximosFiltros: FiltrosPainel) => {
    if (visao === 'mes') {
      setFiltros(proximosFiltros);
      return;
    }

    const semana = obterIntervaloSemana(proximosFiltros.inicio);
    setFiltros({ ...proximosFiltros, inicio: semana.inicio, fim: semana.fim });
  }, [visao]);

  const alterarVisao = useCallback((proximaVisao: VisaoPainel) => {
    setVisao(proximaVisao);

    if (proximaVisao === 'semana') {
      setFiltros((filtrosAtuais) => {
        const semana = obterIntervaloSemana(filtrosAtuais.inicio);
        return { ...filtrosAtuais, inicio: semana.inicio, fim: semana.fim };
      });
    }
  }, []);

  const irParaSemana = useCallback((delta: number) => {
    setFiltros((filtrosAtuais) => {
      const semana = obterIntervaloSemana(moverSemana(filtrosAtuais.inicio, delta));
      return { ...filtrosAtuais, inicio: semana.inicio, fim: semana.fim };
    });
  }, []);

  const pontos = useMemo(
    () => agruparFluxo(lancamentosQuery.data ?? [], filtros, visao),
    [filtros, lancamentosQuery.data, visao],
  );

  const rankingEntradas = useMemo(
    () => agruparEntradasPorCategoria(lancamentosQuery.data ?? [], categoriasQuery.data ?? [], filtros),
    [filtros, lancamentosQuery.data, categoriasQuery.data],
  );

  const rankingDespesas = useMemo(
    () => agruparDespesasPorCategoria(lancamentosQuery.data ?? [], categoriasQuery.data ?? [], filtros),
    [filtros, lancamentosQuery.data, categoriasQuery.data],
  );

  const saldosBancos = useMemo(
    () => agruparSaldosPorBanco(lancamentosQuery.data ?? [], bancosQuery.data ?? [], filtros),
    [bancosQuery.data, filtros, lancamentosQuery.data],
  );

  const alternarBanco = useCallback((bancoId: string) => {
    setFiltros((filtrosAtuais) => ({
      ...filtrosAtuais,
      bancoIds: filtrosAtuais.bancoIds.includes(bancoId) ? [] : [bancoId],
    }));
  }, []);

  const pontosComMovimento = useMemo(
    () => pontos.some((ponto) => (
      ponto.entradas !== 0
      || ponto.pago !== 0
      || ponto.aPagar !== 0
      || ponto.saldoAcumulado !== 0
    )),
    [pontos],
  );

  const isLoading = lancamentosQuery.isLoading;
  const error = lancamentosQuery.error;
  const periodoLabel = useMemo(
    () => formatarPeriodo(filtros.inicio, filtros.fim),
    [filtros.fim, filtros.inicio],
  );

  const salvarLayoutDesktop = useCallback((_: Layout[], todosLayouts: Layouts) => {
    const layoutDesktop = todosLayouts.lg;
    if (!isLayoutPainelValido(layoutDesktop)) return;

    setLayout(layoutDesktop);
    const identidadeLayout = user?.id && activeTenant?.id ? `${user.id}:${activeTenant.id}` : null;

    if (identidadeLayout === layoutCarregadoPara && user?.id && activeTenant?.id) {
      salvarLayoutPainel(user.id, activeTenant.id, layoutDesktop);
    }
  }, [activeTenant?.id, layoutCarregadoPara, user?.id]);

  const restaurarLayout = useCallback(() => {
    if (!user?.id || !activeTenant?.id) {
      setLayout(LAYOUT_PADRAO.map((item) => ({ ...item })));
      return;
    }

    setLayout(restaurarLayoutPainel(user.id, activeTenant.id));
  }, [activeTenant?.id, user?.id]);

  return (
    <main className="flex-1 space-y-4 overflow-x-hidden p-3 md:space-y-6 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 pl-10 md:pl-0">
        <div>
          <h1 className="text-lg font-bold text-foreground md:text-2xl">Painel de Controle</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acompanhe as entradas e saídas do período.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={editandoLayout ? 'secondary' : 'outline'}
            onClick={() => setEditandoLayout((editando) => !editando)}
          >
            {editandoLayout ? 'Concluir edição' : 'Editar layout'}
          </Button>
          {editandoLayout ? (
            <Button type="button" variant="outline" onClick={restaurarLayout}>
              <RotateCcw />
              Restaurar layout padrão
            </Button>
          ) : null}
        </div>
      </header>

      <PainelFiltros
        filtros={filtros}
        categorias={categoriasQuery.data ?? []}
        onChange={atualizarFiltros}
      />

      <CardsSaldoBancos
        saldos={saldosBancos}
        bancoSelecionadoId={filtros.bancoIds.length === 1 ? filtros.bancoIds[0] : null}
        isLoading={lancamentosQuery.isLoading || bancosQuery.isLoading}
        error={lancamentosQuery.error ?? bancosQuery.error}
        onBancoClick={alternarBanco}
      />

      <div className="painel-layout">
        <ResponsiveGridLayout
          key={layoutCarregadoPara ?? 'sem-identidade'}
          className="layout"
          layouts={criarLayouts(layout)}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 1, xxs: 1 }}
          rowHeight={52}
          margin={[16, 16]}
          isDraggable={editandoLayout}
          isResizable={editandoLayout}
          draggableHandle=".painel-drag-handle"
          onLayoutChange={salvarLayoutDesktop}
        >
          <div key="fluxo" className="min-h-0">
            <div className="h-full min-h-0">
              {editandoLayout ? (
                <>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Arraste o bloco ou redimensione-o usando o ponteiro.
                  </p>
                  <div
                    className="painel-drag-handle mb-2 flex cursor-move items-center gap-1.5 text-xs font-medium text-muted-foreground"
                    aria-hidden="true"
                  >
                    <GripVertical className="h-4 w-4" />
                    Arrastar bloco
                  </div>
                </>
              ) : null}
              <GraficoEntradasSaidas
                pontos={pontosComMovimento ? pontos : []}
                visao={visao}
                periodoLabel={periodoLabel}
                isLoading={isLoading}
                error={error}
                onVisaoChange={alterarVisao}
                onSemanaAnterior={() => irParaSemana(-1)}
                onProximaSemana={() => irParaSemana(1)}
              />
            </div>
          </div>
          <div key="categorias-entradas" className="min-h-0">
            <div className="h-full min-h-0">
              {editandoLayout ? (
                <>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Arraste o bloco ou redimensione-o usando o ponteiro.
                  </p>
                  <div
                    className="painel-drag-handle mb-2 flex cursor-move items-center gap-1.5 text-xs font-medium text-muted-foreground"
                    aria-hidden="true"
                  >
                    <GripVertical className="h-4 w-4" />
                    Arrastar bloco
                  </div>
                </>
              ) : null}
              <GraficoEntradasPorCategoria
                ranking={rankingEntradas}
                periodoLabel={periodoLabel}
                isLoading={isLoading}
                error={error}
              />
            </div>
          </div>
          <div key="categorias-despesas" className="min-h-0">
            <div className="h-full min-h-0">
              {editandoLayout ? (
                <>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Arraste o bloco ou redimensione-o usando o ponteiro.
                  </p>
                  <div
                    className="painel-drag-handle mb-2 flex cursor-move items-center gap-1.5 text-xs font-medium text-muted-foreground"
                    aria-hidden="true"
                  >
                    <GripVertical className="h-4 w-4" />
                    Arrastar bloco
                  </div>
                </>
              ) : null}
              <GraficoDespesasPorCategoria
                ranking={rankingDespesas}
                periodoLabel={periodoLabel}
                isLoading={isLoading}
                error={error}
              />
            </div>
          </div>
        </ResponsiveGridLayout>
      </div>
    </main>
  );
}
