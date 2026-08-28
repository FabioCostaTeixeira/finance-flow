-- RPCs Transacionais PostgreSQL com idempotência e auditoria para a API Externa

-- 1. Tabela de Idempotência
CREATE TABLE IF NOT EXISTS public.api_idempotency_keys (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    idempotency_key text NOT NULL,
    request_path text NOT NULL,
    response_body jsonb NOT NULL,
    status_code integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT api_idempotency_keys_tenant_key_unique UNIQUE(tenant_id, idempotency_key)
);

ALTER TABLE public.api_idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "idempotency_keys_tenant_policy" ON public.api_idempotency_keys;
CREATE POLICY "idempotency_keys_tenant_policy" ON public.api_idempotency_keys
    FOR ALL TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() LIMIT 1));

-- 2. RPC Transacional de Liquidação (Baixa Integral ou Parcial)
CREATE OR REPLACE FUNCTION public.rpc_baixar_lancamento(
    p_tenant_id uuid,
    p_lancamento_id uuid,
    p_valor_pago numeric,
    p_data_pagamento date DEFAULT CURRENT_DATE,
    p_banco_id uuid DEFAULT NULL,
    p_actor_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_lancamento public.lancamentos%ROWTYPE;
    v_novo_status public.status_lancamento;
    v_resultado jsonb;
BEGIN
    -- Validar existência e isolamento de tenant
    SELECT * INTO v_lancamento
    FROM public.lancamentos
    WHERE id = p_lancamento_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lançamento não encontrado ou não pertence ao tenant' USING ERRCODE = 'P0002';
    END IF;

    IF v_lancamento.status IN ('pago', 'recebido') THEN
        RAISE EXCEPTION 'Lançamento já está liquidado' USING ERRCODE = '22000';
    END IF;

    IF p_valor_pago <= 0 THEN
        RAISE EXCEPTION 'Valor pago deve ser maior que zero' USING ERRCODE = '22003';
    END IF;

    -- Calcular novo status
    IF p_valor_pago >= v_lancamento.valor THEN
        IF v_lancamento.tipo = 'receita' THEN
            v_novo_status := 'recebido';
        ELSE
            v_novo_status := 'pago';
        END IF;
    ELSE
        v_novo_status := 'parcial';
    END IF;

    -- Atualizar lançamento (gatilho de auditoria do banco é disparado automaticamente)
    UPDATE public.lancamentos
    SET status = v_novo_status,
        data_pagamento = p_data_pagamento,
        banco_id = COALESCE(p_banco_id, banco_id),
        updated_at = now()
    WHERE id = p_lancamento_id AND tenant_id = p_tenant_id;

    v_resultado := jsonb_build_object(
        'success', true,
        'id', p_lancamento_id,
        'status', v_novo_status,
        'valor_original', v_lancamento.valor,
        'valor_pago', p_valor_pago,
        'data_pagamento', p_data_pagamento
    );

    RETURN v_resultado;
END;
$$;

-- 3. RPC Transacional de Transferência entre Bancos
CREATE OR REPLACE FUNCTION public.rpc_criar_transferencia(
    p_tenant_id uuid,
    p_banco_origem_id uuid,
    p_banco_destino_id uuid,
    p_valor numeric,
    p_data date DEFAULT CURRENT_DATE,
    p_descricao text DEFAULT 'Transferência entre contas',
    p_actor_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_origem_existe boolean;
    v_destino_existe boolean;
    v_saida_id uuid;
    v_entrada_id uuid;
BEGIN
    IF p_banco_origem_id = p_banco_destino_id THEN
        RAISE EXCEPTION 'Banco de origem e destino devem ser diferentes' USING ERRCODE = '22000';
    END IF;

    IF p_valor <= 0 THEN
        RAISE EXCEPTION 'Valor da transferência deve ser maior que zero' USING ERRCODE = '22003';
    END IF;

    -- Validar existência dos bancos no mesmo tenant
    SELECT EXISTS(SELECT 1 FROM public.bancos WHERE id = p_banco_origem_id AND tenant_id = p_tenant_id) INTO v_origem_existe;
    SELECT EXISTS(SELECT 1 FROM public.bancos WHERE id = p_banco_destino_id AND tenant_id = p_tenant_id) INTO v_destino_existe;

    IF NOT v_origem_existe OR NOT v_destino_existe THEN
        RAISE EXCEPTION 'Banco de origem ou destino não pertence ao tenant' USING ERRCODE = 'P0002';
    END IF;

    -- Lançamento de Saída do Banco Origem
    INSERT INTO public.lancamentos (
        tenant_id, tipo, status, cliente_credor, valor, data_vencimento, data_pagamento, banco_id, observacao
    ) VALUES (
        p_tenant_id, 'despesa', 'transferencia', 'Transferência Saída', p_valor, p_data, p_data, p_banco_origem_id, p_descricao
    ) RETURNING id INTO v_saida_id;

    -- Lançamento de Entrada no Banco Destino
    INSERT INTO public.lancamentos (
        tenant_id, tipo, status, cliente_credor, valor, data_vencimento, data_pagamento, banco_id, observacao
    ) VALUES (
        p_tenant_id, 'receita', 'transferencia', 'Transferência Entrada', p_valor, p_data, p_data, p_banco_destino_id, p_descricao
    ) RETURNING id INTO v_entrada_id;

    RETURN jsonb_build_object(
        'success', true,
        'saida_id', v_saida_id,
        'entrada_id', v_entrada_id,
        'valor', p_valor,
        'banco_origem_id', p_banco_origem_id,
        'banco_destino_id', p_banco_destino_id
    );
END;
$$;
