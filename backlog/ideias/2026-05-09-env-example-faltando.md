---
titulo: Criar .env.example para documentar variáveis de ambiente necessárias
tipo: ideia
prioridade: baixa
esforco: rapido
arquivo: finance-flow/.env.example
origem: auditoria
data: 2026-05-09
---

## Descrição

O `.gitignore` já tem `!.env.example` (rastreia o exemplo), mas o arquivo não existe. Novos devs não têm como saber quais variáveis configurar sem ler o CLAUDE.md ou perguntar.

## Como resolver

Criar `finance-flow/.env.example` com:

```
# Frontend — Supabase (valores públicos, sem segredos)
VITE_SUPABASE_URL=https://SEU-PROJECT-ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=seu-anon-key-aqui

# MCP Server (mcp/.env — nunca no frontend)
# SUPABASE_URL=https://SEU-PROJECT-ID.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=seu-service-role-key-aqui
```

Commitar junto com o `.gitignore`.
