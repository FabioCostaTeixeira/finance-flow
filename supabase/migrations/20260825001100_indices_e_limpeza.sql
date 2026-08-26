CREATE INDEX IF NOT EXISTS idx_lancamentos_tenant_tipo_status_venc ON public.lancamentos(tenant_id,tipo,status,data_vencimento);
CREATE INDEX IF NOT EXISTS idx_bancos_tenant ON public.bancos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_categorias_tenant ON public.categorias(tenant_id);
DROP TABLE IF EXISTS public.user_roles;
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
