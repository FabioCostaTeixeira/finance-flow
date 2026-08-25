-- Motor de autorização. SECURITY DEFINER evita recursão infinita: a policy de
-- tenant_members não pode consultar tenant_members por um caminho que passe por
-- outra policy. STABLE permite ao planner reaproveitar o resultado na query.

CREATE OR REPLACE FUNCTION public.my_tenant_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.can_access(_tenant uuid, _module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.tenant_id = _tenant
      AND (
        tm.role IN ('master', 'admin')
        OR EXISTS (
          SELECT 1
          FROM public.user_permissions up
          WHERE up.user_id = auth.uid()
            AND up.tenant_id = _tenant
            AND up.module_key = _module
            AND up.allowed
        )
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.my_tenant_ids() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_access(uuid, text) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.my_tenant_ids() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.can_access(uuid, text) TO authenticated;

-- Policies das próprias tabelas núcleo.
CREATE POLICY tenants_select ON public.tenants FOR SELECT TO authenticated
  USING (id IN (SELECT public.my_tenant_ids()));

CREATE POLICY tenant_members_select ON public.tenant_members FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.my_tenant_ids()));

CREATE POLICY tenant_members_manage ON public.tenant_members FOR ALL TO authenticated
  USING (public.can_access(tenant_id, 'usuarios'))
  WITH CHECK (public.can_access(tenant_id, 'usuarios'));

CREATE POLICY user_permissions_select ON public.user_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_access(tenant_id, 'usuarios'));

CREATE POLICY user_permissions_manage ON public.user_permissions FOR ALL TO authenticated
  USING (public.can_access(tenant_id, 'usuarios'))
  WITH CHECK (public.can_access(tenant_id, 'usuarios'));
