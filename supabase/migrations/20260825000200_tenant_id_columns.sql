-- Adiciona tenant_id às tabelas de dados, faz backfill com o tenant Principal
-- e trava a coluna como NOT NULL.

DO $$
DECLARE
  tenant_principal uuid;
BEGIN
  SELECT id INTO tenant_principal FROM public.tenants WHERE slug = 'principal';
  IF tenant_principal IS NULL THEN
    RAISE EXCEPTION 'Tenant Principal não encontrado. A migration 20260825000100 rodou?';
  END IF;

  -- Fase nullable + backfill, tabela por tabela.
  ALTER TABLE public.lancamentos        ADD COLUMN tenant_id uuid;
  ALTER TABLE public.bancos             ADD COLUMN tenant_id uuid;
  ALTER TABLE public.categorias         ADD COLUMN tenant_id uuid;
  ALTER TABLE public.api_keys           ADD COLUMN tenant_id uuid;
  ALTER TABLE public.ai_settings        ADD COLUMN tenant_id uuid;
  ALTER TABLE public.messaging_channels ADD COLUMN tenant_id uuid;
  ALTER TABLE public.chat_messages      ADD COLUMN tenant_id uuid;
  ALTER TABLE public.user_permissions   ADD COLUMN tenant_id uuid;

  UPDATE public.lancamentos        SET tenant_id = tenant_principal;
  UPDATE public.bancos             SET tenant_id = tenant_principal;
  UPDATE public.categorias         SET tenant_id = tenant_principal;
  UPDATE public.api_keys           SET tenant_id = tenant_principal;
  UPDATE public.ai_settings        SET tenant_id = tenant_principal;
  UPDATE public.messaging_channels SET tenant_id = tenant_principal;
  UPDATE public.chat_messages      SET tenant_id = tenant_principal;
  UPDATE public.user_permissions   SET tenant_id = tenant_principal;
END $$;

-- Trava: NOT NULL + FK. ON DELETE RESTRICT porque apagar um tenant com dados
-- financeiros deve ser um ato deliberado, nunca um efeito colateral.
ALTER TABLE public.lancamentos
  ALTER COLUMN tenant_id SET NOT NULL,
  ADD CONSTRAINT lancamentos_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE public.bancos
  ALTER COLUMN tenant_id SET NOT NULL,
  ADD CONSTRAINT bancos_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE public.categorias
  ALTER COLUMN tenant_id SET NOT NULL,
  ADD CONSTRAINT categorias_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE public.api_keys
  ALTER COLUMN tenant_id SET NOT NULL,
  ADD CONSTRAINT api_keys_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.messaging_channels
  ALTER COLUMN tenant_id SET NOT NULL,
  ADD CONSTRAINT messaging_channels_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.chat_messages
  ALTER COLUMN tenant_id SET NOT NULL,
  ADD CONSTRAINT chat_messages_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.user_permissions
  ALTER COLUMN tenant_id SET NOT NULL,
  ADD CONSTRAINT user_permissions_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- ai_settings deixa de ser linha única e passa a ter uma linha por tenant.
ALTER TABLE public.ai_settings DROP CONSTRAINT IF EXISTS ai_settings_id_check;
ALTER TABLE public.ai_settings
  ALTER COLUMN tenant_id SET NOT NULL,
  ADD CONSTRAINT ai_settings_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD CONSTRAINT ai_settings_tenant_unico UNIQUE (tenant_id);

-- Permissões passam a ser por tenant.
ALTER TABLE public.user_permissions
  DROP CONSTRAINT IF EXISTS user_permissions_user_id_module_key_key;
ALTER TABLE public.user_permissions
  ADD CONSTRAINT user_permissions_tenant_user_module_key
    UNIQUE (tenant_id, user_id, module_key);
