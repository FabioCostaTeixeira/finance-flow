---
titulo: getStatusBadge e canBaixar definidos dentro do corpo de LancamentosTable
tipo: melhoria
prioridade: media
esforco: rapido
arquivo: src/components/LancamentosTable.tsx:262-292
origem: auditoria
data: 2026-05-05
---

## Descrição

Dois helpers são definidos dentro do corpo de `LancamentosTable`:

- `getStatusBadge` (linha 262): retorna JSX — recriada a cada render, chama `getComputedStatus` + `getStatusConfig` e constrói um `<span>`
- `canBaixar` (linha 283): retorna boolean — também recriada a cada render

Para uma tabela com animação `motion.tr` em cada linha, isso pode causar work desnecessário. Além disso, `getStatusBadge` retorna JSX a partir de uma função simples — o padrão do projeto é usar componentes para isso (como já foi feito com `StatusLabel` em FluxoCaixa).

## Como resolver

**`canBaixar`:** extrair como função pura fora do componente, pois não depende de nenhum state ou prop do componente:

```ts
function canBaixar(lancamento: LancamentoExtendido): boolean {
  const computedStatus = getComputedStatus({
    status: lancamento.status,
    tipo: lancamento.tipo,
    data_vencimento: lancamento.data_vencimento,
    valor: lancamento.valor,
    valor_pago: lancamento.valor_pago,
  });
  return ['a_receber', 'a_pagar', 'parcial', 'atrasado', 'vencida'].includes(computedStatus);
}
```

**`getStatusBadge`:** extrair como componente:

```tsx
function StatusBadge({ lancamento, tipo }: { lancamento: LancamentoExtendido; tipo: 'receita' | 'despesa' }) {
  const computedStatus = getComputedStatus({
    status: lancamento.status,
    tipo: lancamento.tipo,
    data_vencimento: lancamento.data_vencimento,
    valor: lancamento.valor,
    valor_pago: lancamento.valor_pago,
  });
  const config = getStatusConfig(computedStatus, tipo);
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border', config.className)}>
      {config.label}
    </span>
  );
}
```
