---
titulo: statusLabels em recurrence.ts duplica labels já presentes em getStatusConfig
tipo: ideia
prioridade: baixa
esforco: rapido
arquivo: src/lib/recurrence.ts:117-125
origem: auditoria
data: 2026-05-05
---

## Descrição

`recurrence.ts` exporta:

```ts
export const statusLabels: Record<string, string> = {
  a_receber: 'A Receber',
  recebido: 'Recebido',
  a_pagar: 'A Pagar',
  pago: 'Pago',
  parcial: 'Parcial',
  atrasado: 'Atrasado',
  vencida: 'Vencida',
};
```

O único consumidor é `LancamentosFilters.tsx` para montar opções de filtro de status. Esses mesmos labels já existem em `statusUtils.ts` via `getStatusConfig(status).label` — mais completo pois inclui `transferencia` e o estilo visual.

Manter dois sources of truth para labels de status cria risco de divergência (ex: renomear "Vencida" em um e esquecer no outro).

## Como resolver

Em `LancamentosFilters.tsx`, substituir:

```ts
import { statusLabels } from '@/lib/recurrence';
// ...
label: statusLabels[s as keyof typeof statusLabels]
```

Por:

```ts
import { getStatusConfig } from '@/lib/statusUtils';
// ...
label: getStatusConfig(s as StatusLancamento).label
```

Depois, remover `statusLabels` de `recurrence.ts` pois ficará sem uso.

**Atenção:** verificar se `statusOptions` em `LancamentosFilters.tsx` inclui `transferencia` — se não incluir, o comportamento atual está correto e a substituição é segura.
