---
titulo: .gitignore não bloqueia .env explicitamente
tipo: correcao
prioridade: alta
esforco: rapido
arquivo: .gitignore
origem: auditoria
data: 2026-05-04
---

## Descrição

O `.gitignore` atual bloqueia apenas `*.local`, não o arquivo `.env` explicitamente. Um `git add .` acidental exporia `VITE_SUPABASE_PUBLISHABLE_KEY` e qualquer outra credencial presente no `.env`. O próprio CLAUDE.md já documenta esse risco ("O .gitignore atual não bloqueia .env explicitamente, apenas *.local").

## Como resolver

Adicionar ao `.gitignore`:

```
.env
.env.*
!.env.example
```

A linha `!.env.example` garante que um arquivo de exemplo (sem credenciais reais) possa ser commitado para documentar as variáveis necessárias.
