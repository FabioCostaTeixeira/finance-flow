---
titulo: Sem staleTime em useMyPermissions e useAllPermissions
tipo: melhoria
prioridade: media
esforco: rapido
arquivo: src/hooks/useUserPermissions.ts:44,57
origem: auditoria
data: 2026-05-05
---

## Descrição

`useMyPermissions` e `useAllPermissions` não definem `staleTime`. Como resultado, o React Query considera os dados "stale" imediatamente e refetch é disparado a cada foco de janela.

Essas queries são chamadas em:
- **Todo `PermissionRoute`** (que envolve todas as rotas protegidas, ou seja, toda navegação do app)
- **`AppSidebar`** via `DesktopNav` e `SidebarContent`

Permissões de usuário mudam raramente (apenas quando um admin edita via página de Usuários) — não há necessidade de refetch frequente.

Na sessão anterior, `staleTime` já foi adicionado a `useBancos`, `useCategorias`, `useApiKeys` e `useAISettings` pelo mesmo motivo. As queries de permissão ficaram de fora.

## Como resolver

Adicionar `staleTime: 1000 * 60 * 5` (5 minutos) em ambas as queries:

```ts
export function useAllPermissions() {
  return useQuery({
    queryKey: ['user_permissions_all'],
    queryFn: async () => { ... },
    staleTime: 1000 * 60 * 5,
  });
}

export function useMyPermissions() {
  return useQuery({
    queryKey: ['user_permissions_mine'],
    queryFn: async () => { ... },
    staleTime: 1000 * 60 * 5,
  });
}
```

A invalidação em `useTogglePermission.onSuccess` já garante atualização imediata quando uma permissão é alterada.
