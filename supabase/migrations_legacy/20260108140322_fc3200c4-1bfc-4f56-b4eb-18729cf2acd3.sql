-- Add new status values to the enum
ALTER TYPE status_lancamento ADD VALUE IF NOT EXISTS 'atrasado';
ALTER TYPE status_lancamento ADD VALUE IF NOT EXISTS 'vencida';