-- Atualizar função para incluir transferências no cálculo de saldos
CREATE OR REPLACE FUNCTION public.get_bancos_com_saldos(data_inicio date DEFAULT NULL::date, data_fim date DEFAULT NULL::date)
 RETURNS TABLE(banco_id uuid, banco_nome text, total_entradas numeric, total_saidas numeric, saldo numeric, entradas_recebidas numeric, entradas_a_receber numeric, saidas_pagas numeric, saidas_a_pagar numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    b.id AS banco_id,
    b.nome AS banco_nome,
    -- Total entradas (projetado = recebido + a receber + transferencias)
    COALESCE(SUM(CASE WHEN l.tipo = 'receita' THEN l.valor ELSE 0 END), 0) AS total_entradas,
    -- Total saídas (projetado = pago + a pagar + transferencias)
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa' THEN l.valor ELSE 0 END), 0) AS total_saidas,
    -- Saldo projetado
    COALESCE(SUM(CASE WHEN l.tipo = 'receita' THEN l.valor ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa' THEN l.valor ELSE 0 END), 0) AS saldo,
    -- Entradas recebidas (status = recebido, parcial ou transferencia)
    COALESCE(SUM(CASE WHEN l.tipo = 'receita' AND l.status IN ('recebido', 'parcial', 'transferencia') THEN COALESCE(l.valor_pago, 0) ELSE 0 END), 0) AS entradas_recebidas,
    -- Entradas a receber (status = a_receber ou atrasado)
    COALESCE(SUM(CASE WHEN l.tipo = 'receita' AND l.status IN ('a_receber', 'atrasado', 'vencida') THEN l.valor ELSE 0 END), 0) AS entradas_a_receber,
    -- Saídas pagas (status = pago, parcial ou transferencia)
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa' AND l.status IN ('pago', 'parcial', 'transferencia') THEN COALESCE(l.valor_pago, 0) ELSE 0 END), 0) AS saidas_pagas,
    -- Saídas a pagar (status = a_pagar ou atrasado)
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa' AND l.status IN ('a_pagar', 'atrasado') THEN l.valor ELSE 0 END), 0) AS saidas_a_pagar
  FROM public.bancos b
  LEFT JOIN public.lancamentos l ON l.banco_id = b.id
    AND (data_inicio IS NULL OR l.data_vencimento >= data_inicio)
    AND (data_fim IS NULL OR l.data_vencimento <= data_fim)
  GROUP BY b.id, b.nome
  ORDER BY b.nome;
END;
$function$;