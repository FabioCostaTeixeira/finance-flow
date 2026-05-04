---
titulo: Componente Alert definido inline ao final de TelegramBot.tsx
tipo: melhoria
prioridade: baixa
esforco: rapido
arquivo: src/pages/TelegramBot.tsx:173
origem: auditoria
data: 2026-05-04
---

## Descrição

`TelegramBot.tsx` define um componente `Alert` (ou variante dele) inline no final do arquivo da página (linhas 173-187). Componentes de negócio devem ficar em `src/components/`, não misturados com a lógica da página.

## Como resolver

**Opção A:** Usar o componente `Alert` do shadcn/ui já disponível em `src/components/ui/alert.tsx` — provavelmente já faz o que o inline faz.

**Opção B (se customizado):** Extrair para `src/components/TelegramAlert.tsx` ou um nome mais genérico se reutilizável.
