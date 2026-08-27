-- comprovantes_metadados table
CREATE TABLE IF NOT EXISTS public.comprovantes_metadados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lancamento_id uuid REFERENCES public.lancamentos(id) ON DELETE SET NULL,
  hash_sha256 text NOT NULL,
  nome_original text NOT NULL,
  mime_type text NOT NULL,
  tamanho_bytes bigint NOT NULL CHECK (tamanho_bytes > 0 AND tamanho_bytes <= 10485760),
  storage_path text NOT NULL,
  origem text NOT NULL DEFAULT 'mcp_upload',
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, hash_sha256)
);

CREATE INDEX IF NOT EXISTS idx_comprovantes_tenant ON public.comprovantes_metadados(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comprovantes_lancamento ON public.comprovantes_metadados(lancamento_id);

ALTER TABLE public.comprovantes_metadados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comprovantes_tenant_isolation ON public.comprovantes_metadados;
CREATE POLICY comprovantes_tenant_isolation ON public.comprovantes_metadados
  FOR ALL TO authenticated
  USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());
