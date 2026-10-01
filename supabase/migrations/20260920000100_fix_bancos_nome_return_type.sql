-- A migration 20260919000100 reescreveu get_bancos_com_saldos de LANGUAGE sql
-- para plpgsql. Em plpgsql, RETURN QUERY exige que cada coluna tenha exatamente
-- o tipo declarado no RETURNS TABLE; em SQL puro o cast implícito passava. Como
-- bancos.nome é character varying e a coluna declarada é banco_nome text, toda
-- chamada da RPC passou a falhar com:
--
--   structure of query does not match function result type
--   Returned type character varying does not match expected type text in column 2
--
-- Na prática a aba Bancos ficava presa em "Carregando dados...". Correção: fazer
-- o cast explícito para text. O resto do corpo é idêntico ao da 20260919000100.

CREATE OR REPLACE FUNCTION public.get_bancos_com_saldos(
  _tenant uuid, _data_inicio date DEFAULT NULL, _data_fim date DEFAULT NULL
)
RETURNS TABLE(
  banco_id uuid,
  banco_nome text,
  total_entradas numeric,
  total_saidas numeric,
  saldo numeric,
  entradas_recebidas numeric,
  entradas_a_receber numeric,
  saidas_pagas numeric,
  saidas_a_pagar numeric,
  saldo_atual_real numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  -- A edge function `api` chama esta RPC com service_role, onde auth.uid() é
  -- NULL e can_access() seria sempre falso. Lá o escopo de tenant já foi
  -- resolvido pela API key, então o guard vale só para usuários autenticados.
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NOT (
       public.can_access(_tenant, 'bancos')
       OR public.can_access(_tenant, 'receitas')
       OR public.can_access(_tenant, 'despesas')
       OR public.can_access(_tenant, 'fluxo-caixa')
     ) THEN
    RAISE EXCEPTION 'Acesso negado aos bancos deste tenant';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      b.id   AS b_id,
      b.nome AS b_nome,
      l.tipo AS tipo,
      l.valor AS valor,
      -- Quanto deste lançamento já entrou/saiu de fato na conta.
      CASE
        WHEN l.status IN ('recebido', 'pago', 'transferencia')
          THEN CASE WHEN COALESCE(l.valor_pago, 0) > 0 THEN l.valor_pago ELSE l.valor END
        WHEN l.status = 'parcial'
          THEN COALESCE(l.valor_pago, 0)
        ELSE 0
      END AS realizado,
      -- Quanto ainda falta entrar/sair. Piso em 0: valor_pago acima do valor
      -- (correção manual, juros lançados no pago) não vira pendência negativa.
      CASE
        WHEN l.status IN ('recebido', 'pago', 'transferencia') THEN 0
        ELSE GREATEST(l.valor - COALESCE(l.valor_pago, 0), 0)
      END AS pendente
    FROM public.bancos b
    LEFT JOIN public.lancamentos l
      ON l.banco_id = b.id
     AND l.tenant_id = _tenant
     AND (_data_inicio IS NULL OR COALESCE(l.data_pagamento, l.data_vencimento) >= _data_inicio)
     AND (_data_fim    IS NULL OR COALESCE(l.data_pagamento, l.data_vencimento) <= _data_fim)
    WHERE b.tenant_id = _tenant
  )
  SELECT
    base.b_id,
    base.b_nome::text,
    COALESCE(SUM(CASE WHEN base.tipo = 'receita' THEN base.valor ELSE 0 END), 0)::numeric,
    COALESCE(SUM(CASE WHEN base.tipo = 'despesa' THEN base.valor ELSE 0 END), 0)::numeric,
    COALESCE(SUM(CASE WHEN base.tipo = 'receita' THEN base.valor ELSE -base.valor END), 0)::numeric,
    COALESCE(SUM(CASE WHEN base.tipo = 'receita' THEN base.realizado ELSE 0 END), 0)::numeric,
    COALESCE(SUM(CASE WHEN base.tipo = 'receita' THEN base.pendente  ELSE 0 END), 0)::numeric,
    COALESCE(SUM(CASE WHEN base.tipo = 'despesa' THEN base.realizado ELSE 0 END), 0)::numeric,
    COALESCE(SUM(CASE WHEN base.tipo = 'despesa' THEN base.pendente  ELSE 0 END), 0)::numeric,
    COALESCE(SUM(CASE WHEN base.tipo = 'receita' THEN base.realizado ELSE -base.realizado END), 0)::numeric
  FROM base
  GROUP BY base.b_id, base.b_nome
  ORDER BY base.b_nome;
END $$;

REVOKE EXECUTE ON FUNCTION public.get_bancos_com_saldos(uuid, date, date) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.get_bancos_com_saldos(uuid, date, date) TO service_role, authenticated;
