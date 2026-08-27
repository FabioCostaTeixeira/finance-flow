-- Confirmations and batch execution state table
CREATE TABLE IF NOT EXISTS public.confirmation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  operation text NOT NULL,
  payload_hash text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'consumed', 'expired')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_confirmation_tokens_tenant ON public.confirmation_tokens(tenant_id, token_hash);

ALTER TABLE public.confirmation_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS confirmation_tokens_tenant_isolation ON public.confirmation_tokens;
CREATE POLICY confirmation_tokens_tenant_isolation ON public.confirmation_tokens
  FOR ALL TO authenticated
  USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());
