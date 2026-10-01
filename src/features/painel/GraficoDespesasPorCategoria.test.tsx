import { cloneElement } from 'react';
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import type { CategoriaDespesaRanking } from './types';
import { GraficoDespesasPorCategoria } from './GraficoDespesasPorCategoria';

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();

  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) => (
      <div data-testid="responsive-container">
        {cloneElement(children, { width: 400, height: 320 })}
      </div>
    ),
  };
});

const ranking: CategoriaDespesaRanking[] = [
  { categoriaId: 'cat1', nome: 'Aluguel', pago: 2000, aPagar: 0, total: 2000 },
  { categoriaId: 'cat2', nome: 'Fornecedores', pago: 500, aPagar: 300, total: 800 },
];

function criarProps(override: Partial<React.ComponentProps<typeof GraficoDespesasPorCategoria>> = {}) {
  return {
    ranking,
    periodoLabel: '21 a 27 de setembro de 2026',
    isLoading: false,
    error: null,
    ...override,
  };
}

describe('GraficoDespesasPorCategoria', () => {
  it('renders the expense ranking chart with its period label', () => {
    render(<GraficoDespesasPorCategoria {...criarProps()} />);

    expect(screen.getByText('Despesas por categoria')).toBeInTheDocument();
    expect(screen.getByText('21 a 27 de setembro de 2026')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getAllByText('Aluguel').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Fornecedores').length).toBeGreaterThan(0);
  });

  it.each([
    {
      props: { isLoading: true },
      text: 'Carregando despesas por categoria...',
    },
    {
      props: { error: new Error('Falha ao carregar') },
      text: 'Não foi possível carregar as despesas por categoria.',
    },
    {
      props: { ranking: [] },
      text: 'Nenhuma despesa encontrada para os filtros selecionados.',
    },
  ])('renders its $text state', ({ props, text }) => {
    render(<GraficoDespesasPorCategoria {...criarProps(props)} />);

    const estado = screen.getByText(text);
    expect(estado).toBeInTheDocument();
    expect(estado).toHaveAttribute('role', props.error ? 'alert' : 'status');
  });
});
