---
titulo: Criar tabela agent_memory no Supabase
tipo: correcao
prioridade: alta
esforco: rapido
arquivo: finance-flow/mcp/src/agents/memory.ts
origem: auditoria
data: 2026-05-04
---

## Descrição

A feature de memória persistida por agente (`memory.ts`) foi implementada no MCP, mas a tabela `agent_memory` não existe no Supabase. Qualquer chamada a `saveMemory` ou `getMemory` vai falhar com erro de relação inexistente.

## Como resolver

Executar no Supabase:

```sql
CREATE TABLE IF NOT EXISTS agent_memory (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent       TEXT NOT NULL,
  key         TEXT NOT NULL,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent, key)
);

ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON agent_memory
  FOR ALL USING (auth.role() = 'service_role');
```
