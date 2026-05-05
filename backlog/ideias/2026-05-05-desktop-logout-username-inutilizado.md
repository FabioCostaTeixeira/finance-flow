---
titulo: userName desestruturado mas não usado em DesktopLogout
tipo: ideia
prioridade: baixa
esforco: rapido
arquivo: src/components/AppSidebar.tsx:243
origem: auditoria
data: 2026-05-05
---

## Descrição

No componente `DesktopLogout`:

```ts
const { signOut, userName } = useAuth();
```

`userName` nunca é referenciado no corpo do componente. É código morto que causa uma leitura de contexto desnecessária (embora o impacto seja mínimo).

## Como resolver

Remover `userName` da desestruturação:

```ts
const { signOut } = useAuth();
```
