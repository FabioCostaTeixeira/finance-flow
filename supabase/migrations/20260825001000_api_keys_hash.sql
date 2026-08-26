CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
ALTER TABLE public.api_keys ADD COLUMN hash text;
ALTER TABLE public.api_keys ADD COLUMN prefixo text;
UPDATE public.api_keys SET hash=encode(extensions.digest(chave,'sha256'),'hex'), prefixo=left(chave,11) WHERE hash IS NULL;
ALTER TABLE public.api_keys ALTER COLUMN hash SET NOT NULL;
ALTER TABLE public.api_keys ALTER COLUMN prefixo SET NOT NULL;
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_hash_unico UNIQUE(hash);
ALTER TABLE public.api_keys DROP COLUMN chave;
CREATE INDEX idx_api_access_logs_janela ON public.api_access_logs(api_key_id,created_at DESC);
