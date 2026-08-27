-- Optimistic versioning & Actor audit enrichment

ALTER TABLE public.lancamentos ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.bancos ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.categorias ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS actor_type text DEFAULT 'user';
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS api_key_id uuid;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS tool_name text;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS request_id text;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS version integer;

CREATE OR REPLACE FUNCTION public.audit_lancamentos() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
  v_registro_id uuid;
  v_antes jsonb;
  v_depois jsonb;
  v_version integer;
  v_api_key_id uuid;
  v_tool_name text;
  v_request_id text;
  v_actor_type text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_tenant_id := OLD.tenant_id;
    v_registro_id := OLD.id;
    v_antes := to_jsonb(OLD);
    v_depois := NULL;
    v_version := OLD.version;
  ELSIF TG_OP = 'UPDATE' THEN
    v_tenant_id := NEW.tenant_id;
    v_registro_id := NEW.id;
    v_antes := to_jsonb(OLD);
    v_depois := to_jsonb(NEW);
    v_version := NEW.version;
  ELSE
    v_tenant_id := NEW.tenant_id;
    v_registro_id := NEW.id;
    v_antes := NULL;
    v_depois := to_jsonb(NEW);
    v_version := NEW.version;
  END IF;

  v_user_id := auth.uid();
  v_api_key_id := NULLIF(current_setting('mcp.api_key_id', true), '')::uuid;
  v_tool_name := NULLIF(current_setting('mcp.tool_name', true), '');
  v_request_id := NULLIF(current_setting('mcp.request_id', true), '');

  IF v_api_key_id IS NOT NULL THEN
    v_actor_type := 'mcp_agent';
  ELSE
    v_actor_type := 'user';
  END IF;

  INSERT INTO public.audit_log(
    tenant_id, user_id, tabela, operacao, registro_id, antes, depois,
    actor_type, api_key_id, tool_name, request_id, version
  )
  VALUES (
    v_tenant_id, v_user_id, TG_TABLE_NAME, TG_OP, v_registro_id, v_antes, v_depois,
    v_actor_type, v_api_key_id, v_tool_name, v_request_id, v_version
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END $$;
