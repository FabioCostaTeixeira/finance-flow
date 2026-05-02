
-- API KEYS: master only
DROP POLICY IF EXISTS "Allow all operations on api_keys" ON public.api_keys;
CREATE POLICY "Master can view api_keys" ON public.api_keys FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'master'));
CREATE POLICY "Master can insert api_keys" ON public.api_keys FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'master'));
CREATE POLICY "Master can update api_keys" ON public.api_keys FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'master'));
CREATE POLICY "Master can delete api_keys" ON public.api_keys FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'master'));

-- API ACCESS LOGS: master only
DROP POLICY IF EXISTS "Allow all operations on api_access_logs" ON public.api_access_logs;
CREATE POLICY "Master can view api_access_logs" ON public.api_access_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'master'));

-- PROFILES: own profile only
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'master'));

-- CATEGORIAS: authenticated only
DROP POLICY IF EXISTS "Allow all operations on categorias" ON public.categorias;
CREATE POLICY "Authenticated can view categorias" ON public.categorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert categorias" ON public.categorias FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update categorias" ON public.categorias FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete categorias" ON public.categorias FOR DELETE TO authenticated USING (true);

-- BANCOS: authenticated only
DROP POLICY IF EXISTS "Allow all operations on bancos" ON public.bancos;
CREATE POLICY "Authenticated can view bancos" ON public.bancos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert bancos" ON public.bancos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update bancos" ON public.bancos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete bancos" ON public.bancos FOR DELETE TO authenticated USING (true);

-- LANCAMENTOS: authenticated only
DROP POLICY IF EXISTS "Allow all operations on lancamentos" ON public.lancamentos;
CREATE POLICY "Authenticated can view lancamentos" ON public.lancamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert lancamentos" ON public.lancamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update lancamentos" ON public.lancamentos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete lancamentos" ON public.lancamentos FOR DELETE TO authenticated USING (true);

-- CHAT MESSAGES: authenticated only
DROP POLICY IF EXISTS "Allow all operations on chat_messages" ON public.chat_messages;
CREATE POLICY "Authenticated can view chat_messages" ON public.chat_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert chat_messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can delete chat_messages" ON public.chat_messages FOR DELETE TO authenticated USING (true);

-- Recreate lancamentos_bi view as security_invoker to fix Security Definer View warning
DROP VIEW IF EXISTS public.lancamentos_bi;
CREATE VIEW public.lancamentos_bi WITH (security_invoker = true) AS
SELECT l.id,
   l.data_vencimento,
   l.cliente_credor,
   l.valor::double precision AS valor,
   l.valor_pago::double precision AS valor_pago,
   l.banco,
   l.status::text AS status,
   l.tipo::text AS tipo,
   c.nome AS categoria,
   cp.nome AS categoria_pai,
   l.parcela_atual,
   l.total_parcelas,
   l.observacao,
   l.data_pagamento,
   l.created_at
FROM public.lancamentos l
LEFT JOIN public.categorias c ON l.categoria_id = c.id
LEFT JOIN public.categorias cp ON c.categoria_pai_id = cp.id;
