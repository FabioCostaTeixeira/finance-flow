---
titulo: Casts as any para campo frequencia em useLancamentos e useUpdateLancamento
tipo: melhoria
prioridade: media
esforco: medio
arquivo: src/hooks/useLancamentos.ts:148
origem: auditoria
data: 2026-05-04
---

## Descrição

O campo `frequencia` não está nos tipos gerados automaticamente pelo Supabase (`src/integrations/supabase/types.ts`). Para contornar, três pontos do código usam `as any`:
- `useLancamentos.ts:148` — ao passar `frequencia` no insert
- `useLancamentos.ts:236` e `:253` — ao ler `frequencia` do retorno
- `useUpdateLancamento.ts:87` — `(openLancamentos[0] as any).frequencia`

Isso suprime erros de tipo em operações de escrita no banco — um campo errado poderia ser passado silenciosamente.

## Como resolver

**Opção A (definitiva):** Adicionar `frequencia` à coluna `lancamentos` no Supabase e regenerar `types.ts` via CLI ou painel. O tipo provavelmente deve ser `frequencia_lancamento` (enum) ou `text | null`.

**Opção B (provisória):** Criar um tipo local enquanto os tipos não são atualizados:
```ts
// src/integrations/supabase/types-extended.ts
import type { Database } from './types'

type LancamentoRow = Database['public']['Tables']['lancamentos']['Row']
export type LancamentoWithFrequencia = LancamentoRow & {
  frequencia: string | null
}
```

Substituir os `as any` pelo cast para `LancamentoWithFrequencia`. Ao menos o erro fica contido e documentado.
