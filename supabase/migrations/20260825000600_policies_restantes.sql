DROP POLICY IF EXISTS "Master can view api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Master can insert api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Master can update api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Master can delete api_keys" ON public.api_keys;
CREATE POLICY api_keys_all ON public.api_keys FOR ALL TO authenticated
  USING (public.can_access(tenant_id, 'api'))
  WITH CHECK (public.can_access(tenant_id, 'api'));

DROP POLICY IF EXISTS "Master can view ai settings" ON public.ai_settings;
DROP POLICY IF EXISTS "Master can update ai settings" ON public.ai_settings;
CREATE POLICY ai_settings_all ON public.ai_settings FOR ALL TO authenticated
  USING (public.can_access(tenant_id, 'ai-settings'))
  WITH CHECK (public.can_access(tenant_id, 'ai-settings'));

DROP POLICY IF EXISTS "Users view own channels" ON public.messaging_channels;
DROP POLICY IF EXISTS "Users insert own channels" ON public.messaging_channels;
DROP POLICY IF EXISTS "Users update own channels" ON public.messaging_channels;
DROP POLICY IF EXISTS "Users delete own channels" ON public.messaging_channels;
CREATE POLICY messaging_channels_all ON public.messaging_channels FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.my_tenant_ids()) AND user_id = auth.uid())
  WITH CHECK (tenant_id IN (SELECT public.my_tenant_ids()) AND user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Authenticated can view chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Authenticated can insert chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Authenticated can delete chat_messages" ON public.chat_messages;
CREATE POLICY chat_messages_all ON public.chat_messages FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.my_tenant_ids()) AND user_id = auth.uid())
  WITH CHECK (tenant_id IN (SELECT public.my_tenant_ids()) AND user_id = auth.uid());

DROP POLICY IF EXISTS "Master can view api_access_logs" ON public.api_access_logs;
CREATE POLICY api_access_logs_select ON public.api_access_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.api_keys k
    WHERE k.id = api_access_logs.api_key_id AND public.can_access(k.tenant_id, 'api')));

DROP POLICY IF EXISTS "Master views telegram messages" ON public.telegram_messages;
CREATE POLICY telegram_messages_select ON public.telegram_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messaging_channels c
    WHERE c.channel_user_id = telegram_messages.chat_id::text
      AND c.tenant_id IN (SELECT public.my_tenant_ids())));

COMMENT ON TABLE public.telegram_bot_state IS
  'Estado global do bot. Acesso exclusivo de service_role via edge function.';

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Only master can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Only master can delete profiles" ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.user_id = profiles.user_id AND tm.tenant_id IN (SELECT public.my_tenant_ids())));
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
