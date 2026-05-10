---
titulo: AVISO — qualquer alteração em roles/permissões/RLS requer validação dupla
tipo: correcao
prioridade: alta
esforco: rapido
arquivo: src/hooks/usePermissoes.ts
origem: auditoria
data: 2026-05-09
---

## Descrição

Conforme CLAUDE.md: **nunca alterar lógica de roles, permissões ou RLS sem validação explícita com o usuário**.

Durante a auditoria, nenhuma violação ativa foi encontrada nos hooks de permissão (`useAllPermissions`, `useMyPermissions`). Porém, qualquer refatoração futura nessa área (ex: adicionar staleTime, mudar queryKey, alterar lógica de fetch) deve ser tratada com cautela extra, pois um cache stale de permissões pode conceder acesso indevido a dados de outros usuários.

## Como resolver

Antes de qualquer alteração em:
- `src/hooks/usePermissoes.ts`
- `src/contexts/AuthContext.tsx` (roles/session)
- Qualquer política RLS no Supabase

1. Descrever exatamente o que será modificado
2. Obter confirmação explícita do usuário
3. Testar com role `user` (mais restrito) antes de commitar
