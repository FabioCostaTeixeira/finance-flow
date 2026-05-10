---
titulo: Substituir parser markdown rudimentar em Insights.tsx por biblioteca adequada
tipo: ideia
prioridade: baixa
esforco: rapido
arquivo: src/pages/Insights.tsx:69
origem: auditoria
data: 2026-05-09
---

## Descrição

A função `renderContent` em `Insights.tsx` (linha ~69) implementa um parser markdown próprio usando apenas `split('**')` para tratar negrito. Isso falha silenciosamente com número ímpar de asteriscos e não suporta nenhuma outra marcação (listas, itálico, código inline, quebras de linha).

Como a página exibe respostas de IA (que frequentemente usam markdown), a ausência de um parser completo degrada a legibilidade das respostas.

## Como resolver

Instalar `react-markdown` (leve, zero configuração extra):

```bash
npm install react-markdown
```

Substituir `renderContent` por:

```tsx
import ReactMarkdown from 'react-markdown';

// na renderização:
<ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">
  {content}
</ReactMarkdown>
```

Adicionar plugin `remark-gfm` se precisar de tabelas ou tasklists no futuro.
