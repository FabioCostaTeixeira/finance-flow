-- Adicionar o valor 'transferencia' ao enum status_lancamento
ALTER TYPE public.status_lancamento ADD VALUE IF NOT EXISTS 'transferencia';