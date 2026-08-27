-- Permite que usuários com role master (ou o próprio dono do perfil) possam atualizar perfis em public.profiles
DROP POLICY IF EXISTS profiles_update ON public.profiles;

CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid() 
    OR EXISTS (
      SELECT 1
      FROM public.tenant_members target_member
      JOIN public.tenant_members actor_member
        ON actor_member.tenant_id = target_member.tenant_id
      WHERE target_member.user_id = profiles.user_id
        AND actor_member.user_id = auth.uid()
        AND actor_member.role = 'master'::public.app_role
    )
  )
  WITH CHECK (
    user_id = auth.uid() 
    OR EXISTS (
      SELECT 1
      FROM public.tenant_members target_member
      JOIN public.tenant_members actor_member
        ON actor_member.tenant_id = target_member.tenant_id
      WHERE target_member.user_id = profiles.user_id
        AND actor_member.user_id = auth.uid()
        AND actor_member.role = 'master'::public.app_role
    )
  );