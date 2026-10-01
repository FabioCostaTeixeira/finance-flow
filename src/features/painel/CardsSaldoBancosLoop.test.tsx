import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SaldoBancoPainel } from './types';

const carouselMock = vi.hoisted(() => vi.fn());

vi.mock('@/components/ui/carousel', () => ({
  Carousel: ({ children, opts }: { children: ReactNode; opts?: unknown }) => {
    carouselMock(opts);
    return <div>{children}</div>;
  },
  CarouselContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CarouselItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CarouselPrevious: () => <button type="button">Anterior</button>,
  CarouselNext: () => <button type="button">Próximo</button>,
}));

import { CardsSaldoBancos } from './CardsSaldoBancos';

const saldos: SaldoBancoPainel[] = [{
  bancoId: 'b1',
  nome: 'Banco Principal',
  recebido: 1200,
  pago: 300,
  aReceber: 100,
  aPagar: 50,
  saldoAtual: 900,
  saldoPrevisto: 950,
}];

describe('CardsSaldoBancos', () => {
  it('mantém navegação contínua entre primeiro e último banco', () => {
    render(
      <CardsSaldoBancos
        saldos={saldos}
        bancoSelecionadoId={null}
        isLoading={false}
        error={null}
        onBancoClick={vi.fn()}
      />,
    );

    expect(carouselMock).toHaveBeenCalledWith(expect.objectContaining({ loop: true }));
  });
});
