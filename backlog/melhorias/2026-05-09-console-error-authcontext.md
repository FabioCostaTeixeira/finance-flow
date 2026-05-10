---
titulo: console.error de produção em AuthContext
tipo: melhoria
prioridade: baixa
esforco: rapido
arquivo: src/contexts/AuthContext.tsx:43
origem: auditoria
data: 2026-05-09
---

## Descrição

`AuthContext.tsx` ainda tem dois `console.error` em linhas ~43 e ~57 que logam erros de autenticação no console do browser em produção:

```ts
console.error('Error fetching user role:', error);
console.error('Error in auth state change:', error);
```

Esses erros expõem detalhes internos do sistema (nomes de tabelas, mensagens do Supabase) para qualquer pessoa com o DevTools aberto.

## Como resolver

Substituir por um sistema de logging que só ativa em `development`:

```ts
if (import.meta.env.DEV) {
  console.error('Error fetching user role:', error);
}
```

Ou centralizar em um utilitário `logger.ts`:

```ts
export const logger = {
  error: (...args: unknown[]) => import.meta.env.DEV && console.error(...args),
};
```
