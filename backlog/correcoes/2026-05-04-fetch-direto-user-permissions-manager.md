---
titulo: useQuery chamado diretamente em UserPermissionsManager.tsx
tipo: correcao
prioridade: alta
esforco: rapido
arquivo: src/components/UserPermissionsManager.tsx:28
origem: auditoria
data: 2026-05-04
---

## Descrição

`UserPermissionsManager.tsx` chama `useQuery` diretamente nas linhas 28 e 37 para buscar `profiles` e `user_roles`. Componentes de negócio não devem conter lógica de fetch — essa lógica deve viver em hooks em `src/hooks/`.

## Como resolver

Após criar `src/hooks/useUsuarios.ts` (ver item correlato em correcoes/), refatorar `UserPermissionsManager.tsx` para consumir esse hook:

```tsx
const { data: profiles } = useUsuarios()
```

Se o componente precisar de dados diferentes dos que a página `Usuarios.tsx` usa, criar uma query separada dentro do mesmo hook com um nome descritivo.
