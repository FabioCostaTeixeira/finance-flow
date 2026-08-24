-- Adicionar coluna para vincular os dois lados de uma transferência
ALTER TABLE public.lancamentos 
ADD COLUMN IF NOT EXISTS transferencia_vinculo_id uuid;

-- Comentário explicativo
COMMENT ON COLUMN public.lancamentos.transferencia_vinculo_id IS 'UUID compartilhado entre os dois lançamentos de uma transferência (origem e destino)';