
---
titulo: Cast as any para status transferencia em useTransferencia
tipo: melhoria
prioridade: media
esforco: medio
arquivo: src/hooks/useTransferencia.ts:53
origem: auditoria
data: 2026-05-04
---

## Descrição

`useTransferencia.ts` usa `'transferencia' as any` nas linhas 53 e 72 para atribuir o status `transferencia` a um lançamento. O valor `transferencia` não está declarado no enum `status_lancamento` nos tipos gerados pelo Supabase, embora exista como status válido no sistema (listado no CLAUDE.md).

## Como resolver

1. Verificar se o enum `status_lancamento` no banco realmente inclui `transferencia`. Se não incluir, adicionar via migration no painel do Supabase.
2. Regenerar `src/integrations/supabase/types.ts` após a migration.
3. Remover os dois `as any`.

Se o enum já existe no banco mas faltou na geração de tipos, forçar a regeneração via CLI:
```bash
npx supabase gen types typescript --project-id <id> > src/integrations/supabase/types.ts
```
