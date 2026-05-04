---
titulo: import supabase direto e useQueryClient inline em Insights.tsx
tipo: correcao
prioridade: alta
esforco: medio
arquivo: src/pages/Insights.tsx:11
origem: auditoria
data: 2026-05-04
---

## Descrição

`Insights.tsx` importa `supabase` diretamente (linha 11) para a função `streamChat` e usa `useQueryClient` inline para invalidar cache — tudo lógica de dados dentro da página. Viola o padrão do projeto que reserva essas operações para hooks em `src/hooks/`.

## Como resolver

1. Mover a função `streamChat` e o `useQueryClient` para `src/hooks/useChatMessages.ts` (já existe) ou criar `src/hooks/useInsights.ts`
2. Expor via hook:
   ```ts
   export function useStreamChat() {
     const queryClient = useQueryClient()
     const streamChat = async (message: string) => { ... }
     return { streamChat }
   }
   ```
3. Em `Insights.tsx`, remover o import de `supabase` e usar o hook:
   ```tsx
   const { streamChat } = useStreamChat()
   ```
