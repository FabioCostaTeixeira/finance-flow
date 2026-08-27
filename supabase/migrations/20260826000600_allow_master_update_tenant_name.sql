-- Permite que usuários com role 'master' atualizem os dados (nome) do seu próprio tenant
CREATE POLICY tenants_update ON public.tenants FOR UPDATE TO authenticated
  USING (id IN (
    SELECT tenant_id FROM public.tenant_members
    WHERE user_id = auth.uid() AND role = 'master'
  ))
  WITH CHECK (id IN (
    SELECT tenant_id FROM public.tenant_members
    WHERE user_id = auth.uid() AND role = 'master'
  ));
