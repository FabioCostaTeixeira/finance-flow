---
titulo: Adicionar staleTime em useBancosComSaldos
tipo: melhoria
prioridade: alta
esforco: rapido
arquivo: src/hooks/useBancos.ts
origem: auditoria
data: 2026-05-09
---

## Descrição

`useBancosComSaldos` é uma RPC cara (join + soma de saldos por período) e não tem `staleTime`. Refetcha a cada foco de janela. `useBancos` (lista simples) já tem `staleTime: 1000 * 60 * 5`, mas `useBancosComSaldos` foi esquecido.

Além disso, o `queryKey` usa objetos `Date` diretamente: `['bancosComSaldos', startDate, endDate]`. Objetos Date não são serializados por referência pelo React Query — duas datas iguais com referências diferentes são tratadas como chaves distintas, causando refetches desnecessários.

## Como resolver

```ts
useQuery({
  queryKey: ['bancosComSaldos', startDate?.toISOString(), endDate?.toISOString()],
  queryFn: ...,
  staleTime: 1000 * 60 * 2,
})
```

Serializar as datas para ISO string no queryKey garante cache hit correto.
