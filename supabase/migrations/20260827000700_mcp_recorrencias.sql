-- Recorrencias table & RPCs
CREATE TABLE IF NOT EXISTS public.recorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  valor numeric(15,2) NOT NULL CHECK (valor > 0),
  frequencia text NOT NULL CHECK (frequencia IN ('semanal', 'mensal', 'anual')),
  data_inicio date NOT NULL,
  data_fim date,
  total_parcelas integer CHECK (total_parcelas IS NULL OR total_parcelas > 0),
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'pausada', 'cancelada')),
  banco_id uuid NOT NULL REFERENCES public.bancos(id) ON DELETE RESTRICT,
  categoria_id uuid NOT NULL REFERENCES public.categorias(id) ON DELETE RESTRICT,
  observacao text,
  version integer NOT NULL DEFAULT 1,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recorrencias_tenant ON public.recorrencias(tenant_id, status);

ALTER TABLE public.recorrencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recorrencias_tenant_isolation ON public.recorrencias;
CREATE POLICY recorrencias_tenant_isolation ON public.recorrencias
  FOR ALL TO authenticated
  USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE OR REPLACE FUNCTION public.alterar_status_recorrencia(
  p_recorrencia_id uuid,
  p_novo_status text
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
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'TENANT_NOT_SET'; END IF;

  IF p_novo_status NOT IN ('ativa', 'pausada', 'cancelada') THEN
    RAISE EXCEPTION 'STATUS_INVALIDO';
  END IF;

  UPDATE public.recorrencias
  SET status = p_novo_status, version = version + 1, updated_at = now()
  WHERE id = p_recorrencia_id AND tenant_id = v_tenant_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.alterar_status_recorrencia(uuid, text) FROM anon, public;
