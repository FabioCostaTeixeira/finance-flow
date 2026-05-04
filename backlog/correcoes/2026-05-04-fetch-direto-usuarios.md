---
titulo: useQuery e useMutation chamados diretamente em Usuarios.tsx
tipo: correcao
prioridade: alta
esforco: medio
arquivo: src/pages/Usuarios.tsx:61
origem: auditoria
data: 2026-05-04
---

## Descrição

`Usuarios.tsx` usa `useQuery` (linha 61) e `useMutation` (linhas 75, 93, 131) diretamente na página para buscar e atualizar `profiles` e `user_roles`. Isso viola o padrão central do projeto definido no CLAUDE.md: "lógica de fetch/mutação fica nos hooks — nunca direto nas páginas".

O padrão errado fica como referência para novos código, e qualquer reutilização da lógica em outros componentes levaria à duplicação.

## Como resolver

1. Criar `src/hooks/useUsuarios.ts` com:
   - `useUsuarios()` → `useQuery` para `profiles` com join em `user_roles`
   - `useAtualizarRole()` → `useMutation` para update em `user_roles`
   - `useAtualizarPermissoes()` → `useMutation` para update de permissões

2. Em `Usuarios.tsx`, substituir os `useQuery`/`useMutation` inline pelos hooks:
   ```tsx
   const { data: usuarios, isLoading } = useUsuarios()
   const { mutate: atualizarRole } = useAtualizarRole()
   ```

3. `UserPermissionsManager.tsx` também pode usar o mesmo hook (ver item relacionado no backlog).
