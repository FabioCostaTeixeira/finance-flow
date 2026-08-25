-- Motor de autorização. SECURITY DEFINER evita recursão infinita: a policy de
-- tenant_members não pode consultar tenant_members por um caminho que passe por
-- outra policy. STABLE permite ao planner reaproveitar o resultado na query.

CREATE OR REPLACE FUNCTION public.my_tenant_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.can_access(_tenant uuid, _module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
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

-- Guarda exclusivo do campo role. NÃO use esta função no lugar de can_access em
-- nenhuma outra policy: ela ignora user_permissions de propósito.
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_tenant uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.tenant_id = _tenant
      AND tm.role IN ('master','admin')
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_tenant_admin(uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.is_tenant_admin(uuid) TO authenticated;

-- Sem esta proteção, quem tem o módulo 'usuarios' promove a si mesmo a master.
CREATE POLICY tenant_members_manage ON public.tenant_members FOR ALL TO authenticated
  USING (public.can_access(tenant_id,'usuarios')
         AND (user_id <> auth.uid() OR public.is_tenant_admin(tenant_id)))
  WITH CHECK (public.can_access(tenant_id,'usuarios')
         AND (role = 'user' OR public.is_tenant_admin(tenant_id))
         AND (user_id <> auth.uid() OR public.is_tenant_admin(tenant_id)));

CREATE POLICY user_permissions_select ON public.user_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_access(tenant_id, 'usuarios'));

CREATE POLICY user_permissions_manage ON public.user_permissions FOR ALL TO authenticated
  USING (public.can_access(tenant_id, 'usuarios'))
  WITH CHECK (public.can_access(tenant_id, 'usuarios'));

-- Policies legadas da baseline. São PERMISSIVE, então se SOMAM por OR às novas
-- e as anulam: "Master can manage all permissions" é FOR ALL sem WITH CHECK,
-- então seu USING vira o check de escrita e libera user_permissions de QUALQUER
-- tenant para quem tiver linha master em user_roles. Ambas são subsumidas por
-- user_permissions_select e user_permissions_manage.
DROP POLICY IF EXISTS "Master can manage all permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can view own permissions"    ON public.user_permissions;
