---
titulo: QueryClient instanciado no nível do módulo em App.tsx
tipo: correcao
prioridade: alta
esforco: rapido
arquivo: src/App.tsx:26
origem: auditoria
data: 2026-05-05
---

## Descrição

`const queryClient = new QueryClient()` está na linha 26 de `App.tsx`, fora de qualquer componente ou hook. Isso viola a recomendação oficial do TanStack Query:

- Em desenvolvimento com HMR, o módulo não é reexecutado mas o componente é remontado, fazendo com que a nova instância do provider receba o mesmo `queryClient` com cache da sessão anterior
- Em testes unitários/integração, o cache nunca é resetado entre casos de teste, podendo causar vazamento de estado entre testes
- Em Strict Mode do React (que monta/desmonta duas vezes), a instância é compartilhada sem problemas, mas se movida para `useState`, fica mais explícito e correto

## Como resolver

Mover a instância para `useState` no componente raiz:

```tsx
// Antes (linha 26):
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    ...
  </QueryClientProvider>
);

// Depois:
const App = () => {
  const [queryClient] = useState(() => new QueryClient());
  
  return (
    <QueryClientProvider client={queryClient}>
      ...
    </QueryClientProvider>
  );
};
```

O `useState` com inicializador garante que a instância é criada uma única vez por montagem do componente, mas não sobrevive a um unmount completo.
