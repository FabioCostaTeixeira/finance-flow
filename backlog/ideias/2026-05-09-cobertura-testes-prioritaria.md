---
titulo: Cobertura de testes — prioridade para hooks críticos e componentes de negócio
tipo: ideia
prioridade: media
esforco: grande
arquivo: src/hooks/useLancamentos.ts
origem: auditoria
data: 2026-05-09
---

## Descrição

A auditoria identificou os seguintes arquivos sem nenhum teste, ordenados por prioridade:

### Alta prioridade
- `src/hooks/useLancamentos.ts` — lógica de fetch/mutação central do app
- `src/hooks/useUpdateLancamento.ts` — lógica de recorrência e parcelamento
- `src/lib/statusUtils.ts` — **já tem testes** (17 testes criados na última sprint ✅)
- `src/lib/recurrence.ts` — **já tem testes** (11 testes criados na última sprint ✅)

### Média prioridade
- `src/components/AlertasNotificacao.tsx` — lógica de alertas com bugs encontrados
- `src/components/LancamentosTable.tsx` — lógica de seleção/delete com bugs encontrados
- `src/hooks/useTransferencia.ts` — operação sensível (modifica dois registros)

### Baixa prioridade
- `src/pages/Receitas.tsx` / `Despesas.tsx` — testes de integração de página
- `src/hooks/useChatMessages.ts`
- `src/hooks/useBancos.ts`

## Como resolver

Para hooks com Supabase, usar `vi.mock('@/integrations/supabase/client')` para mockar o cliente. Para componentes, usar `@testing-library/react` com `renderWithProviders` (wrapper com QueryClient + Router).

Criar `src/test/utils.tsx` com o helper `renderWithProviders` para reutilização nos testes de componente.
