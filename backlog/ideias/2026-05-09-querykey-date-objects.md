---
titulo: queryKey com objetos Date pode causar cache miss espúrio em useBancosComSaldos
tipo: ideia
prioridade: baixa
esforco: rapido
arquivo: src/hooks/useBancos.ts
origem: auditoria
data: 2026-05-09
---

## Descrição

O `queryKey` de `useBancosComSaldos` inclui objetos `Date`:

```ts
queryKey: ['bancosComSaldos', startDate, endDate]
```

O React Query serializa queryKeys com `JSON.stringify`, que transforma `Date` em string ISO. Isso funciona na prática, mas pode ser frágil se o comportamento de serialização mudar entre versões ou se datas `undefined` forem passadas de formas diferentes.

## Como resolver

Serializar explicitamente no queryKey para tornar o comportamento claro e robusto:

```ts
queryKey: ['bancosComSaldos', startDate?.toISOString() ?? null, endDate?.toISOString() ?? null]
```

Isso também melhora a legibilidade do DevTools do React Query.
