---
titulo: useGetTransferenciaPar retorna função async em vez de usar useQuery
tipo: melhoria
prioridade: media
esforco: rapido
arquivo: src/hooks/useTransferencia.ts:178
origem: auditoria
data: 2026-05-09
---

## Descrição

`useGetTransferenciaPar` viola o padrão do projeto (lógica de fetch em hooks com React Query):

```ts
export function useGetTransferenciaPar() {
  return async (vinculoId: string) => {
    const { data, error } = await supabase
      .from('lancamentos')
      .select('*, bancos(*)')
      .eq('transferencia_vinculo_id', vinculoId);
    if (error) throw error;
    return data;
  };
}
```

Isso é um hook que retorna uma função async — nem `useQuery`, nem `useMutation`. Não tem cache, não tem loading state gerenciado, não tem retry automático, e o erro é lançado sem tratamento no call site.

## Como resolver

Se o fetch é disparado por evento (ex: usuário abre um modal de transferência), usar `useMutation` ou `useCallback` + estado local.

Se é um fetch de dados de exibição, converter para `useQuery` com `queryKey: ['transferenciaPar', vinculoId]` e `enabled: !!vinculoId`.
