-- Criar a tabela de bancos
CREATE TABLE public.bancos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bancos ENABLE ROW LEVEL SECURITY;

-- Criar política de acesso
CREATE POLICY "Allow all operations on bancos" 
ON public.bancos 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Inserir bancos iniciais
INSERT INTO public.bancos (nome) VALUES 
  ('Stone PJ'),
  ('Stone PF'),
  ('Nubank');

-- Adicionar coluna banco_id na tabela lancamentos
ALTER TABLE public.lancamentos 
ADD COLUMN banco_id UUID REFERENCES public.bancos(id);

-- Criar trigger para atualizar updated_at
CREATE TRIGGER update_bancos_updated_at
BEFORE UPDATE ON public.bancos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para calcular saldos por banco
CREATE OR REPLACE FUNCTION public.get_bancos_com_saldos(
  data_inicio DATE DEFAULT NULL,
  data_fim DATE DEFAULT NULL
)
RETURNS TABLE (
  banco_id UUID,
  banco_nome TEXT,
  total_entradas NUMERIC,
  total_saidas NUMERIC,
  saldo NUMERIC
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id AS banco_id,
    b.nome AS banco_nome,
    COALESCE(SUM(CASE WHEN l.tipo = 'receita' AND l.status IN ('recebido', 'parcial') THEN l.valor_pago ELSE 0 END), 0) AS total_entradas,
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa' AND l.status IN ('pago', 'parcial') THEN l.valor_pago ELSE 0 END), 0) AS total_saidas,
    COALESCE(SUM(CASE WHEN l.tipo = 'receita' AND l.status IN ('recebido', 'parcial') THEN l.valor_pago ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa' AND l.status IN ('pago', 'parcial') THEN l.valor_pago ELSE 0 END), 0) AS saldo
  FROM public.bancos b
  LEFT JOIN public.lancamentos l ON l.banco_id = b.id
    AND (data_inicio IS NULL OR l.data_pagamento >= data_inicio)
    AND (data_fim IS NULL OR l.data_pagamento <= data_fim)
  GROUP BY b.id, b.nome
  ORDER BY b.nome;
END;
$$;