---
titulo: Adicionar staleTime em useLancamentos (query mais crítica do app)
tipo: melhoria
prioridade: alta
esforco: rapido
arquivo: src/hooks/useLancamentos.ts
origem: auditoria
data: 2026-05-09
---

## Descrição

`useLancamentos` é o hook de fetch mais utilizado no app — chamado em Receitas, Despesas, FluxoCaixa e outros. Não tem `staleTime` configurado, o que faz o React Query refetcheá-lo a cada foco de janela e re-mount de componente, gerando requisições desnecessárias ao Supabase.

## Como resolver

```ts
useQuery({
  queryKey: ['lancamentos', filters],
  queryFn: ...,
  staleTime: 1000 * 60 * 2, // 2 min — dados mudam com frequência
})
```

Usar 2 minutos em vez de 5 (padrão dos hooks estáticos) por ser dado operacional que muda com frequência. Após qualquer mutação (criar/editar/deletar/baixar), `invalidateQueries(['lancamentos'])` já garante atualização imediata.
