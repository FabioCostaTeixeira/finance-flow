import { cloneElement } from 'react';
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { PontoFluxo } from './types';
import { GraficoEntradasSaidas } from './GraficoEntradasSaidas';
import { TooltipFluxo } from './TooltipFluxo';

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();

  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) => (
      <div data-testid="responsive-container">
        {cloneElement(children, { width: 800, height: 320 })}
      </div>
    ),
  };
});

const ponto: PontoFluxo = {
  chave: '2026-09-24',
  rotulo: 'qui. 24',
  rotuloCompleto: 'quinta-feira, 24/09',
  inicio: new Date(2026, 8, 24),
  fim: new Date(2026, 8, 24, 23, 59, 59),
  recebido: 8420,
  aReceber: 0,
  entradas: 8420,
  pago: 4160,
  aPagar: 1280,
  saldoAtual: 4260,
  saldoPrevisto: 2980,
  saldoAcumulado: 7340,
};

function criarProps(override: Partial<React.ComponentProps<typeof GraficoEntradasSaidas>> = {}) {
  return {
    pontos: [ponto],
    visao: 'semana' as const,
    periodoLabel: '21 a 27 de setembro de 2026',
    isLoading: false,
    error: null,
    onVisaoChange: vi.fn(),
    onSemanaAnterior: vi.fn(),
    onProximaSemana: vi.fn(),
    ...override,
  };
}

describe('GraficoEntradasSaidas', () => {
  it('renders the chart controls, legend and weekly navigation', async () => {
    const user = userEvent.setup();
    const onProximaSemana = vi.fn();
    const onVisaoChange = vi.fn();

    render(
      <GraficoEntradasSaidas
        {...criarProps({ onProximaSemana, onVisaoChange })}
      />,
    );

    expect(screen.getByText('Entradas e saídas')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByText('Entradas recebidas')).toBeInTheDocument();
    expect(screen.getByText('Entradas a receber')).toBeInTheDocument();
    expect(screen.getByText('Saídas pagas')).toBeInTheDocument();
    expect(screen.getByText('Saídas a pagar')).toBeInTheDocument();
    expect(screen.getByText('Saldo acumulado')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Próxima semana' }));
    expect(onProximaSemana).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'Visão mensal' }));
    expect(onVisaoChange).toHaveBeenCalledWith('mes');
  });

  it('shows navigation only in weekly view', () => {
    render(<GraficoEntradasSaidas {...criarProps({ visao: 'mes' })} />);

    expect(screen.queryByRole('button', { name: 'Semana anterior' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Próxima semana' })).not.toBeInTheDocument();
  });

  it.each([
    {
      props: { isLoading: true },
      text: 'Carregando fluxo financeiro...',
    },
    {
      props: { error: new Error('Falha ao carregar') },
      text: 'Não foi possível carregar o fluxo financeiro.',
    },
    {
      props: { pontos: [] },
      text: 'Nenhum lançamento encontrado para os filtros selecionados.',
    },
  ])('renders its $text state', ({ props, text }) => {
    render(<GraficoEntradasSaidas {...criarProps(props)} />);

    const estado = screen.getByText(text);
    expect(estado).toBeInTheDocument();
    expect(estado).toHaveAttribute('role', props.error ? 'alert' : 'status');
  });
});

describe('TooltipFluxo', () => {
  it('shows the selected period, movements and point balances in BRL', () => {
    render(<TooltipFluxo active payload={[{ payload: ponto }]} />);

    expect(screen.getByText('quinta-feira, 24/09')).toBeInTheDocument();
    expect(screen.getByText('Entradas recebidas')).toBeInTheDocument();
    expect(screen.getByText('Entradas a receber')).toBeInTheDocument();
    expect(screen.getByText('Saídas pagas')).toBeInTheDocument();
    expect(screen.getByText('Saídas a pagar')).toBeInTheDocument();
    expect(screen.getByText('Saldo atual')).toBeInTheDocument();
    expect(screen.getByText('Saldo previsto')).toBeInTheDocument();
    expect(screen.getByText('Saldo acumulado')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*8\.420,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*4\.160,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*1\.280,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*4\.260,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*2\.980,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*7\.340,00/)).toBeInTheDocument();
  });

  it('formata saldo acumulado negativo em BRL', () => {
    render(<TooltipFluxo active payload={[{ payload: { ...ponto, saldoAcumulado: -500 } }]} />);

    expect(screen.getByText(/-R\$\s*500,00/)).toBeInTheDocument();
  });

  it.each([
    { active: false, payload: [{ payload: ponto }] },
    { active: true, payload: undefined },
    { active: true, payload: [] },
    { active: true, payload: [{}] },
  ])('renders nothing without a complete active Recharts payload', ({ active, payload }) => {
    const { container } = render(<TooltipFluxo active={active} payload={payload} />);

    expect(container).toBeEmptyDOMElement();
  });
});
