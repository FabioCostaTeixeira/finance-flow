---
titulo: KPIs de Receitas e Despesas usam status bruto em vez de status computado
tipo: melhoria
prioridade: media
esforco: rapido
arquivo: src/pages/Receitas.tsx
origem: auditoria
data: 2026-05-09
---

## Descrição

Os cálculos de KPI em `Receitas.tsx` e `Despesas.tsx` filtram por `l.status` diretamente:

```ts
const totalAReceber = filteredLancamentos
  .filter((l) => ['a_receber', 'parcial'].includes(l.status))
  .reduce(...);
```

Porém, lançamentos vencidos (data passada + status `a_receber`/`a_pagar`) têm status `atrasado`/`vencida` **computado** por `getComputedStatus()` — mas o DB ainda armazena `a_receber`/`a_pagar`. O KPI `totalAReceber` subestima o total real porque não inclui os atrasados que ainda "deveriam receber".

## Como resolver

Aplicar `getComputedStatus` antes de filtrar:

```ts
import { getComputedStatus } from '@/lib/statusUtils';

const totalAReceber = filteredLancamentos
  .filter((l) => {
    const s = getComputedStatus(l.status, l.data_vencimento);
    return ['a_receber', 'parcial', 'atrasado'].includes(s);
  })
  .reduce(...);
```

O mesmo ajuste deve ser aplicado nos KPIs de Despesas (`a_pagar` + `vencida`).
