---
titulo: Estado de erro do React Query ignorado em Receitas, Despesas e FluxoCaixa
tipo: melhoria
prioridade: media
esforco: rapido
arquivo: src/pages/Receitas.tsx
origem: auditoria
data: 2026-05-09
---

## Descrição

As páginas `Receitas.tsx`, `Despesas.tsx` e `FluxoCaixa.tsx` desestruturaram apenas `{ data, isLoading }` do hook `useLancamentos`, ignorando `error`. Se a query falhar (token expirado, rede offline, RLS blocking), a página exibe tela em branco ou dados vazios sem nenhum feedback ao usuário.

```ts
// Atual
const { lancamentos, isLoading } = useLancamentos(filters);

// Esperado
const { lancamentos, isLoading, error } = useLancamentos(filters);
if (error) return <ErrorState message="Não foi possível carregar os lançamentos." />;
```

## Como resolver

1. Expor `error` no retorno de `useLancamentos`
2. Nas páginas, verificar `error` e exibir um componente de erro amigável (já existe padrão de `EmptyState` — criar `ErrorState` análogo ou usar um toast/alert)
3. Aplicar o mesmo padrão em todos os hooks de página que retornam dados críticos
