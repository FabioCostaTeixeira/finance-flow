-- Idempotency table & reservation function
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  operation text NOT NULL,
  key text NOT NULL,
  payload_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed')),
  resource_id uuid,
  response jsonb,
  http_status integer,
  request_id text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, operation, key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_tenant_lookup
  ON public.idempotency_keys(tenant_id, operation, key);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS idempotency_keys_tenant_isolation ON public.idempotency_keys;
CREATE POLICY idempotency_keys_tenant_isolation ON public.idempotency_keys
  FOR ALL TO authenticated
  USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE OR REPLACE FUNCTION public.reserve_idempotency_key(
  p_operation text,
  p_key text,
  p_payload_hash text,
  p_request_id text DEFAULT NULL,
  p_ttl_seconds integer DEFAULT 86400
)
RETURNS TABLE (
  action text,
  status text,
  response jsonb,
  http_status integer,
  resource_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
  v_existing record;
BEGIN
  v_tenant_id := public.get_current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'TENANT_NOT_SET: context tenant_id mandatory for idempotency reservation';
  END IF;

  SELECT * INTO v_existing
  FROM public.idempotency_keys
  WHERE tenant_id = v_tenant_id AND operation = p_operation AND key = p_key
  FOR UPDATE;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.payload_hash <> p_payload_hash THEN
      RETURN QUERY SELECT 'conflict'::text, v_existing.status, NULL::jsonb, 409, v_existing.resource_id;
      RETURN;
    END IF;

    IF v_existing.status = 'in_progress' THEN
      RETURN QUERY SELECT 'in_progress'::text, v_existing.status, NULL::jsonb, 409, v_existing.resource_id;
      RETURN;
    END IF;

    RETURN QUERY SELECT 'replay'::text, v_existing.status, v_existing.response, v_existing.http_status, v_existing.resource_id;
    RETURN;
  END IF;

  INSERT INTO public.idempotency_keys (
    tenant_id, operation, key, payload_hash, status, request_id, expires_at
  ) VALUES (
    v_tenant_id, p_operation, p_key, p_payload_hash, 'in_progress', p_request_id, now() + (p_ttl_seconds || ' seconds')::interval
  );

  RETURN QUERY SELECT 'created'::text, 'in_progress'::text, NULL::jsonb, 200, NULL::uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_idempotency_key(
  p_operation text,
  p_key text,
  p_response jsonb,
  p_http_status integer DEFAULT 200,
  p_resource_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := public.get_current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'TENANT_NOT_SET: context tenant_id mandatory for idempotency completion';
  END IF;

  UPDATE public.idempotency_keys
  SET status = 'completed',
      response = p_response,
      http_status = p_http_status,
      resource_id = p_resource_id,
      updated_at = now()
  WHERE tenant_id = v_tenant_id AND operation = p_operation AND key = p_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_idempotency_key(
  p_operation text,
  p_key text,
  p_response jsonb,
  p_http_status integer DEFAULT 400
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := public.get_current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'TENANT_NOT_SET: context tenant_id mandatory for idempotency failure';
  END IF;

  UPDATE public.idempotency_keys
  SET status = 'failed',
      response = p_response,
      http_status = p_http_status,
      updated_at = now()
  WHERE tenant_id = v_tenant_id AND operation = p_operation AND key = p_key;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reserve_idempotency_key(text, text, text, text, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.complete_idempotency_key(text, text, jsonb, integer, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fail_idempotency_key(text, text, jsonb, integer) FROM anon, public;
