-- Migration: 20260827000100_mcp_agent_context.sql
-- Description: Session settings and RPC helper for authenticated agent execution context

-- Helper RPC to set agent context variables safely in session
CREATE OR REPLACE FUNCTION public.set_mcp_agent_context(
  _tenant_id uuid,
  _actor_id text DEFAULT NULL,
  _api_key_id uuid DEFAULT NULL,
  _request_id text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id_required';
  END IF;

  PERFORM set_config('app.mcp_tenant_id', _tenant_id::text, true);
  PERFORM set_config('app.mcp_actor_id', COALESCE(_actor_id, 'mcp_agent'), true);
  
  IF _api_key_id IS NOT NULL THEN
    PERFORM set_config('app.mcp_api_key_id', _api_key_id::text, true);
  END IF;
  
  IF _request_id IS NOT NULL THEN
    PERFORM set_config('app.mcp_request_id', _request_id, true);
  END IF;
END;
$$;

-- Helper RPC to get current session tenant_id (from JWT or MCP session context)
CREATE OR REPLACE FUNCTION public.get_current_tenant_id() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  _mcp_tenant text;
  _user_tenant uuid;
BEGIN
  _mcp_tenant := current_setting('app.mcp_tenant_id', true);
  IF _mcp_tenant IS NOT NULL AND _mcp_tenant <> '' THEN
    RETURN _mcp_tenant::uuid;
  END IF;

  SELECT tenant_id INTO _user_tenant
  FROM public.tenant_members
  WHERE user_id = auth.uid()
  LIMIT 1;

  RETURN _user_tenant;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_mcp_agent_context FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_mcp_agent_context TO service_role;
GRANT EXECUTE ON FUNCTION public.get_current_tenant_id TO authenticated, service_role;
