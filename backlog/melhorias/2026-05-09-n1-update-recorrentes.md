---
titulo: N+1 queries em useUpdateRecurringLancamentos ao alterar data_vencimento
tipo: melhoria
prioridade: media
esforco: medio
arquivo: src/hooks/useUpdateLancamento.ts
origem: auditoria
data: 2026-05-09
---

## Descrição

Quando `data_vencimento` muda em uma série recorrente, `useUpdateRecurringLancamentos` dispara N chamadas individuais ao Supabase em `Promise.all`:

```ts
const promises = openLancamentos.map((lanc, i) => {
  return supabase.from('lancamentos').update({...}).eq('id', lanc.id).select().single();
});
const results = await Promise.all(promises);
```

Para uma série com 12 parcelas, isso gera 12 requisições HTTP simultâneas. Para 24 parcelas, 24 — e cada uma tem custo no Supabase e na rede.

## Como resolver

Usar um único `UPDATE` com `IN` e calcular as datas via lógica no cliente (ou via função do banco):

```ts
// Opção 1: update em lote com IDs (sem recalcular datas individuais)
// Só funciona se a lógica de datas puder ser expressa como offset

// Opção 2: RPC/stored procedure que recebe array de {id, data_vencimento}
// e faz o UPDATE em transação

// Opção 3: manter Promise.all mas limitar a 5 por vez com p-limit
```

A opção 3 é a mais simples de implementar sem alterar o banco. A opção 2 é a mais eficiente para séries longas.
