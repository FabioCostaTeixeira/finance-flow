---
titulo: Transferências aparecem como alertas de atraso em AlertasNotificacao
tipo: correcao
prioridade: alta
esforco: rapido
arquivo: src/components/AlertasNotificacao.tsx:64
origem: auditoria
data: 2026-05-09
---

## Descrição

Em `AlertasNotificacao.tsx` a verificação de quitação é:

```ts
const jaQuitado = ['recebido', 'pago'].includes(lancamento.status);
```

Lançamentos do tipo `transferencia` têm `status: 'transferencia'`, que **não está na lista**. Como resultado, transferências com `diasDiff > 0` são classificadas como `despesa_atrasada` e aparecem no painel de alertas como contas vencidas, mesmo sendo entradas já liquidadas.

## Como resolver

Incluir `'transferencia'` na verificação de quitado:

```ts
const jaQuitado = ['recebido', 'pago', 'transferencia'].includes(lancamento.status);
```

Ou, mais explicitamente, filtrar transferências antes de entrar na lógica de alertas:

```ts
if (lancamento.status === 'transferencia') return; // pula no reduce/forEach
```
