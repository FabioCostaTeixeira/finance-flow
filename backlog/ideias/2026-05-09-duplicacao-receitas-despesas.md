---
titulo: Extrair componente compartilhado entre Receitas.tsx e Despesas.tsx
tipo: ideia
prioridade: baixa
esforco: medio
arquivo: src/pages/Receitas.tsx
origem: auditoria
data: 2026-05-09
---

## Descrição

`Receitas.tsx` e `Despesas.tsx` são praticamente idênticos — mesma estrutura de KPIs, mesma tabela, mesmos filtros, mesma lógica de modal. A única diferença é o `tipo` passado para `useLancamentos`. Manter dois arquivos quase iguais significa que qualquer bugfix ou feature nova precisa ser aplicada duas vezes.

## Como resolver

Criar um componente `LancamentosPage` que recebe `tipo: 'receita' | 'despesa'` como prop, e simplificar as páginas:

```ts
// Receitas.tsx
export default function Receitas() {
  return <LancamentosPage tipo="receita" />;
}

// Despesas.tsx
export default function Despesas() {
  return <LancamentosPage tipo="despesa" />;
}
```

Isso elimina ~300 linhas duplicadas e centraliza manutenção futura.
