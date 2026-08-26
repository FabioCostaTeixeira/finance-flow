-- get_bancos_com_saldos classificava "recebido"/"pago" só pelos status
-- 'recebido'/'pago', nunca incluindo 'transferencia'. Uma transferência entre
-- contas é criada já liquidada (status='transferencia', valor_pago=valor no
-- momento da criação — ver useTransferencia.ts), então é dinheiro real que
-- entrou ou saiu daquela conta especificamente. O resto do app já trata
-- 'transferencia' como quitado (ex.: FluxoCaixa.tsx: isQuitado inclui
-- 'transferencia'); só esta função tinha ficado pra trás, fazendo
-- entradas_recebidas/saidas_pagas — e por extensão o "Saldo Atual" da tela de
-- Bancos — divergirem do saldo real de cada conta.
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
    COALESCE(SUM(CASE WHEN l.tipo = 'receita' AND l.status IN ('recebido','transferencia') THEN l.valor_pago ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN l.tipo = 'receita' AND l.status = 'a_receber' THEN l.valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa' AND l.status IN ('pago','transferencia') THEN l.valor_pago ELSE 0 END), 0),
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
