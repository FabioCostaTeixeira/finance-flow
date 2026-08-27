-- Atomic transfer table & RPCs
CREATE TABLE IF NOT EXISTS public.transferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  banco_origem_id uuid NOT NULL REFERENCES public.bancos(id) ON DELETE RESTRICT,
  banco_destino_id uuid NOT NULL REFERENCES public.bancos(id) ON DELETE RESTRICT,
  valor numeric(15,2) NOT NULL CHECK (valor > 0),
  data_transferencia date NOT NULL DEFAULT CURRENT_DATE,
  descricao text,
  status text NOT NULL DEFAULT 'efetivada' CHECK (status IN ('efetivada', 'estornada')),
  lancamento_origem_id uuid REFERENCES public.lancamentos(id) ON DELETE SET NULL,
  lancamento_destino_id uuid REFERENCES public.lancamentos(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (banco_origem_id <> banco_destino_id)
);

CREATE INDEX IF NOT EXISTS idx_transferencias_tenant ON public.transferencias(tenant_id, created_at DESC);

ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transferencias_tenant_isolation ON public.transferencias;
CREATE POLICY transferencias_tenant_isolation ON public.transferencias
  FOR ALL TO authenticated
  USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE OR REPLACE FUNCTION public.criar_transferencia_atomica(
  p_banco_origem_id uuid,
  p_banco_destino_id uuid,
  p_valor numeric,
  p_data_transferencia date DEFAULT CURRENT_DATE,
  p_descricao text DEFAULT NULL,
  p_request_id text DEFAULT NULL
)
RETURNS TABLE (
  transferencia_id uuid,
  lancamento_origem_id uuid,
  lancamento_destino_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
  v_banco_origem record;
  v_banco_destino record;
  v_transferencia_id uuid;
  v_origem_id uuid;
  v_destino_id uuid;
BEGIN
  v_tenant_id := public.get_current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'TENANT_NOT_SET';
  END IF;

  IF p_banco_origem_id = p_banco_destino_id THEN
    RAISE EXCEPTION 'MESMO_BANCO_ORIGEM_DESTINO';
  END IF;

  IF p_valor <= 0 THEN
    RAISE EXCEPTION 'VALOR_INVALIDO';
  END IF;

  SELECT * INTO v_banco_origem FROM public.bancos WHERE id = p_banco_origem_id AND tenant_id = v_tenant_id FOR UPDATE;
  IF v_banco_origem.id IS NULL THEN RAISE EXCEPTION 'BANCO_ORIGEM_NOT_FOUND'; END IF;

  SELECT * INTO v_banco_destino FROM public.bancos WHERE id = p_banco_destino_id AND tenant_id = v_tenant_id FOR UPDATE;
  IF v_banco_destino.id IS NULL THEN RAISE EXCEPTION 'BANCO_DESTINO_NOT_FOUND'; END IF;

  v_transferencia_id := gen_random_uuid();

  INSERT INTO public.lancamentos (
    tenant_id, tipo, descricao, valor, valor_pago, status, data_vencimento, data_pagamento, banco_id
  ) VALUES (
    v_tenant_id, 'despesa', COALESCE(p_descricao, 'Transferência de saída'), p_valor, p_valor, 'transferencia',
    p_data_transferencia, p_data_transferencia, p_banco_origem_id
  ) RETURNING id INTO v_origem_id;

  INSERT INTO public.lancamentos (
    tenant_id, tipo, descricao, valor, valor_pago, status, data_vencimento, data_pagamento, banco_id
  ) VALUES (
    v_tenant_id, 'receita', COALESCE(p_descricao, 'Transferência de entrada'), p_valor, p_valor, 'transferencia',
    p_data_transferencia, p_data_transferencia, p_banco_destino_id
  ) RETURNING id INTO v_destino_id;

  INSERT INTO public.transferencias (
    id, tenant_id, banco_origem_id, banco_destino_id, valor, data_transferencia,
    descricao, status, lancamento_origem_id, lancamento_destino_id, request_id
  ) VALUES (
    v_transferencia_id, v_tenant_id, p_banco_origem_id, p_banco_destino_id, p_valor,
    p_data_transferencia, p_descricao, 'efetivada', v_origem_id, v_destino_id, p_request_id
  );

  RETURN QUERY SELECT v_transferencia_id, v_origem_id, v_destino_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.estornar_transferencia(
  p_transferencia_id uuid,
  p_request_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
  v_trans record;
BEGIN
  v_tenant_id := public.get_current_tenant_id();
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'TENANT_NOT_SET'; END IF;

  SELECT * INTO v_trans
  FROM public.transferencias
  WHERE id = p_transferencia_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF v_trans.id IS NULL THEN RAISE EXCEPTION 'TRANSFERENCIA_NOT_FOUND'; END IF;
  IF v_trans.status = 'estornada' THEN RAISE EXCEPTION 'TRANSFERENCIA_JA_ESTORNADA'; END IF;

  UPDATE public.transferencias
  SET status = 'estornada', updated_at = now()
  WHERE id = p_transferencia_id;

  IF v_trans.lancamento_origem_id IS NOT NULL THEN
    DELETE FROM public.lancamentos WHERE id = v_trans.lancamento_origem_id AND tenant_id = v_tenant_id;
  END IF;

  IF v_trans.lancamento_destino_id IS NOT NULL THEN
    DELETE FROM public.lancamentos WHERE id = v_trans.lancamento_destino_id AND tenant_id = v_tenant_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.criar_transferencia_atomica(uuid, uuid, numeric, date, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.estornar_transferencia(uuid, text) FROM anon, public;
