---
titulo: Adicionar staleTime nas queries estáticas para reduzir refetches
tipo: ideia
prioridade: baixa
esforco: rapido
arquivo: src/hooks/useBancos.ts
origem: auditoria
data: 2026-05-04
---

## Descrição

Nenhuma query do projeto define `staleTime`. Sem ele, o React Query marca todos os dados como stale imediatamente após o fetch — qualquer refocus de janela dispara um novo request ao Supabase. Para dados que mudam raramente (bancos, categorias, configurações de IA), isso gera requests desnecessários.

## Como resolver

Adicionar `staleTime` nas queries de dados estáticos:

```ts
useQuery({
  queryKey: ['bancos'],
  queryFn: fetchBancos,
  staleTime: 1000 * 60 * 5, // 5 minutos
})
```

Candidates:
- `useBancos` → 5-10 min
- `useCategorias` → 5-10 min
- `useAISettings` → 10 min
- `useApiKeys` → 5 min

Dados dinâmicos como `useLancamentos` devem manter `staleTime: 0` (padrão) para garantir dados frescos.
