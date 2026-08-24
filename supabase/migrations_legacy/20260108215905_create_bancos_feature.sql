-- 1. Create the bancos table
CREATE TABLE public.bancos (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    nome character varying NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT bancos_pkey PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE public.bancos ENABLE ROW LEVEL SECURITY;

-- 2. Seed the initial bank data
INSERT INTO public.bancos (nome)
VALUES
    ('Stone PJ'),
    ('Stone PF'),
    ('Nubank');

-- 3. Alter the lancamentos table to link to bancos
ALTER TABLE public.lancamentos
ADD COLUMN banco_id uuid NULL,
ADD CONSTRAINT lancamentos_banco_id_fkey FOREIGN KEY (banco_id) REFERENCES public.bancos(id) ON DELETE SET NULL;

-- 4. Create the function to get bank balances with date filters
CREATE OR REPLACE FUNCTION public.get_bancos_com_saldos(start_date date, end_date date)
RETURNS TABLE (
    id uuid,
    nome character varying,
    total_entradas numeric,
    total_saidas numeric,
    saldo numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.id,
        b.nome,
        COALESCE(SUM(CASE WHEN l.tipo = 'receita' THEN l.valor ELSE 0 END) FILTER (WHERE l.id IS NOT NULL), 0) as total_entradas,
        COALESCE(SUM(CASE WHEN l.tipo = 'despesa' THEN l.valor ELSE 0 END) FILTER (WHERE l.id IS NOT NULL), 0) as total_saidas,
        COALESCE(SUM(
            CASE 
                WHEN l.tipo = 'receita' THEN l.valor 
                WHEN l.tipo = 'despesa' THEN -l.valor 
                ELSE 0 
            END
        ) FILTER (WHERE l.id IS NOT NULL), 0) as saldo
    FROM
        public.bancos b
    LEFT JOIN
        public.lancamentos l ON b.id = l.banco_id
        AND (start_date IS NULL OR l.data_vencimento >= start_date)
        AND (end_date IS NULL OR l.data_vencimento <= end_date)
    GROUP BY
        b.id, b.nome
    ORDER BY
        b.nome;
END;
$$ LANGUAGE plpgsql;
