---
titulo: GerenciarBancosDialog definido dentro de Bancos.tsx em vez de componente separado
tipo: melhoria
prioridade: baixa
esforco: rapido
arquivo: src/pages/Bancos.tsx:46
origem: auditoria
data: 2026-05-04
---

## Descrição

`Bancos.tsx` contém `GerenciarBancosDialog` (~85 linhas, linhas 46-131) definido no mesmo arquivo que a página. Além de aumentar o tamanho do arquivo e dificultar a leitura, impede reutilização do diálogo em outros contextos.

## Como resolver

Mover `GerenciarBancosDialog` para `src/components/GerenciarBancosDialog.tsx` e importar em `Bancos.tsx`:

```tsx
import { GerenciarBancosDialog } from '@/components/GerenciarBancosDialog'
```

Nenhuma alteração de lógica necessária — apenas extração de arquivo.
