import { cloneElement } from 'react';
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import type { CategoriaRanking } from './types';
import { GraficoEntradasPorCategoria } from './GraficoEntradasPorCategoria';

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

const ranking: CategoriaRanking[] = [
  { categoriaId: 'cat1', nome: 'Serviços', recebido: 900, aReceber: 100, total: 1000 },
  { categoriaId: 'cat2', nome: 'Vendas', recebido: 300, aReceber: 0, total: 300 },
];

function criarProps(override: Partial<React.ComponentProps<typeof GraficoEntradasPorCategoria>> = {}) {
  return {
    ranking,
    periodoLabel: '21 a 27 de setembro de 2026',
    isLoading: false,
    error: null,
    ...override,
  };
}

describe('GraficoEntradasPorCategoria', () => {
  it('renders the ranking chart with its period label', () => {
    render(<GraficoEntradasPorCategoria {...criarProps()} />);

    expect(screen.getByText('Entradas por categoria')).toBeInTheDocument();
    expect(screen.getByText('21 a 27 de setembro de 2026')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getAllByText('Serviços').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Vendas').length).toBeGreaterThan(0);
  });

  it.each([
    {
      props: { isLoading: true },
      text: 'Carregando entradas por categoria...',
    },
    {
      props: { error: new Error('Falha ao carregar') },
      text: 'Não foi possível carregar as entradas por categoria.',
    },
    {
      props: { ranking: [] },
      text: 'Nenhuma entrada encontrada para os filtros selecionados.',
    },
  ])('renders its $text state', ({ props, text }) => {
    render(<GraficoEntradasPorCategoria {...criarProps(props)} />);

    const estado = screen.getByText(text);
    expect(estado).toBeInTheDocument();
    expect(estado).toHaveAttribute('role', props.error ? 'alert' : 'status');
  });
});
