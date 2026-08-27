-- movimentos_pagamento table
CREATE TABLE IF NOT EXISTS public.movimentos_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lancamento_id uuid NOT NULL REFERENCES public.lancamentos(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('pagamento', 'recebimento', 'correção', 'estorno')),
  valor numeric(15,2) NOT NULL CHECK (valor > 0),
  moeda text NOT NULL DEFAULT 'BRL',
  data_movimento date NOT NULL DEFAULT CURRENT_DATE,
  banco_id uuid NOT NULL REFERENCES public.bancos(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'efetivado' CHECK (status IN ('efetivado', 'estornado')),
  movimento_origem_id uuid REFERENCES public.movimentos_pagamento(id),
  operacao text NOT NULL DEFAULT 'integral' CHECK (operacao IN ('integral', 'parcial')),
  observacao text,
  version integer NOT NULL DEFAULT 1,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movimentos_lancamento ON public.movimentos_pagamento(lancamento_id);
CREATE INDEX IF NOT EXISTS idx_movimentos_tenant ON public.movimentos_pagamento(tenant_id, created_at DESC);

ALTER TABLE public.movimentos_pagamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS movimentos_pagamento_select ON public.movimentos_pagamento;
CREATE POLICY movimentos_pagamento_select ON public.movimentos_pagamento
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS movimentos_pagamento_insert ON public.movimentos_pagamento;
CREATE POLICY movimentos_pagamento_insert ON public.movimentos_pagamento
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS movimentos_pagamento_update ON public.movimentos_pagamento;
CREATE POLICY movimentos_pagamento_update ON public.movimentos_pagamento
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_current_tenant_id());

CREATE OR REPLACE FUNCTION public.registrar_movimento_pagamento(
  p_lancamento_id uuid,
  p_valor numeric,
  p_banco_id uuid,
  p_tipo text DEFAULT 'pagamento',
  p_operacao text DEFAULT 'integral',
  p_data_movimento date DEFAULT CURRENT_DATE,
  p_observacao text DEFAULT NULL,
  p_request_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
  v_lancamento record;
  v_banco_tenant uuid;
  v_saldo_restante numeric;
  v_total_pago numeric;
  v_movimento_id uuid;
  v_novo_status text;
BEGIN
  v_tenant_id := public.get_current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'TENANT_NOT_SET';
  END IF;

  SELECT * INTO v_lancamento
  FROM public.lancamentos
  WHERE id = p_lancamento_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF v_lancamento.id IS NULL THEN
    RAISE EXCEPTION 'LANCAMENTO_NOT_FOUND';
  END IF;

  SELECT tenant_id INTO v_banco_tenant
  FROM public.bancos WHERE id = p_banco_id;
  IF v_banco_tenant IS NULL OR v_banco_tenant <> v_tenant_id THEN
    RAISE EXCEPTION 'BANCO_NOT_FOUND';
  END IF;

  SELECT COALESCE(SUM(CASE WHEN status = 'efetivado' AND tipo IN ('pagamento','recebimento') THEN valor ELSE 0 END)
       - SUM(CASE WHEN status = 'efetivado' AND tipo = 'estorno' THEN valor ELSE 0 END), 0)
  INTO v_total_pago
  FROM public.movimentos_pagamento
  WHERE lancamento_id = p_lancamento_id AND tenant_id = v_tenant_id;

  v_saldo_restante := v_lancamento.valor - v_total_pago;

  IF p_valor > v_saldo_restante THEN
    RAISE EXCEPTION 'VALOR_EXCEDE_SALDO: restante=%, solicitado=%', v_saldo_restante, p_valor;
  END IF;

  IF p_valor <= 0 THEN
    RAISE EXCEPTION 'VALOR_INVALIDO';
  END IF;

  INSERT INTO public.movimentos_pagamento (
    tenant_id, lancamento_id, tipo, valor, moeda, data_movimento, banco_id,
    operacao, observacao, request_id
  ) VALUES (
    v_tenant_id, p_lancamento_id, p_tipo, p_valor, 'BRL', p_data_movimento, p_banco_id,
    p_operacao, p_observacao, p_request_id
  ) RETURNING id INTO v_movimento_id;

  v_total_pago := v_total_pago + p_valor;

  IF v_total_pago >= v_lancamento.valor THEN
    IF v_lancamento.tipo = 'receita' THEN v_novo_status := 'recebido';
    ELSE v_novo_status := 'pago';
    END IF;
  ELSE
    v_novo_status := 'parcial';
  END IF;

  UPDATE public.lancamentos
  SET status = v_novo_status,
      valor_pago = v_total_pago,
      data_pagamento = CASE WHEN v_total_pago >= valor THEN p_data_movimento ELSE data_pagamento END,
      version = version + 1,
      updated_at = now()
  WHERE id = p_lancamento_id;

  RETURN v_movimento_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.estornar_movimento(
  p_movimento_id uuid,
  p_observacao text DEFAULT NULL,
  p_request_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
  v_movimento record;
  v_lancamento record;
  v_total_pago numeric;
  v_estorno_id uuid;
  v_novo_status text;
BEGIN
  v_tenant_id := public.get_current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'TENANT_NOT_SET';
  END IF;

  SELECT * INTO v_movimento
  FROM public.movimentos_pagamento
  WHERE id = p_movimento_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF v_movimento.id IS NULL THEN
    RAISE EXCEPTION 'MOVIMENTO_NOT_FOUND';
  END IF;

  IF v_movimento.status = 'estornado' THEN
    RAISE EXCEPTION 'MOVIMENTO_JA_ESTORNADO';
  END IF;

  IF v_movimento.tipo = 'estorno' THEN
    RAISE EXCEPTION 'ESTORNO_DE_ESTORNO';
  END IF;

  UPDATE public.movimentos_pagamento
  SET status = 'estornado', updated_at = now()
  WHERE id = p_movimento_id;

  INSERT INTO public.movimentos_pagamento (
    tenant_id, lancamento_id, tipo, valor, moeda, data_movimento, banco_id,
    operacao, movimento_origem_id, observacao, request_id
  ) VALUES (
    v_tenant_id, v_movimento.lancamento_id, 'estorno', v_movimento.valor, v_movimento.moeda,
    CURRENT_DATE, v_movimento.banco_id, v_movimento.operacao, p_movimento_id,
    COALESCE(p_observacao, 'Estorno do movimento ' || p_movimento_id), p_request_id
  ) RETURNING id INTO v_estorno_id;

  SELECT * INTO v_lancamento
  FROM public.lancamentos WHERE id = v_movimento.lancamento_id FOR UPDATE;

  SELECT COALESCE(SUM(CASE WHEN status = 'efetivado' AND tipo IN ('pagamento','recebimento') THEN valor ELSE 0 END)
       - SUM(CASE WHEN status = 'efetivado' AND tipo = 'estorno' THEN valor ELSE 0 END), 0)
  INTO v_total_pago
  FROM public.movimentos_pagamento
  WHERE lancamento_id = v_movimento.lancamento_id AND tenant_id = v_tenant_id;

  IF v_total_pago <= 0 THEN
    IF v_lancamento.tipo = 'receita' THEN v_novo_status := 'a_receber';
    ELSE v_novo_status := 'a_pagar';
    END IF;
  ELSIF v_total_pago < v_lancamento.valor THEN
    v_novo_status := 'parcial';
  ELSE
    IF v_lancamento.tipo = 'receita' THEN v_novo_status := 'recebido';
    ELSE v_novo_status := 'pago';
    END IF;
  END IF;

  UPDATE public.lancamentos
  SET status = v_novo_status,
      valor_pago = v_total_pago,
      data_pagamento = CASE WHEN v_total_pago <= 0 THEN NULL ELSE data_pagamento END,
      version = version + 1,
      updated_at = now()
  WHERE id = v_movimento.lancamento_id;

  RETURN v_estorno_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.corrigir_movimento(
  p_movimento_id uuid,
  p_novo_valor numeric DEFAULT NULL,
  p_novo_banco_id uuid DEFAULT NULL,
  p_nova_data date DEFAULT NULL,
  p_observacao text DEFAULT NULL,
  p_request_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_estorno_id uuid;
  v_novo_id uuid;
  v_movimento record;
  v_tenant_id uuid;
BEGIN
  v_tenant_id := public.get_current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'TENANT_NOT_SET';
  END IF;

  SELECT * INTO v_movimento
  FROM public.movimentos_pagamento
  WHERE id = p_movimento_id AND tenant_id = v_tenant_id;

  IF v_movimento.id IS NULL THEN
    RAISE EXCEPTION 'MOVIMENTO_NOT_FOUND';
  END IF;

  v_estorno_id := public.estornar_movimento(p_movimento_id, 'Correção: estorno automático', p_request_id);

  v_novo_id := public.registrar_movimento_pagamento(
    v_movimento.lancamento_id,
    COALESCE(p_novo_valor, v_movimento.valor),
    COALESCE(p_novo_banco_id, v_movimento.banco_id),
    v_movimento.tipo,
    v_movimento.operacao,
    COALESCE(p_nova_data, v_movimento.data_movimento),
    COALESCE(p_observacao, 'Correção do movimento ' || p_movimento_id),
    p_request_id
  );

  RETURN v_novo_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.registrar_movimento_pagamento(uuid, numeric, uuid, text, text, date, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.estornar_movimento(uuid, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.corrigir_movimento(uuid, numeric, uuid, date, text, text) FROM anon, public;
