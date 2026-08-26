-- A IA embutida no app foi descontinuada: a página de chat (Insights), a
-- edge function `chat`, o agente com ferramentas (edge function `agent`) e o
-- roteador de providers (edge function `ai-router`) foram removidos do
-- frontend/backend. O único caminho de acesso de IA a dados financeiros
-- passa a ser o servidor MCP externo (mcp/), que não depende de nenhuma
-- destas tabelas.
--
-- Tabelas removidas aqui:
--   - chat_messages: histórico do chat de IA descontinuado.
--   - ai_settings: configuração de provider/model/API key da IA descontinuada.
--
-- `set_chat_message_user_id` era um trigger SECURITY DEFINER usado
-- exclusivamente por chat_messages (preenchia user_id a partir de auth.uid()
-- no insert) — não é referenciado por nenhuma outra tabela, então cai junto.
--
-- `messaging_channels` NÃO é removida: é usada pelo pareamento/polling do
-- Telegram (telegram-pair, telegram-poll, useTelegram.ts), integração
-- independente da IA interna.
-- `agent_memory` também NÃO é removida: é usada pelo servidor MCP externo
-- (mcp/src/agents/memory.ts), que continua em produção.

DROP TABLE IF EXISTS "public"."chat_messages" CASCADE;
DROP TABLE IF EXISTS "public"."ai_settings" CASCADE;

DROP FUNCTION IF EXISTS "public"."set_chat_message_user_id"() CASCADE;
