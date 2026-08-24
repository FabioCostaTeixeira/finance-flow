
-- Singleton AI settings table
CREATE TABLE public.ai_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  provider TEXT NOT NULL DEFAULT 'lovable',
  model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  api_key TEXT,
  system_prompt_override TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

INSERT INTO public.ai_settings (id, provider, model) VALUES (1, 'lovable', 'google/gemini-2.5-flash');

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master can view ai settings"
ON public.ai_settings FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'master'));

CREATE POLICY "Master can update ai settings"
ON public.ai_settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'master'));

-- Messaging channels (Telegram, future WhatsApp)
CREATE TABLE public.messaging_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('telegram', 'whatsapp')),
  channel_user_id TEXT,
  display_name TEXT,
  pairing_token TEXT,
  pairing_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel_type, channel_user_id)
);

CREATE INDEX idx_messaging_channels_user ON public.messaging_channels (user_id);
CREATE INDEX idx_messaging_channels_pairing ON public.messaging_channels (pairing_token) WHERE pairing_token IS NOT NULL;

ALTER TABLE public.messaging_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own channels"
ON public.messaging_channels FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'master'));

CREATE POLICY "Users insert own channels"
ON public.messaging_channels FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own channels"
ON public.messaging_channels FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'master'));

CREATE POLICY "Users delete own channels"
ON public.messaging_channels FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'master'));

-- Telegram bot polling state (singleton)
CREATE TABLE public.telegram_bot_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  update_offset BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.telegram_bot_state (id, update_offset) VALUES (1, 0);

ALTER TABLE public.telegram_bot_state ENABLE ROW LEVEL SECURITY;
-- No user policies: service role only

-- Telegram messages received (audit/debug)
CREATE TABLE public.telegram_messages (
  update_id BIGINT PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  text TEXT,
  raw_update JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  response_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_messages_chat ON public.telegram_messages (chat_id);
CREATE INDEX idx_telegram_messages_processed ON public.telegram_messages (processed) WHERE processed = false;

ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master views telegram messages"
ON public.telegram_messages FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'master'));

-- Trigger for updated_at on ai_settings
CREATE TRIGGER ai_settings_updated_at
BEFORE UPDATE ON public.ai_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER messaging_channels_updated_at
BEFORE UPDATE ON public.messaging_channels
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
