---
titulo: useBaixarLancamento faz chamadas Supabase sequenciais que poderiam ser paralelas
tipo: ideia
prioridade: baixa
esforco: rapido
arquivo: src/hooks/useLancamentos.ts
origem: auditoria
data: 2026-05-04
---

## Descrição

`useBaixarLancamento` executa `update lancamentos` e depois `update bancos` de forma sequencial com dois awaits encadeados. As duas operações são independentes — não há motivo para esperar a primeira completar antes de iniciar a segunda.

## Como resolver

Paralelizar com `Promise.all`:

```ts
await Promise.all([
  supabase.from('lancamentos').update({ status: 'pago', ... }).eq('id', id),
  supabase.from('bancos').update({ saldo: novoSaldo }).eq('id', bancoId),
])
```

Reduz a latência percebida pela metade (dois round-trips → um). Verificar se há dependência de dados entre as chamadas antes de paralelizar.
