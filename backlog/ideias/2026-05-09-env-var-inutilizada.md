---
titulo: VITE_SUPABASE_PROJECT_ID no .env nunca é referenciado no código
tipo: ideia
prioridade: baixa
esforco: rapido
arquivo: finance-flow/.env
origem: auditoria
data: 2026-05-09
---

## Descrição

O arquivo `.env` contém:

```
VITE_SUPABASE_PROJECT_ID="ngjoyxtmrfmnepwwontd"
```

Nenhum arquivo em `src/` usa `import.meta.env.VITE_SUPABASE_PROJECT_ID`. A variável foi provavelmente adicionada como referência, mas nunca consumida.

## Como resolver

Remover a variável do `.env` (e do `.env.example` quando criado) para evitar confusão. Se for necessária no futuro para construir URLs de storage ou funções edge, reintroduzir com documentação.

**Nota:** O valor exposto (project ID) não é segredo — é parte da URL pública do Supabase. Mas manter variáveis não utilizadas polui o ambiente.
