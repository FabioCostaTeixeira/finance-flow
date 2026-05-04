---
titulo: Projeto sem nenhum arquivo de teste — setup inicial e prioridades
tipo: ideia
prioridade: baixa
esforco: grande
arquivo: src/
origem: auditoria
data: 2026-05-04
---

## Descrição

Zero arquivos de teste encontrados em todo o projeto (nenhum `.test.ts`, `.spec.ts`, `.test.tsx`). O CLAUDE.md exige testes ao finalizar features, mas o framework ainda não está definido. Sem testes, bugs em lógica de negócio (recorrência, status, parcelas) são encontrados apenas em produção.

## Como resolver

### Setup (uma vez)

```bash
bun add -D vitest @testing-library/react @testing-library/user-event @vitejs/plugin-react jsdom msw
```

Adicionar ao `vite.config.ts`:
```ts
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: './src/test/setup.ts',
}
```

### Prioridade de testes (ordem recomendada)

1. **`src/lib/statusUtils.ts`** — funções puras, sem dependências externas, cobertura trivial
2. **`src/lib/recorrencia.ts`** — lógica de recorrência e cálculo de parcelas é complexa e propensa a edge cases (datas, meses com 28/30/31 dias, frequências diferentes)
3. **`src/hooks/useLancamentos.ts`** — hook principal; testar com MSW para mock do Supabase
4. **`src/hooks/useTransferencia.ts`** — múltiplas mutações encadeadas com lógica de negócio
5. **`src/components/BaixaModal.tsx`** — bug de reset detectado na auditoria; um teste teria capturado
