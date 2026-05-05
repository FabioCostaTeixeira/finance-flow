---
titulo: AlertasNotificacao usa window.location.href causando reload completo
tipo: melhoria
prioridade: media
esforco: rapido
arquivo: src/components/AlertasNotificacao.tsx:137
origem: auditoria
data: 2026-05-05
---

## Descrição

A função `handleNavigate` usa `window.location.href` para navegar ao clicar em uma notificação:

```ts
window.location.href = `${rota}?highlight=${alerta.lancamento.id}`;
```

Isso força um reload completo da página, descartando todo o cache do React Query e a árvore de componentes. O usuário experimenta um carregamento desnecessariamente lento ao clicar em qualquer alerta.

O projeto já usa React Router DOM v6 — o padrão correto é `useNavigate`.

## Como resolver

1. Importar `useNavigate` de `react-router-dom`
2. Instanciar o hook dentro de `AlertasNotificacao`
3. Substituir `window.location.href = ...` por `navigate(...)`

```tsx
// Adicionar ao import existente de react-router-dom (ou criar novo):
import { useNavigate } from 'react-router-dom';

// Dentro do componente:
const navigate = useNavigate();

const handleNavigate = useCallback((alerta: Alerta) => {
  dismissAlerta(alerta.id);
  const rota = alerta.lancamento.tipo === 'receita' ? '/receitas' : '/despesas';
  navigate(`${rota}?highlight=${alerta.lancamento.id}`);
  setOpen(false);
}, [dismissAlerta, navigate]);
```
