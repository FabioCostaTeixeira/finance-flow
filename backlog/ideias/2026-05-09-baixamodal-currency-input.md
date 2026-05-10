---
titulo: Usar CurrencyInput em BaixaModal para consistência com LancamentoForm
tipo: ideia
prioridade: baixa
esforco: rapido
arquivo: src/components/BaixaModal.tsx
origem: auditoria
data: 2026-05-09
---

## Descrição

O campo `valorPago` em `BaixaModal.tsx` usa `<Input type="number">` nativo, enquanto `LancamentoForm.tsx` usa o componente `CurrencyInput` com formatação BR (R$ 1.234,56). Isso cria inconsistência de UX: o usuário vê formatos de entrada diferentes para o mesmo tipo de dado.

## Como resolver

Substituir o `<Input type="number">` no campo `valorPago` do `BaixaModal` pelo mesmo `CurrencyInput` já usado em `LancamentoForm`. Verificar se o schema Zod do modal aceita o valor numérico retornado pelo `CurrencyInput` (que retorna `number`, não string).
