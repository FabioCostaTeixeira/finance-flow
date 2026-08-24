-- Corrige get_bancos_com_saldos para usar data_pagamento nas colunas realizadas.
-- Problema anterior: o filtro de período usava data_vencimento para todos os campos,
-- fazendo entradas_recebidas e saidas_pagas retornarem 0 quando o pagamento ocorreu
-- num mês diferente do vencimento.
-- Correção: usar COALESCE(data_pagamento, data_vencimento) como data efetiva do filtro.
CREATE OR REPLACE FUNCTION public.get_bancos_com_saldos(data_inicio date DEFAULT NULL::date, data_fim date DEFAULT NULL::date)
 RETURNS TABLE(banco_id uuid, banco_nome text, total_entradas numeric, total_saidas numeric, saldo numeric, entradas_recebidas numeric, entradas_a_receber numeric, saidas_pagas numeric, saidas_a_pagar numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    b.id   AS banco_id,
    b.nome AS banco_nome,

    -- Total entradas projetadas (usa data efetiva = pagamento se pago, senão vencimento)
    COALESCE(SUM(CASE WHEN l.tipo = 'receita'
      AND (data_inicio IS NULL OR COALESCE(l.data_pagamento, l.data_vencimento) >= data_inicio)
      AND (data_fim   IS NULL OR COALESCE(l.data_pagamento, l.data_vencimento) <= data_fim)
      THEN l.valor ELSE 0 END), 0) AS total_entradas,

    -- Total saídas projetadas
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa'
      AND (data_inicio IS NULL OR COALESCE(l.data_pagamento, l.data_vencimento) >= data_inicio)
      AND (data_fim   IS NULL OR COALESCE(l.data_pagamento, l.data_vencimento) <= data_fim)
      THEN l.valor ELSE 0 END), 0) AS total_saidas,

    -- Saldo projetado
    COALESCE(SUM(CASE WHEN l.tipo = 'receita'
      AND (data_inicio IS NULL OR COALESCE(l.data_pagamento, l.data_vencimento) >= data_inicio)
      AND (data_fim   IS NULL OR COALESCE(l.data_pagamento, l.data_vencimento) <= data_fim)
      THEN l.valor ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa'
      AND (data_inicio IS NULL OR COALESCE(l.data_pagamento, l.data_vencimento) >= data_inicio)
      AND (data_fim   IS NULL OR COALESCE(l.data_pagamento, l.data_vencimento) <= data_fim)
      THEN l.valor ELSE 0 END), 0) AS saldo,

    -- Entradas recebidas: filtra por data_pagamento (dinheiro efetivamente recebido)
    COALESCE(SUM(CASE WHEN l.tipo = 'receita'
      AND l.status IN ('recebido', 'parcial', 'transferencia')
      AND (data_inicio IS NULL OR l.data_pagamento >= data_inicio)
      AND (data_fim   IS NULL OR l.data_pagamento <= data_fim)
      THEN COALESCE(l.valor_pago, 0) ELSE 0 END), 0) AS entradas_recebidas,

    -- Entradas a receber: filtra por data_vencimento (ainda não recebido)
    COALESCE(SUM(CASE WHEN l.tipo = 'receita'
      AND l.status IN ('a_receber', 'atrasado', 'vencida')
      AND (data_inicio IS NULL OR l.data_vencimento >= data_inicio)
      AND (data_fim   IS NULL OR l.data_vencimento <= data_fim)
      THEN l.valor ELSE 0 END), 0) AS entradas_a_receber,

    -- Saídas pagas: filtra por data_pagamento (dinheiro efetivamente saído)
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa'
      AND l.status IN ('pago', 'parcial', 'transferencia')
      AND (data_inicio IS NULL OR l.data_pagamento >= data_inicio)
      AND (data_fim   IS NULL OR l.data_pagamento <= data_fim)
      THEN COALESCE(l.valor_pago, 0) ELSE 0 END), 0) AS saidas_pagas,

    -- Saídas a pagar: filtra por data_vencimento (ainda não pago)
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa'
      AND l.status IN ('a_pagar', 'atrasado')
      AND (data_inicio IS NULL OR l.data_vencimento >= data_inicio)
      AND (data_fim   IS NULL OR l.data_vencimento <= data_fim)
      THEN l.valor ELSE 0 END), 0) AS saidas_a_pagar

  FROM public.bancos b
  LEFT JOIN public.lancamentos l ON l.banco_id = b.id
  GROUP BY b.id, b.nome
  ORDER BY b.nome;
END;
$function$;
