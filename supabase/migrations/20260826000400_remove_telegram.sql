-- A integração com Telegram foi removida por completo: o único caminho de
-- acesso de IA a dados financeiros passa a ser exclusivamente o servidor MCP
-- externo (mcp/), autenticado por API key (api_keys/api_access_logs). Não há
-- mais nenhum canal alternativo (Telegram ou outro) de acesso de IA/mensageria.
--
-- Removidos nesta migration:
--   - supabase/functions/telegram-pair e telegram-poll (edge functions, pasta
--     inteira removida do código, sem contrapartida em SQL).
--   - src/pages/TelegramBot.tsx, src/hooks/useTelegram.ts,
--     src/components/TelegramInfoCard.tsx (frontend).
--
-- Tabelas removidas aqui:
--   - messaging_channels: pareamento/polling do Telegram
--     (telegram-pair, telegram-poll, useTelegram.ts). Confirmado por grep em
--     src/, supabase/functions/ e mcp/src/ que nada mais referencia essa
--     tabela — o MCP externo (mcp/) nunca a usou.
--   - telegram_bot_state: estado global (offset de polling) do bot,
--     usado exclusivamente pela edge function telegram-poll (deletada); sem
--     tenant_id, sem outro consumidor.
--   - telegram_messages: fila de mensagens recebidas do Telegram, também
--     usada exclusivamente por telegram-poll (upsert/leitura) e por uma
--     policy que a relacionava a messaging_channels. Sem outro consumidor.
--
-- Triggers exclusivos de messaging_channels que caem junto via CASCADE:
--   - trg_set_tenant_id_messaging_channels (BEFORE INSERT)
--   - trg_freeze_tenant_id_messaging_channels (BEFORE UPDATE)
--   - messaging_channels_updated_at (BEFORE UPDATE)
-- Nenhuma função (trigger function) era exclusiva destas tabelas — todas
-- (set_tenant_id_on_insert, freeze_tenant_id, update_updated_at_column) são
-- compartilhadas por outras tabelas e permanecem intactas. telegram_bot_state
-- e telegram_messages não tinham tenant_id nem triggers próprios, apenas
-- policies nativas do Postgres que caem com o DROP TABLE.

DROP TABLE IF EXISTS "public"."messaging_channels" CASCADE;
DROP TABLE IF EXISTS "public"."telegram_bot_state" CASCADE;
DROP TABLE IF EXISTS "public"."telegram_messages" CASCADE;
