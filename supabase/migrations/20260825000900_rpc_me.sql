CREATE OR REPLACE FUNCTION public.me() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
SELECT jsonb_build_object('user_id',auth.uid(),
 'nome',(SELECT p.nome FROM public.profiles p WHERE p.user_id=auth.uid()),
 'email',(SELECT p.email FROM public.profiles p WHERE p.user_id=auth.uid()),
 'tenants',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',t.id,'nome',t.nome,'slug',t.slug,'role',tm.role) ORDER BY t.nome)
   FROM public.tenant_members tm JOIN public.tenants t ON t.id=tm.tenant_id WHERE tm.user_id=auth.uid() AND t.ativo),'[]'::jsonb),
 'permissions',COALESCE((SELECT jsonb_agg(jsonb_build_object('tenant_id',up.tenant_id,'module_key',up.module_key,'allowed',up.allowed)) FROM public.user_permissions up WHERE up.user_id=auth.uid()),'[]'::jsonb))
$$;
REVOKE EXECUTE ON FUNCTION public.me() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.me() TO authenticated;
