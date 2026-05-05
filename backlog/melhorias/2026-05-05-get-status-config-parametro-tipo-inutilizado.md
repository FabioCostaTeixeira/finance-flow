---
titulo: Parâmetro tipo nunca lido em getStatusConfig
tipo: melhoria
prioridade: baixa
esforco: rapido
arquivo: src/lib/statusUtils.ts:62
origem: auditoria
data: 2026-05-05
---

## Descrição

A função `getStatusConfig` tem a assinatura:

```ts
export function getStatusConfig(status: StatusLancamento, tipo: 'receita' | 'despesa')
```

Mas o parâmetro `tipo` nunca é referenciado dentro do corpo da função. A config de cada status é a mesma independentemente de ser receita ou despesa. Isso cria confusão: quem lê o código assume que `tipo` muda o resultado, mas não muda.

Todos os call sites passam `tipo` desnecessariamente, incluindo `LancamentosTable.tsx` e `FluxoCaixa.tsx`.

## Como resolver

Remover o parâmetro `tipo` da assinatura:

```ts
export function getStatusConfig(status: StatusLancamento) {
  // ... sem alterar o corpo
}
```

Depois atualizar todos os call sites:
- `src/components/LancamentosTable.tsx` — `getStatusConfig(computedStatus, tipo)` → `getStatusConfig(computedStatus)`
- `src/pages/FluxoCaixa.tsx` — `getStatusConfig(lancamento.status as StatusLancamento, lancamento.tipo)` → `getStatusConfig(lancamento.status as StatusLancamento)`
- Quaisquer outros usos encontrados via grep

Se no futuro a exibição precisar variar por tipo (ex: "A Receber" vs "A Pagar" em contexto diferente), o parâmetro pode ser reintroduzido com uso real.
