import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SaldoBancoPainel } from './types';
import { CardsSaldoBancos } from './CardsSaldoBancos';

const saldos: SaldoBancoPainel[] = [
  {
    bancoId: 'b1',
    nome: 'Banco Principal',
    recebido: 1200,
    pago: 300,
    aReceber: 100,
    aPagar: 50,
    saldoAtual: 900,
    saldoPrevisto: 950,
  },
  {
    bancoId: 'b2',
    nome: 'Reserva',
    recebido: 0,
    pago: 500,
    aReceber: 0,
    aPagar: 0,
    saldoAtual: -500,
    saldoPrevisto: -500,
  },
  {
    bancoId: 'b3',
    nome: 'Terceiro Banco',
    recebido: 300,
    pago: 0,
    aReceber: 0,
    aPagar: 0,
    saldoAtual: 300,
    saldoPrevisto: 300,
  },
  {
    bancoId: 'b4',
    nome: 'Quarto Banco',
    recebido: 400,
    pago: 0,
    aReceber: 0,
    aPagar: 0,
    saldoAtual: 400,
    saldoPrevisto: 400,
  },
  {
    bancoId: 'b5',
    nome: 'Quinto Banco',
    recebido: 500,
    pago: 0,
    aReceber: 0,
    aPagar: 0,
    saldoAtual: 500,
    saldoPrevisto: 500,
  },
];

describe('CardsSaldoBancos', () => {
  it('mostra um card clicável por banco com os valores do período', () => {
    render(
      <CardsSaldoBancos
        saldos={saldos}
        bancoSelecionadoId={null}
        isLoading={false}
        error={null}
        onBancoClick={vi.fn()}
      />,
    );

    const bancoPrincipal = screen.getByRole('button', { name: /Banco Principal.*Saldo realizado.*Saldo previsto/i });
    expect(bancoPrincipal).toHaveAttribute('aria-pressed', 'false');
    expect(bancoPrincipal).toHaveTextContent('R$ 900,00');
    expect(bancoPrincipal).toHaveTextContent('Saldo previsto R$ 950,00');
    expect(screen.getByRole('button', { name: /Reserva.*Saldo realizado.*Saldo previsto/i }))
      .toHaveTextContent('-R$ 500,00');
  });

  it('organiza cinco bancos no carrossel com controles de navegação', () => {
    render(
      <CardsSaldoBancos
        saldos={saldos}
        bancoSelecionadoId={null}
        isLoading={false}
        error={null}
        onBancoClick={vi.fn()}
      />,
    );

    expect(screen.getByRole('region', { name: 'Carrossel de saldos por banco' })).toBeInTheDocument();
    expect(screen.getAllByRole('group', { name: /Banco \d de 5/i })).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Ver bancos anteriores' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver próximos bancos' })).toBeInTheDocument();
  });

  it('alterna o banco selecionado pelo clique', async () => {
    const user = userEvent.setup();
    const onBancoClick = vi.fn();

    render(
      <CardsSaldoBancos
        saldos={saldos}
        bancoSelecionadoId="b1"
        isLoading={false}
        error={null}
        onBancoClick={onBancoClick}
      />,
    );

    const bancoPrincipal = screen.getByRole('button', { name: /Banco Principal/i });
    expect(bancoPrincipal).toHaveAttribute('aria-pressed', 'true');

    await user.click(bancoPrincipal);
    await user.click(screen.getByRole('button', { name: /Reserva/i }));

    expect(onBancoClick).toHaveBeenNthCalledWith(1, 'b1');
    expect(onBancoClick).toHaveBeenNthCalledWith(2, 'b2');
  });

  it('mostra estados de carregamento, erro e ausência de bancos', () => {
    const props = {
      saldos: [],
      bancoSelecionadoId: null,
      onBancoClick: vi.fn(),
    };
    const { rerender } = render(<CardsSaldoBancos {...props} isLoading error={null} />);
    expect(screen.getByText('Carregando saldos por banco...')).toBeInTheDocument();

    rerender(<CardsSaldoBancos {...props} isLoading={false} error={new Error('Falha de rede')} />);
    expect(screen.getByText('Falha de rede')).toBeInTheDocument();

    rerender(<CardsSaldoBancos {...props} isLoading={false} error={null} />);
    expect(screen.getByText('Nenhum banco cadastrado.')).toBeInTheDocument();
  });
});
