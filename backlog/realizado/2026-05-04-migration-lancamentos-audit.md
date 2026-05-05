---
titulo: Criar tabela lancamentos_audit e trigger no Supabase
tipo: correcao
prioridade: alta
esforco: medio
arquivo: finance-flow/mcp/src/index.ts
origem: auditoria
data: 2026-05-04
---

## Descrição

A tool `listar_auditoria` usa `api_access_logs` (log de acesso à API), mas não rastreia alterações nos dados financeiros (quem editou qual lançamento, valor anterior vs novo). O critério de aceite do card exige trace por transação de estado.

## Como resolver

Executar no Supabase:

```sql
CREATE TABLE IF NOT EXISTS lancamentos_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lancamento_id   UUID REFERENCES lancamentos(id) ON DELETE SET NULL,
  operacao        TEXT NOT NULL CHECK (operacao IN ('INSERT', 'UPDATE', 'DELETE')),
  valor_anterior  JSONB,
  valor_novo      JSONB,
  usuario_id      UUID REFERENCES auth.users(id),
  realizado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE lancamentos_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full" ON lancamentos_audit
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "authenticated_read" ON lancamentos_audit
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION audit_lancamentos()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO lancamentos_audit (lancamento_id, operacao, valor_novo, usuario_id)
    VALUES (NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO lancamentos_audit (lancamento_id, operacao, valor_anterior, valor_novo, usuario_id)
    VALUES (NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO lancamentos_audit (lancamento_id, operacao, valor_anterior, usuario_id)
    VALUES (OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER lancamentos_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON lancamentos
  FOR EACH ROW EXECUTE FUNCTION audit_lancamentos();
```

## Após a migration

Atualizar `listar_auditoria` no MCP para consultar `lancamentos_audit` em vez de `api_access_logs`.
