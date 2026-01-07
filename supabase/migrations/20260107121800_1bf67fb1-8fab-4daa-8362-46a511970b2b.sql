-- Create ENUM types
CREATE TYPE public.status_lancamento AS ENUM ('a_receber', 'recebido', 'pago', 'a_pagar', 'parcial');
CREATE TYPE public.tipo_lancamento AS ENUM ('receita', 'despesa');
CREATE TYPE public.frequencia_recorrencia AS ENUM ('semanal', 'mensal', 'trimestral', 'semestral');

-- Create categorias table with self-referencing for subcategories
CREATE TABLE public.categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    nome_normalizado TEXT NOT NULL,
    tipo tipo_lancamento NOT NULL,
    categoria_pai_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for fuzzy search
CREATE INDEX idx_categorias_nome_normalizado ON public.categorias(nome_normalizado);
CREATE INDEX idx_categorias_tipo ON public.categorias(tipo);

-- Create lancamentos table
CREATE TABLE public.lancamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_vencimento DATE NOT NULL,
    cliente_credor TEXT NOT NULL,
    valor NUMERIC(15,2) NOT NULL,
    valor_pago NUMERIC(15,2) DEFAULT 0,
    banco TEXT,
    status status_lancamento NOT NULL DEFAULT 'a_receber',
    tipo tipo_lancamento NOT NULL,
    categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
    recorrencia_id UUID,
    parcela_atual INTEGER DEFAULT 1,
    total_parcelas INTEGER DEFAULT 1,
    observacao TEXT,
    data_pagamento DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for lancamentos
CREATE INDEX idx_lancamentos_data_vencimento ON public.lancamentos(data_vencimento);
CREATE INDEX idx_lancamentos_tipo ON public.lancamentos(tipo);
CREATE INDEX idx_lancamentos_status ON public.lancamentos(status);
CREATE INDEX idx_lancamentos_recorrencia_id ON public.lancamentos(recorrencia_id);

-- Create chat_messages table for AI insights
CREATE TABLE public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for chat messages cleanup
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at);

-- Enable RLS on all tables
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Create public access policies (for now, no auth required)
CREATE POLICY "Allow all operations on categorias" ON public.categorias FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on lancamentos" ON public.lancamentos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on chat_messages" ON public.chat_messages FOR ALL USING (true) WITH CHECK (true);

-- Create view for Power BI export (flat file with denormalized category names)
CREATE VIEW public.lancamentos_bi AS
SELECT 
    l.id,
    l.data_vencimento,
    l.cliente_credor,
    l.valor::FLOAT as valor,
    l.valor_pago::FLOAT as valor_pago,
    l.banco,
    l.status::TEXT as status,
    l.tipo::TEXT as tipo,
    c.nome as categoria,
    cp.nome as categoria_pai,
    l.parcela_atual,
    l.total_parcelas,
    l.observacao,
    l.data_pagamento,
    l.created_at
FROM public.lancamentos l
LEFT JOIN public.categorias c ON l.categoria_id = c.id
LEFT JOIN public.categorias cp ON c.categoria_pai_id = cp.id;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_categorias_updated_at
    BEFORE UPDATE ON public.categorias
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lancamentos_updated_at
    BEFORE UPDATE ON public.lancamentos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default categories
INSERT INTO public.categorias (nome, nome_normalizado, tipo) VALUES
    ('Vendas', 'vendas', 'receita'),
    ('Serviços', 'servicos', 'receita'),
    ('Investimentos', 'investimentos', 'receita'),
    ('Outros Rendimentos', 'outros rendimentos', 'receita'),
    ('Alimentação', 'alimentacao', 'despesa'),
    ('Transporte', 'transporte', 'despesa'),
    ('Moradia', 'moradia', 'despesa'),
    ('Saúde', 'saude', 'despesa'),
    ('Educação', 'educacao', 'despesa'),
    ('Lazer', 'lazer', 'despesa'),
    ('Utilities', 'utilities', 'despesa'),
    ('Salários', 'salarios', 'despesa'),
    ('Impostos', 'impostos', 'despesa'),
    ('Outros Gastos', 'outros gastos', 'despesa');