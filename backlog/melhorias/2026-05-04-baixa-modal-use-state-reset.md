---
titulo: BaixaModal usa useState initializer para reset — bug ao reabrir com outro lançamento
tipo: melhoria
prioridade: media
esforco: rapido
arquivo: src/components/BaixaModal.tsx:62
origem: auditoria
data: 2026-05-04
---

## Descrição

`BaixaModal.tsx` usa `useState(() => ({ ... lancamento.valor ... }))` para inicializar o estado do formulário com os dados do lançamento. O problema: o initializer do `useState` roda **apenas uma vez** na montagem do componente. Se o modal for reutilizado (aberto, fechado, e reaberto com um lançamento diferente), o formulário continuará exibindo os dados do primeiro lançamento.

## Como resolver

Substituir o padrão por `useEffect` com dependência no `lancamento.id`:

```tsx
const [form, setForm] = useState(getInitialValues(lancamento))

useEffect(() => {
  setForm(getInitialValues(lancamento))
}, [lancamento.id])

function getInitialValues(l: Lancamento) {
  return {
    valor: l.valor,
    data_pagamento: new Date().toISOString().split('T')[0],
    // ...
  }
}
```

Ou, se o modal for sempre desmontado ao fechar (controlled via `open` prop com `{open && <BaixaModal />}`), o problema não ocorre — verificar o comportamento do componente pai antes de corrigir.
