---
titulo: Adicionar staleTime nos hooks restantes sem cache configurado
tipo: melhoria
prioridade: media
esforco: rapido
arquivo: src/hooks/useUsuarios.ts
origem: auditoria
data: 2026-05-09
---

## Descrição

Os seguintes hooks estão sem `staleTime`, gerando refetches desnecessários:

| Hook | Arquivo | staleTime sugerido |
|------|---------|-------------------|
| `useProfiles` | useUsuarios.ts | 5 min |
| `useUserRoles` | useUsuarios.ts | 5 min |
| `useChatMessages` | useChatMessages.ts | 1 min (chat muda com frequência) |
| `useMyChannels` | useChatMessages.ts | 5 min |

Esses dados mudam raramente (perfis, roles) ou com cadência controlada (chat), então o custo de cache é muito menor que o custo de refetch.

## Como resolver

Adicionar `staleTime` em cada `useQuery` listado acima seguindo o mesmo padrão já usado em `useCategorias`, `useBancos` e `useApiKeys`:

```ts
staleTime: 1000 * 60 * 5,
```
