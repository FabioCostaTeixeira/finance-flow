-- Financial reports RPCs
CREATE OR REPLACE FUNCTION public.mcp_relatorio_fluxo_caixa(
  p_data_inicio date,
  p_data_fim date
)
RETURNS TABLE (
  total_receita numeric,
  total_despesa numeric,
  saldo_periodo numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := public.get_current_tenant_id();
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'TENANT_NOT_SET'; END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN l.tipo = 'receita' AND l.status <> 'transferencia' THEN l.valor_pago ELSE 0 END), 0) AS total_receita,
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa' AND l.status <> 'transferencia' THEN l.valor_pago ELSE 0 END), 0) AS total_despesa,
    COALESCE(SUM(CASE WHEN l.tipo = 'receita' AND l.status <> 'transferencia' THEN l.valor_pago ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa' AND l.status <> 'transferencia' THEN l.valor_pago ELSE 0 END), 0) AS saldo_periodo
  FROM public.lancamentos l
  WHERE l.tenant_id = v_tenant_id
    AND l.data_vencimento >= p_data_inicio
    AND l.data_vencimento < p_data_fim;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mcp_relatorio_fluxo_caixa(date, date) FROM anon, public;
