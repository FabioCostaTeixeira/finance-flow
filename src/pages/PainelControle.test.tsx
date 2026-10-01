import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CategoriaDespesaRanking,
  CategoriaRanking,
  FiltrosPainel,
  PontoFluxo,
  SaldoBancoPainel,
  VisaoPainel,
} from '@/features/painel/types';

const estado = {
  userId: 'u1',
  tenantId: 't1',
  lancamentos: { data: [] as unknown[], isLoading: false, error: null as Error | null },
  categorias: { data: [] as unknown[], isLoading: false, error: null as Error | null },
  bancos: { data: [] as unknown[], isLoading: false, error: null as Error | null },
};

const {
  agruparFluxoMock,
  agruparEntradasPorCategoriaMock,
  agruparDespesasPorCategoriaMock,
  agruparSaldosPorBancoMock,
} = vi.hoisted(() => ({
  agruparFluxoMock: vi.fn((): PontoFluxo[] => []),
  agruparEntradasPorCategoriaMock: vi.fn((): CategoriaRanking[] => []),
  agruparDespesasPorCategoriaMock: vi.fn((): CategoriaDespesaRanking[] => []),
  agruparSaldosPorBancoMock: vi.fn((): SaldoBancoPainel[] => []),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: estado.userId } }),
}));

vi.mock('@/contexts/TenantContext', () => ({
  useTenant: () => ({ activeTenant: { id: estado.tenantId } }),
}));

vi.mock('@/hooks/useLancamentos', () => ({
  useLancamentos: () => estado.lancamentos,
}));

vi.mock('@/hooks/useCategorias', () => ({
  useCategorias: () => estado.categorias,
}));

vi.mock('@/hooks/useBancos', () => ({
  useBancos: () => estado.bancos,
}));

vi.mock('@/features/painel/agregacaoFluxo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/painel/agregacaoFluxo')>();
  return {
    ...actual,
    agruparFluxo: agruparFluxoMock,
  };
});

vi.mock('@/features/painel/agregacaoCategorias', () => ({
  agruparEntradasPorCategoria: agruparEntradasPorCategoriaMock,
  agruparDespesasPorCategoria: agruparDespesasPorCategoriaMock,
}));

vi.mock('@/features/painel/agregacaoBancos', () => ({
  agruparSaldosPorBanco: agruparSaldosPorBancoMock,
}));

vi.mock('@/features/painel/PainelFiltros', () => ({
  PainelFiltros: ({ filtros, categorias, onChange }: {
    filtros: FiltrosPainel;
    categorias: unknown[];
    onChange: (proximosFiltros: FiltrosPainel) => void;
  }) => (
    <section
      data-testid="filtros-controlados"
      data-categorias={categorias.length}
    >
      <span data-testid="inicio-filtro">{filtros.inicio.toISOString().slice(0, 10)}</span>
      <span data-testid="fim-filtro">{filtros.fim.toISOString().slice(0, 10)}</span>
      <button
        type="button"
        onClick={() => onChange({
          ...filtros,
          inicio: new Date(2026, 9, 1),
          fim: new Date(2026, 9, 15),
          categoriaIds: ['cat1'],
          bancoIds: ['b1'],
        })}
      >
        Alterar filtros globais
      </button>
    </section>
  ),
}));

vi.mock('@/features/painel/CardsSaldoBancos', () => ({
  CardsSaldoBancos: ({
    saldos,
    bancoSelecionadoId,
    onBancoClick,
  }: {
    saldos: SaldoBancoPainel[];
    bancoSelecionadoId: string | null;
    isLoading: boolean;
    error: Error | null;
    onBancoClick: (bancoId: string) => void;
  }) => (
    <section data-testid="cards-bancos" data-saldos={saldos.length} data-selecionado={bancoSelecionadoId ?? ''}>
      <button type="button" onClick={() => onBancoClick('b1')}>Selecionar Banco 1</button>
    </section>
  ),
}));

vi.mock('@/features/painel/GraficoEntradasSaidas', () => ({
  GraficoEntradasSaidas: ({
    visao,
    periodoLabel,
    pontos,
    isLoading,
    error,
    onVisaoChange,
    onSemanaAnterior,
    onProximaSemana,
  }: {
    visao: VisaoPainel;
    periodoLabel: string;
    pontos: PontoFluxo[];
    isLoading: boolean;
    error: Error | null;
    onVisaoChange: (visao: VisaoPainel) => void;
    onSemanaAnterior: () => void;
    onProximaSemana: () => void;
  }) => (
    <section
      data-testid="grafico"
      data-loading={String(isLoading)}
      data-error={error?.message ?? ''}
      data-pontos={pontos.length}
    >
      <span data-testid="visao">{visao}</span>
      <span data-testid="periodo">{periodoLabel}</span>
      <button type="button" onClick={() => onVisaoChange('semana')}>Visão semanal</button>
      <button type="button" onClick={() => onVisaoChange('mes')}>Visão mensal</button>
      <button type="button" onClick={onSemanaAnterior}>Semana anterior</button>
      <button type="button" onClick={onProximaSemana}>Próxima semana</button>
    </section>
  ),
}));

vi.mock('@/features/painel/GraficoEntradasPorCategoria', () => ({
  GraficoEntradasPorCategoria: ({
    ranking,
    isLoading,
    error,
  }: {
    ranking: CategoriaRanking[];
    periodoLabel: string;
    isLoading: boolean;
    error: Error | null;
  }) => (
    <section
      data-testid="grafico-categorias"
      data-loading={String(isLoading)}
      data-error={error?.message ?? ''}
      data-ranking={ranking.length}
    />
  ),
}));

vi.mock('@/features/painel/GraficoDespesasPorCategoria', () => ({
  GraficoDespesasPorCategoria: ({
    ranking,
    isLoading,
    error,
  }: {
    ranking: CategoriaDespesaRanking[];
    periodoLabel: string;
    isLoading: boolean;
    error: Error | null;
  }) => (
    <section
      data-testid="grafico-despesas-categorias"
      data-loading={String(isLoading)}
      data-error={error?.message ?? ''}
      data-ranking={ranking.length}
    />
  ),
}));

vi.mock('react-grid-layout', () => ({
  WidthProvider: (Component: React.ComponentType<Record<string, unknown>>) => Component,
  Responsive: ({ children, isDraggable, isResizable, layouts, onBreakpointChange, onLayoutChange }: {
    children: ReactNode;
    isDraggable: boolean;
    isResizable: boolean;
    layouts: Record<string, unknown[]>;
    onBreakpointChange?: (breakpoint: string) => void;
    onLayoutChange: (currentLayout: unknown[], allLayouts: Record<string, unknown[]>) => void;
  }) => (
    <div
      data-testid="grid"
      data-draggable={String(isDraggable)}
      data-resizable={String(isResizable)}
      data-layout-lg={JSON.stringify(layouts.lg)}
    >
      {children}
      <button
        type="button"
        onClick={() => onLayoutChange(
          [{ i: 'fluxo', x: 1, y: 0, w: 8, h: 14 }, { i: 'categorias-entradas', x: 8, y: 0, w: 4, h: 7 }, { i: 'categorias-despesas', x: 8, y: 7, w: 4, h: 7 }],
          { lg: [{ i: 'fluxo', x: 1, y: 0, w: 8, h: 14 }, { i: 'categorias-entradas', x: 8, y: 0, w: 4, h: 7 }, { i: 'categorias-despesas', x: 8, y: 7, w: 4, h: 7 }] },
        )}
      >
        Simular layout
      </button>
      <button
        type="button"
        onClick={() => {
          const desktop = [{ i: 'fluxo', x: 2, y: 1, w: 8, h: 14 }, { i: 'categorias-entradas', x: 8, y: 0, w: 4, h: 7 }, { i: 'categorias-despesas', x: 8, y: 7, w: 4, h: 7 }];
          const mobile = [{ i: 'fluxo', x: 0, y: 8, w: 1, h: 14 }, { i: 'categorias-entradas', x: 0, y: 0, w: 1, h: 7 }, { i: 'categorias-despesas', x: 0, y: 7, w: 1, h: 7 }];
          onBreakpointChange?.('xs');
          onLayoutChange(mobile, { lg: desktop, xs: mobile });
        }}
      >
        Simular transição mobile
      </button>
    </div>
  ),
}));

import PainelControle from './PainelControle';

describe('PainelControle', () => {
  beforeEach(() => {
    localStorage.clear();
    estado.userId = 'u1';
    estado.tenantId = 't1';
    estado.lancamentos = { data: [], isLoading: false, error: null };
    estado.categorias = { data: [], isLoading: false, error: null };
    estado.bancos = { data: [], isLoading: false, error: null };
    agruparFluxoMock.mockClear();
    agruparEntradasPorCategoriaMock.mockClear();
    agruparDespesasPorCategoriaMock.mockClear();
    agruparSaldosPorBancoMock.mockClear();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('integra filtros globais controlados, visão e navegação semanal', async () => {
    const user = userEvent.setup();
    render(<PainelControle />);

    const inicioInicial = screen.getByTestId('inicio-filtro').textContent;
    const fimInicial = screen.getByTestId('fim-filtro').textContent;
    expect(inicioInicial).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fimInicial).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(agruparFluxoMock).toHaveBeenLastCalledWith([], expect.objectContaining({
      categoriaIds: [],
      bancoIds: [],
    }), 'semana');
    expect(agruparSaldosPorBancoMock).toHaveBeenLastCalledWith([], [], expect.objectContaining({
      categoriaIds: [],
      bancoIds: [],
    }));

    await user.click(screen.getByRole('button', { name: 'Alterar filtros globais' }));
    expect(agruparFluxoMock).toHaveBeenLastCalledWith([], expect.objectContaining({
      categoriaIds: ['cat1'],
      bancoIds: ['b1'],
      inicio: new Date(2026, 8, 28),
      fim: expect.any(Date),
    }), 'semana');

    await user.click(screen.getByRole('button', { name: 'Visão mensal' }));
    expect(screen.getByTestId('visao')).toHaveTextContent('mes');
    expect(agruparFluxoMock).toHaveBeenLastCalledWith([], expect.objectContaining({
      inicio: new Date(2026, 8, 28),
      fim: expect.any(Date),
    }), 'mes');

    await user.click(screen.getByRole('button', { name: 'Alterar filtros globais' }));
    expect(screen.getByTestId('inicio-filtro')).toHaveTextContent('2026-10-01');
    expect(screen.getByTestId('fim-filtro')).toHaveTextContent('2026-10-15');

    await user.click(screen.getByRole('button', { name: 'Visão semanal' }));
    expect(screen.getByTestId('inicio-filtro')).toHaveTextContent('2026-09-28');
    expect(screen.getByTestId('fim-filtro')).toHaveTextContent('2026-10-05');

    await user.click(screen.getByRole('button', { name: 'Próxima semana' }));
    expect(screen.getByTestId('inicio-filtro')).toHaveTextContent('2026-10-05');
    expect(screen.getByTestId('fim-filtro')).toHaveTextContent('2026-10-12');

    await user.click(screen.getByRole('button', { name: 'Semana anterior' }));
    expect(screen.getByTestId('inicio-filtro')).toHaveTextContent('2026-09-28');
    expect(screen.getByTestId('fim-filtro')).toHaveTextContent('2026-10-05');
  });

  it('filtra todos os gráficos pelo card de banco e restaura no segundo clique', async () => {
    const user = userEvent.setup();
    render(<PainelControle />);

    await user.click(screen.getByRole('button', { name: 'Selecionar Banco 1' }));
    expect(screen.getByTestId('cards-bancos')).toHaveAttribute('data-selecionado', 'b1');
    expect(agruparFluxoMock).toHaveBeenLastCalledWith([], expect.objectContaining({ bancoIds: ['b1'] }), 'semana');
    expect(agruparEntradasPorCategoriaMock).toHaveBeenLastCalledWith([], [], expect.objectContaining({ bancoIds: ['b1'] }));
    expect(agruparDespesasPorCategoriaMock).toHaveBeenLastCalledWith([], [], expect.objectContaining({ bancoIds: ['b1'] }));

    await user.click(screen.getByRole('button', { name: 'Selecionar Banco 1' }));
    expect(screen.getByTestId('cards-bancos')).toHaveAttribute('data-selecionado', '');
    expect(agruparFluxoMock).toHaveBeenLastCalledWith([], expect.objectContaining({ bancoIds: [] }), 'semana');
  });

  it('habilita mover e redimensionar somente no modo de edição', async () => {
    const user = userEvent.setup();
    render(<PainelControle />);

    expect(screen.getByTestId('grid')).toHaveAttribute('data-draggable', 'false');
    expect(screen.getByTestId('grid')).toHaveAttribute('data-resizable', 'false');
    expect(screen.queryByText('Arraste o bloco ou redimensione-o usando o ponteiro.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Editar layout' }));
    expect(screen.getByTestId('grid')).toHaveAttribute('data-draggable', 'true');
    expect(screen.getByTestId('grid')).toHaveAttribute('data-resizable', 'true');
    expect(screen.getAllByText('Arraste o bloco ou redimensione-o usando o ponteiro.').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Arrastar bloco Entradas e saídas')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Concluir edição' }));
    expect(screen.getByTestId('grid')).toHaveAttribute('data-draggable', 'false');
    expect(screen.getByTestId('grid')).toHaveAttribute('data-resizable', 'false');
  });

  it('persiste o layout por usuário e tenant, e restaura somente a chave ativa', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<PainelControle />);

    await user.click(screen.getByRole('button', { name: 'Editar layout' }));
    await user.click(screen.getByRole('button', { name: 'Simular layout' }));
    expect(localStorage.getItem('finance-flow:painel-layout:u1:t1')).toContain('"x":1');

    estado.tenantId = 't2';
    rerender(<PainelControle />);
    expect(localStorage.getItem('finance-flow:painel-layout:u1:t2')).toBeNull();

    estado.userId = 'u2';
    rerender(<PainelControle />);
    expect(localStorage.getItem('finance-flow:painel-layout:u2:t2')).toBeNull();

    estado.userId = 'u1';
    estado.tenantId = 't1';
    rerender(<PainelControle />);
    expect(localStorage.getItem('finance-flow:painel-layout:u1:t1')).toContain('"x":1');
    await user.click(screen.getByRole('button', { name: 'Restaurar layout padrão' }));
    expect(localStorage.getItem('finance-flow:painel-layout:u1:t1')).toBeNull();
  });

  it('preserva o layout desktop quando a troca para xs dispara onLayoutChange sincronicamente', async () => {
    const user = userEvent.setup();
    render(<PainelControle />);

    await user.click(screen.getByRole('button', { name: 'Simular transição mobile' }));

    expect(localStorage.getItem('finance-flow:painel-layout:u1:t1')).toContain('"x":2');
    expect(localStorage.getItem('finance-flow:painel-layout:u1:t1')).not.toContain('"x":0');

    expect(screen.getByTestId('grid')).toHaveAttribute('data-layout-lg', expect.stringContaining('"x":2'));
  });

  it('mantém o gráfico visível quando há somente saldo acumulado no período', () => {
    agruparFluxoMock.mockReturnValueOnce([{
      chave: '2026-09-21',
      rotulo: 'seg. 21',
      rotuloCompleto: 'segunda-feira, 21/09',
      inicio: new Date(2026, 8, 21),
      fim: new Date(2026, 8, 21, 23, 59, 59),
      entradas: 0,
      pago: 0,
      aPagar: 0,
      saldoAtual: 0,
      saldoPrevisto: 0,
      saldoAcumulado: 1500,
    }]);

    render(<PainelControle />);

    expect(screen.getByTestId('grafico')).toHaveAttribute('data-pontos', '1');
  });

  it('não propaga erro ou loading auxiliar para o gráfico financeiro', () => {
    estado.categorias = { data: [], isLoading: false, error: new Error('categorias indisponíveis') };
    estado.bancos = { data: [], isLoading: true, error: null };

    render(<PainelControle />);

    expect(screen.getByTestId('grafico')).toHaveAttribute('data-loading', 'false');
    expect(screen.getByTestId('grafico')).toHaveAttribute('data-error', '');
    expect(screen.getByTestId('filtros-controlados')).toHaveAttribute('data-categorias', '0');
  });
});
