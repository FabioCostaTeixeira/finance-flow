---
titulo: Criar helper renderWithProviders para testes de componente
tipo: melhoria
prioridade: media
esforco: rapido
arquivo: src/test/utils.tsx
origem: auditoria
data: 2026-05-09
---

## Descrição

Não existe `renderWithProviders` nem qualquer helper de teste compartilhado em `src/test/`. O arquivo `src/test/setup.ts` apenas importa `@testing-library/jest-dom`, sem wrapper de providers.

Sem esse helper, cada teste de componente que depende de React Query, React Router ou AuthContext precisará configurar os providers manualmente, levando a código duplicado e testes inconsistentes. É o principal pré-requisito para escrever testes de componente no projeto.

## Como resolver

Criar `src/test/utils.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReactElement } from 'react';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function AllProviders({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export * from '@testing-library/react';
export { renderWithProviders };
```

Após criar o helper, usá-lo como base para os primeiros testes de componente prioritários: `AlertasNotificacao`, `LancamentosTable` e `BaixaModal`.
