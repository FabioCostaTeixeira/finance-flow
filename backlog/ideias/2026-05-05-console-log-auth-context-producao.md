---
titulo: console.log exposto em produção em AuthContext
tipo: ideia
prioridade: baixa
esforco: rapido
arquivo: src/contexts/AuthContext.tsx:35,56
origem: auditoria
data: 2026-05-05
---

## Descrição

Dois `console.log` ficam ativos em produção:

```ts
// linha 35
console.log('No role found for user:', error.message);

// linha 56
console.log('No profile found:', error.message);
```

Embora não exponham dados sensíveis do usuário, revelam detalhes internos de implementação (nomes de tabelas, mensagens de erro do Supabase) para qualquer pessoa com DevTools aberto.

## Como resolver

Remover os dois `console.log` (os erros já são capturados no bloco `catch` e o fluxo continua normalmente com `setRole(null)` ou sem ação). Os `console.error` nos blocos `catch` podem ser mantidos pois indicam erros inesperados.

```ts
// Remover:
console.log('No role found for user:', error.message);

// Remover:
console.log('No profile found:', error.message);
```
