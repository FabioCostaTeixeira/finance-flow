-- Fix lancamentos_bi view to include tenant_id for tenant isolation
DROP VIEW IF EXISTS public.lancamentos_bi CASCADE;

CREATE VIEW public.lancamentos_bi WITH (security_invoker = true) AS
 SELECT l.id,
    l.tenant_id,
    l.data_vencimento,
    l.cliente_credor,
    (l.valor)::double precision AS valor,
    (l.valor_pago)::double precision AS valor_pago,
    l.banco,
    (l.status)::text AS status,
    (l.tipo)::text AS tipo,
    c.nome AS categoria,
    cp.nome AS categoria_pai,
    l.parcela_atual,
    l.total_parcelas,
    l.observacao,
    l.data_pagamento,
    l.created_at
   FROM ((public.lancamentos l
     LEFT JOIN public.categorias c ON ((l.categoria_id = c.id)))
     LEFT JOIN public.categorias cp ON ((c.categoria_pai_id = cp.id)));

GRANT ALL ON TABLE public.lancamentos_bi TO anon;
GRANT ALL ON TABLE public.lancamentos_bi TO authenticated;
GRANT ALL ON TABLE public.lancamentos_bi TO service_role;
