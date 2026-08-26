REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_chat_message_user_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.audit_lancamentos() FROM anon, public;
DROP FUNCTION IF EXISTS public.rls_auto_enable();
DROP FUNCTION IF EXISTS public.get_user_role(uuid);
DROP FUNCTION IF EXISTS public.has_permission(uuid, text);

-- O executor SQL privilegiado foi removido. Validar SQL arbitrário e injetar
-- tenant_id corretamente exige um parser dedicado; manter a RPC seria um
-- caminho de exfiltração. Uma task futura poderá reintroduzir apenas consultas
-- parametrizadas e previamente registradas.
DROP FUNCTION IF EXISTS public.execute_readonly_query(text);

CREATE OR REPLACE FUNCTION public.get_fluxo_caixa(_tenant uuid, _data_inicio date DEFAULT NULL, _data_fim date DEFAULT NULL)
RETURNS TABLE(mes date, entradas numeric, saidas numeric, saldo numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.can_access(_tenant, 'fluxo-caixa') THEN RAISE EXCEPTION 'Acesso negado ao fluxo de caixa deste tenant'; END IF;
  RETURN QUERY SELECT date_trunc('month', COALESCE(l.data_pagamento,l.data_vencimento))::date,
    COALESCE(SUM(CASE WHEN l.tipo='receita' THEN l.valor ELSE 0 END),0)::numeric,
    COALESCE(SUM(CASE WHEN l.tipo='despesa' THEN l.valor ELSE 0 END),0)::numeric,
    (COALESCE(SUM(CASE WHEN l.tipo='receita' THEN l.valor ELSE 0 END),0)-COALESCE(SUM(CASE WHEN l.tipo='despesa' THEN l.valor ELSE 0 END),0))::numeric
  FROM public.lancamentos l WHERE l.tenant_id=_tenant
    AND (_data_inicio IS NULL OR COALESCE(l.data_pagamento,l.data_vencimento)>=_data_inicio)
    AND (_data_fim IS NULL OR COALESCE(l.data_pagamento,l.data_vencimento)<=_data_fim)
  GROUP BY 1 ORDER BY 1;
END $$;
REVOKE EXECUTE ON FUNCTION public.get_fluxo_caixa(uuid,date,date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_fluxo_caixa(uuid,date,date) TO authenticated;

ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_chat_message_user_id() SET search_path = public, pg_temp;

DROP FUNCTION IF EXISTS public.get_bancos_com_saldos(date, date);
CREATE OR REPLACE FUNCTION public.get_bancos_com_saldos(
  _tenant uuid, _data_inicio date DEFAULT NULL, _data_fim date DEFAULT NULL
)
RETURNS TABLE(banco_id uuid, banco_nome text, total_entradas numeric, total_saidas numeric,
  saldo numeric, entradas_recebidas numeric, entradas_a_receber numeric,
  saidas_pagas numeric, saidas_a_pagar numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT b.id, b.nome,
    COALESCE(SUM(CASE WHEN l.tipo = 'receita' THEN l.valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa' THEN l.valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN l.tipo = 'receita' THEN l.valor ELSE -l.valor END), 0),
    COALESCE(SUM(CASE WHEN l.tipo = 'receita' AND l.status = 'recebido' THEN l.valor_pago ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN l.tipo = 'receita' AND l.status = 'a_receber' THEN l.valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa' AND l.status = 'pago' THEN l.valor_pago ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa' AND l.status = 'a_pagar' THEN l.valor ELSE 0 END), 0)
  FROM public.bancos b
  LEFT JOIN public.lancamentos l ON l.banco_id = b.id AND l.tenant_id = _tenant
    AND (_data_inicio IS NULL OR COALESCE(l.data_pagamento, l.data_vencimento) >= _data_inicio)
    AND (_data_fim IS NULL OR COALESCE(l.data_pagamento, l.data_vencimento) <= _data_fim)
  WHERE b.tenant_id = _tenant AND public.can_access(_tenant, 'bancos')
  GROUP BY b.id, b.nome ORDER BY b.nome
$$;
REVOKE EXECUTE ON FUNCTION public.get_bancos_com_saldos(uuid,date,date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_bancos_com_saldos(uuid,date,date) TO service_role, authenticated;
