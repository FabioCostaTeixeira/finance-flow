---
titulo: Race condition na inicialização dupla de sessão em AuthContext
tipo: correcao
prioridade: alta
esforco: rapido
arquivo: src/contexts/AuthContext.tsx:88-99
origem: auditoria
data: 2026-05-05
---

## Descrição

`AuthContext.tsx` registra `onAuthStateChange` e em seguida chama `getSession` manualmente. Quando o usuário já possui sessão ativa ao carregar a página, `fetchUserRole` e `fetchUserProfile` são disparados **duas vezes em paralelo** — uma pelo listener (linha 75-78) e outra pelo bloco `getSession` (linhas 93-96). Isso gera:

- Duas requisições simultâneas à tabela `user_roles` e `profiles`
- Corrida entre as duas escritas de `setRole` / `setUserName`; a que chegar por último "ganha"
- `setLoading(false)` chamado duas vezes, mas isso é benigno

O padrão correto documentado pelo Supabase é registrar apenas `onAuthStateChange`, que já emite o evento `INITIAL_SESSION` com a sessão existente na inicialização.

## Como resolver

Remover o bloco `getSession` inteiro (linhas 89-99 de `AuthContext.tsx`):

```ts
// REMOVER estas linhas:
supabase.auth.getSession().then(({ data: { session } }) => {
  setSession(session);
  setUser(session?.user ?? null);
  
  if (session?.user) {
    fetchUserRole(session.user.id);
    fetchUserProfile(session.user.id);
  }
  
  setLoading(false);
});
```

O `onAuthStateChange` já cobre este caso — ao se registrar, ele dispara imediatamente com o estado atual da sessão (evento `INITIAL_SESSION`). O `setLoading(false)` na linha 84 dentro do listener já resolve o estado de loading corretamente.
