import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({ selected, onSelect, disabled }: {
    selected?: Date;
    onSelect?: (date: Date) => void;
    disabled?: (date: Date) => boolean;
  }) => {
    const octoberFirst = new Date(2026, 9, 1);
    const septemberTwentieth = new Date(2026, 8, 20);

    return (
      <div>
        <button type="button" onClick={() => onSelect?.(octoberFirst)}>Selecionar 01/10/2026</button>
        <button
          type="button"
          disabled={disabled?.(septemberTwentieth)}
          onClick={() => onSelect?.(septemberTwentieth)}
        >
          Selecionar 20/09/2026
        </button>
        <span>{selected?.toISOString()}</span>
      </div>
    );
  },
}));
import type { Categoria } from '@/hooks/useCategorias';
import type { FiltrosPainel } from './types';
import { PainelFiltros } from './PainelFiltros';

const categorias: Categoria[] = [
  {
    id: 'cat1',
    nome: 'Moradia',
    nome_normalizado: 'moradia',
    tipo: 'despesa',
    categoria_pai_id: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'sub1',
    nome: 'Aluguel',
    nome_normalizado: 'aluguel',
    tipo: 'despesa',
    categoria_pai_id: 'cat1',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'sub2',
    nome: 'Condomínio',
    nome_normalizado: 'condominio',
    tipo: 'despesa',
    categoria_pai_id: 'cat1',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'cat2',
    nome: 'Transporte',
    nome_normalizado: 'transporte',
    tipo: 'despesa',
    categoria_pai_id: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'sub3',
    nome: 'Combustível',
    nome_normalizado: 'combustivel',
    tipo: 'despesa',
    categoria_pai_id: 'cat2',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
];

const filtros = (override: Partial<FiltrosPainel> = {}): FiltrosPainel => ({
  inicio: new Date(2026, 8, 21),
  fim: new Date(2026, 8, 27),
  categoriaIds: [],
  subcategoriaIds: [],
  bancoIds: [],
  statusList: [],
  ...override,
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}

describe('PainelFiltros', () => {
  it('habilita subcategorias apenas após selecionar uma categoria pai', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <PainelFiltros
        filtros={filtros()}
        categorias={categorias}
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText('Categoria')).toBeInTheDocument();
    expect(screen.getByLabelText('Subcategoria')).toBeDisabled();

    await user.click(screen.getByLabelText('Categoria'));
    await user.click(screen.getByText('Moradia'));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      categoriaIds: ['cat1'],
      subcategoriaIds: [],
    }));
  });

  it('lists only children of selected parent categories and removes incompatible child selections', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <PainelFiltros
        filtros={filtros({ categoriaIds: ['cat1'], subcategoriaIds: ['sub1'] })}
        categorias={categorias}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByLabelText('Subcategoria'));

    expect(screen.getByRole('option', { name: /Aluguel/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Condomínio/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Combustível/i })).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Categoria'));
    await user.click(screen.getByRole('option', { name: /Moradia/i }));

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      categoriaIds: [],
      subcategoriaIds: [],
    }));
  });

  it('keeps child selections valid for a parent that remains selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <PainelFiltros
        filtros={filtros({ categoriaIds: ['cat1', 'cat2'], subcategoriaIds: ['sub1', 'sub3'] })}
        categorias={categorias}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByLabelText('Categoria'));
    await user.click(screen.getByText('Moradia'));

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      categoriaIds: ['cat2'],
      subcategoriaIds: ['sub3'],
    }));
  });

  it('não exibe filtro de banco e mantém filtro de status', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    function FiltrosControlados() {
      const [filtrosAtuais, setFiltrosAtuais] = useState(filtros());
      const alterarFiltros = (proximosFiltros: FiltrosPainel) => {
        onChange(proximosFiltros);
        setFiltrosAtuais(proximosFiltros);
      };

      return (
        <PainelFiltros
          filtros={filtrosAtuais}
          categorias={categorias}
          onChange={alterarFiltros}
        />
      );
    }

    render(<FiltrosControlados />);

    expect(screen.queryByLabelText('Banco')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Status'));
    await user.click(screen.getByRole('option', { name: /A Receber/i }));
    await user.click(screen.getByRole('option', { name: /Pago/i }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      statusList: ['a_receber', 'pago'],
    }));
  });

  it('exposes all computed statuses and keeps the checkbox decorative', async () => {
    const user = userEvent.setup();

    render(
      <PainelFiltros
        filtros={filtros({ statusList: ['pago'] })}
        categorias={categorias}
        onChange={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText('Status'));

    for (const status of [
      'A Receber',
      'Recebido',
      'A Pagar',
      'Pago',
      'Parcial',
      'Atrasado',
      'Vencida',
      'Transferência',
    ]) {
      expect(screen.getByRole('option', { name: status })).toBeInTheDocument();
    }

    expect(screen.getByRole('option', { name: 'Pago' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('moves the end date forward when a new start date would invert the period', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <PainelFiltros
        filtros={filtros()}
        categorias={categorias}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByLabelText('Data inicial'));
    await user.click(screen.getByRole('button', { name: 'Selecionar 01/10/2026' }));

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      inicio: new Date(2026, 9, 1),
      fim: new Date(2026, 9, 1),
    }));
  });

  it('does not allow selecting an end date before the start date', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <PainelFiltros
        filtros={filtros()}
        categorias={categorias}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByLabelText('Data final'));

    expect(screen.getByRole('button', { name: 'Selecionar 20/09/2026' })).toBeDisabled();
  });
});
