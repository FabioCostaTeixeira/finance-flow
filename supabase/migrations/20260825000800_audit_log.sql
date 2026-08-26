CREATE TABLE public.audit_log (
  id bigserial PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid, tabela text NOT NULL, operacao text NOT NULL, registro_id uuid,
  antes jsonb, depois jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_tenant_data ON public.audit_log(tenant_id, created_at DESC);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_log_select ON public.audit_log FOR SELECT TO authenticated
  USING (public.can_access(tenant_id, 'usuarios'));
DROP TRIGGER IF EXISTS lancamentos_audit_trigger ON public.lancamentos;
DROP POLICY IF EXISTS authenticated_read ON public.lancamentos_audit;
DROP POLICY IF EXISTS service_role_full ON public.lancamentos_audit;
CREATE OR REPLACE FUNCTION public.audit_lancamentos() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.audit_log(tenant_id,user_id,tabela,operacao,registro_id,antes,depois)
  VALUES (COALESCE(NEW.tenant_id,OLD.tenant_id),auth.uid(),TG_TABLE_NAME,TG_OP,
    COALESCE(NEW.id,OLD.id),CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END);
  RETURN COALESCE(NEW,OLD);
END $$;
REVOKE EXECUTE ON FUNCTION public.audit_lancamentos() FROM anon, public;
CREATE TRIGGER lancamentos_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.audit_lancamentos();
CREATE TRIGGER bancos_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.bancos
  FOR EACH ROW EXECUTE FUNCTION public.audit_lancamentos();
