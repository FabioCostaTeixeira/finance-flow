---
titulo: Bulk delete pode orphanizar uma perna da transferência
tipo: correcao
prioridade: alta
esforco: medio
arquivo: src/components/LancamentosTable.tsx:285
origem: auditoria
data: 2026-05-09
---

## Descrição

`isSelectable` em `LancamentosTable.tsx` (~linha 285) é:

```ts
const isSelectable = !['recebido', 'pago'].includes(lancamento.status);
```

Lançamentos com `status: 'transferencia'` passam nesse filtro e ficam **selecionáveis**. Quando o usuário aciona "deletar selecionados", `handleDeleteSelected` chama `deleteLancamentosEmLote` com os IDs marcados — mas transferências existem em pares vinculados por `transferencia_vinculo_id`. Deletar apenas um dos IDs deixa a perna oposta órfã no banco, gerando saldo inconsistente.

O mesmo problema existe em `lancamentosDeletaveis` (~linha 129), usado para a opção "deletar todos filtrados".

## Como resolver

Excluir transferências da seleção em massa:

```ts
const isSelectable = !['recebido', 'pago', 'transferencia'].includes(lancamento.status);
```

E em `lancamentosDeletaveis`:

```ts
.filter(l => !['recebido', 'pago', 'transferencia'].includes(l.status))
```

Alternativa mais robusta: ao deletar, buscar o par via `transferencia_vinculo_id` e deletar ambos, ou proibir delete de qualquer transferência pelo fluxo de bulk.
