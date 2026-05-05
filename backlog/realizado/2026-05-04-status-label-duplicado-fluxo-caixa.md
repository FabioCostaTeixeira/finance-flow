---
titulo: getStatusLabel definida inline em FluxoCaixa.tsx, duplica statusUtils
tipo: melhoria
prioridade: media
esforco: rapido
arquivo: src/pages/FluxoCaixa.tsx:164
origem: auditoria
data: 2026-05-04
---

## Descrição

`FluxoCaixa.tsx` define `getStatusLabel` inline (linhas 164-182) com mapeamento manual de status para labels em português. Essa mesma lógica já existe em `src/lib/statusUtils.ts`. São duas fontes de verdade para o mesmo dado — se um status for renomeado, um dos dois ficará desatualizado.

## Como resolver

Remover a função inline e importar de `statusUtils`:

```tsx
import { getStatusLabel } from '@/lib/statusUtils'
```

Verificar se a assinatura é compatível. Se `statusUtils` não exportar `getStatusLabel` com o mesmo formato, adicionar lá e remover a cópia local.
