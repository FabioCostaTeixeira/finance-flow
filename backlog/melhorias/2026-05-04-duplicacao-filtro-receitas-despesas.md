---
titulo: Lógica de filtro duplicada entre Receitas.tsx e Despesas.tsx
tipo: melhoria
prioridade: media
esforco: medio
arquivo: src/pages/Receitas.tsx
origem: auditoria
data: 2026-05-04
---

## Descrição

`Receitas.tsx` e `Despesas.tsx` contêm cópias praticamente idênticas de:
- `filteredLancamentos` (useMemo com filtros por status, categoria, banco, período)
- `getParentCategoryId` (função auxiliar de hierarquia de categorias)

Qualquer correção de bug no filtro precisa ser aplicada nos dois arquivos manualmente, com risco de divergência.

## Como resolver

Criar `src/hooks/useLancamentosFilter.ts`:

```ts
export function useLancamentosFilter(lancamentos: Lancamento[], filtros: Filtros) {
  const filteredLancamentos = useMemo(() => {
    // lógica atual de Receitas.tsx/Despesas.tsx
  }, [lancamentos, filtros])

  return { filteredLancamentos }
}
```

Substituir o bloco duplicado em ambas as páginas pelo hook. A função `getParentCategoryId` pode virar um utilitário em `src/lib/` se não depender de estado React.
