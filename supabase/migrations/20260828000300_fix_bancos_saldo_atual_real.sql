-- Fix get_bancos_com_saldos to calculate real actual balance (saldo_atual_real) and include partial payments
DROP FUNCTION IF EXISTS public.get_bancos_com_saldos(uuid, date, date);

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
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT b.id, b.nome,
    COALESCE(SUM(CASE WHEN l.tipo = 'receita' THEN l.valor ELSE 0 END), 0) AS total_entradas,
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa' THEN l.valor ELSE 0 END), 0) AS total_saidas,
    COALESCE(SUM(CASE WHEN l.tipo = 'receita' THEN l.valor ELSE -l.valor END), 0) AS saldo,
    COALESCE(SUM(CASE WHEN l.tipo = 'receita' AND l.status IN ('recebido','transferencia','parcial') THEN COALESCE(l.valor_pago, l.valor) ELSE 0 END), 0) AS entradas_recebidas,
    COALESCE(SUM(CASE WHEN l.tipo = 'receita' AND l.status IN ('a_receber','vencida') THEN (l.valor - COALESCE(l.valor_pago, 0)) ELSE 0 END), 0) AS entradas_a_receber,
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa' AND l.status IN ('pago','transferencia','parcial') THEN COALESCE(l.valor_pago, l.valor) ELSE 0 END), 0) AS saidas_pagas,
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa' AND l.status IN ('a_pagar','atrasado') THEN (l.valor - COALESCE(l.valor_pago, 0)) ELSE 0 END), 0) AS saidas_a_pagar,
    COALESCE(SUM(CASE WHEN l.tipo = 'receita' AND l.status IN ('recebido','transferencia','parcial') THEN COALESCE(l.valor_pago, l.valor)
                     WHEN l.tipo = 'despesa' AND l.status IN ('pago','transferencia','parcial') THEN -COALESCE(l.valor_pago, l.valor)
                     ELSE 0 END), 0) AS saldo_atual_real
  FROM public.bancos b
  LEFT JOIN public.lancamentos l ON l.banco_id = b.id AND l.tenant_id = _tenant
    AND (_data_inicio IS NULL OR COALESCE(l.data_pagamento, l.data_vencimento) >= _data_inicio)
    AND (_data_fim IS NULL OR COALESCE(l.data_pagamento, l.data_vencimento) <= _data_fim)
  WHERE b.tenant_id = _tenant
  GROUP BY b.id, b.nome ORDER BY b.nome
$$;

REVOKE EXECUTE ON FUNCTION public.get_bancos_com_saldos(uuid,date,date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_bancos_com_saldos(uuid,date,date) TO service_role, authenticated;
