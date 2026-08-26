import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

/**
 * Bug real reportado: editar o valor de um lançamento JÁ quitado
 * (recebido/pago) não refletia no Fluxo de Caixa. Causa: o formulário de
 * edição só grava `valor`, mas o Fluxo de Caixa (e qualquer tela que trate
 * o lançamento como liquidado) usa `valor_pago` para linhas quitadas —
 * `realizado = valorPago || valor` em src/pages/FluxoCaixa.tsx. As duas
 * colunas ficavam dessincronizadas após a edição.
 */

const updateMock = vi.fn();
const eqMock = vi.fn();
const selectMock = vi.fn();
const singleMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      update: (payload: Record<string, unknown>) => {
        updateMock(payload);
        return { eq: eqMock };
      },
    }),
  },
}));

beforeEach(() => {
  updateMock.mockClear();
  eqMock.mockReset().mockReturnValue({ select: selectMock });
  selectMock.mockReset().mockReturnValue({ single: singleMock });
  singleMock.mockReset().mockResolvedValue({ data: { id: 'l1' }, error: null });
});

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe('useUpdateLancamento: sincronização de valor_pago em lançamentos quitados', () => {
  it('ao editar valor de um lançamento RECEBIDO, também atualiza valor_pago', async () => {
    const { useUpdateLancamento } = await import('./useUpdateLancamento');
    const { result } = renderHook(() => useUpdateLancamento(), { wrapper });

    result.current.mutate({ id: 'l1', valor: 2000, statusAtual: 'recebido' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ valor: 2000, valor_pago: 2000 })
    );
  });

  it('ao editar valor de um lançamento A_RECEBER (ainda não quitado), NÃO mexe em valor_pago', async () => {
    const { useUpdateLancamento } = await import('./useUpdateLancamento');
    const { result } = renderHook(() => useUpdateLancamento(), { wrapper });

    result.current.mutate({ id: 'l1', valor: 2000, statusAtual: 'a_receber' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const payload = updateMock.mock.calls[0][0];
    expect(payload.valor).toBe(2000);
    expect(payload).not.toHaveProperty('valor_pago');
  });

  it('ao editar valor de um lançamento PARCIAL, NÃO mexe em valor_pago (é o quanto já foi pago, não o total)', async () => {
    const { useUpdateLancamento } = await import('./useUpdateLancamento');
    const { result } = renderHook(() => useUpdateLancamento(), { wrapper });

    result.current.mutate({ id: 'l1', valor: 2000, statusAtual: 'parcial' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const payload = updateMock.mock.calls[0][0];
    expect(payload).not.toHaveProperty('valor_pago');
  });
});
