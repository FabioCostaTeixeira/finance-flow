// Long-poll do bot Telegram. Cron chama a cada minuto; cada execução roda até ~55s
// fazendo getUpdates com timeout dinâmico, processa as mensagens via chat existente
// e responde no Telegram.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
const MAX_RUNTIME_MS = 55_000;
const MIN_REMAINING_MS = 5_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function tg(method: string, body: unknown) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY')!;
  const r = await fetch(`${GATEWAY_URL}/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': TELEGRAM_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Telegram ${method} failed: ${JSON.stringify(j)}`);
  return j;
}

async function sendMessage(chatId: number, text: string) {
  // Telegram limit: 4096 chars per message
  const MAX = 4000;
  for (let i = 0; i < text.length; i += MAX) {
    await tg('sendMessage', { chat_id: chatId, text: text.slice(i, i + MAX), parse_mode: 'HTML' });
  }
}

async function callChat(supabaseUrl: string, anonKey: string, messages: { role: string; content: string }[]): Promise<string> {
  const resp = await fetch(`${supabaseUrl}/functions/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    return `❌ Erro ao processar: ${err.slice(0, 300)}`;
  }

  // chat function returns SSE stream — drain it
  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      let line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (!line.startsWith('data: ')) continue;
      const json = line.slice(6).trim();
      if (json === '[DONE]') return full;
      try {
        const parsed = JSON.parse(json);
        const c = parsed.choices?.[0]?.delta?.content;
        if (c) full += c;
      } catch { /* ignore */ }
    }
  }
  return full || '✅ (sem resposta)';
}

async function processUpdate(
  supabase: any,
  supabaseUrl: string,
  anonKey: string,
  update: any
): Promise<{ chatId: number; response: string } | null> {
  const msg = update.message;
  if (!msg || !msg.text) return null;
  const chatId = msg.chat.id as number;
  const text = msg.text as string;

  // Comando /start
  if (text === '/start') {
    return {
      chatId,
      response: `👋 Olá! Para usar este bot, vincule sua conta:\n\n1. Acesse o sistema MarySysten Financeiro\n2. Vá em <b>Telegram Bot</b> no menu\n3. Gere um token de pareamento\n4. Envie aqui: <code>/vincular SEU_TOKEN</code>\n\nSeu chat ID: <code>${chatId}</code>`,
    };
  }

  // Comando /vincular TOKEN
  if (text.startsWith('/vincular ')) {
    const token = text.slice('/vincular '.length).trim();
    const { data: channel, error } = await supabase
      .from('messaging_channels')
      .select('*')
      .eq('pairing_token', token)
      .eq('channel_type', 'telegram')
      .maybeSingle();

    if (error || !channel) {
      return { chatId, response: '❌ Token inválido ou expirado. Gere um novo no sistema.' };
    }
    if (channel.pairing_expires_at && new Date(channel.pairing_expires_at) < new Date()) {
      return { chatId, response: '❌ Token expirado. Gere um novo no sistema.' };
    }

    const displayName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || msg.from?.username || `Chat ${chatId}`;
    await supabase
      .from('messaging_channels')
      .update({
        channel_user_id: String(chatId),
        display_name: displayName,
        status: 'active',
        pairing_token: null,
        pairing_expires_at: null,
      })
      .eq('id', channel.id);

    return { chatId, response: `✅ Conta vinculada com sucesso, ${displayName}! Agora você pode conversar comigo em linguagem natural para registrar lançamentos, consultar saldos e mais.` };
  }

  // Verifica se o chat está vinculado
  const { data: channel } = await supabase
    .from('messaging_channels')
    .select('*')
    .eq('channel_type', 'telegram')
    .eq('channel_user_id', String(chatId))
    .eq('status', 'active')
    .maybeSingle();

  if (!channel) {
    return {
      chatId,
      response: '🔒 Este chat não está vinculado a nenhum usuário. Use <code>/start</code> para instruções de pareamento.',
    };
  }

  // Comando /ajuda
  if (text === '/ajuda' || text === '/help') {
    return {
      chatId,
      response: `📚 <b>Comandos disponíveis:</b>\n\n• Conversa livre: <i>"Lança despesa de R$50 do mercado hoje"</i>\n• <code>/saldo</code> - Resumo financeiro\n• <code>/desvincular</code> - Remove o vínculo deste chat\n• <code>/ajuda</code> - Esta mensagem`,
    };
  }

  if (text === '/desvincular') {
    await supabase.from('messaging_channels').update({ status: 'revoked' }).eq('id', channel.id);
    return { chatId, response: '👋 Vínculo removido. Use /start para vincular novamente.' };
  }

  // Conversa livre — passa para o agente
  const aiText = await callChat(supabaseUrl, anonKey, [{ role: 'user', content: text }]);
  return { chatId, response: aiText };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let totalProcessed = 0;

  const { data: state, error: stateErr } = await supabase
    .from('telegram_bot_state')
    .select('update_offset')
    .eq('id', 1)
    .single();

  if (stateErr) {
    return new Response(JSON.stringify({ error: stateErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let currentOffset: number = state.update_offset;

  while (true) {
    const elapsed = Date.now() - startTime;
    const remainingMs = MAX_RUNTIME_MS - elapsed;
    if (remainingMs < MIN_REMAINING_MS) break;
    const timeout = Math.min(50, Math.floor(remainingMs / 1000) - 5);
    if (timeout < 1) break;

    let updates: any[] = [];
    try {
      const data = await tg('getUpdates', { offset: currentOffset, timeout, allowed_updates: ['message'] });
      updates = data.result ?? [];
    } catch (e) {
      console.error('getUpdates error:', e);
      break;
    }

    if (updates.length === 0) continue;

    // Persist raw updates first (idempotent)
    const rows = updates
      .filter((u: any) => u.message)
      .map((u: any) => ({
        update_id: u.update_id,
        chat_id: u.message.chat.id,
        text: u.message.text ?? null,
        raw_update: u,
        processed: false,
      }));

    if (rows.length > 0) {
      await supabase.from('telegram_messages').upsert(rows, { onConflict: 'update_id' });
    }

    // Process each update
    for (const u of updates) {
      try {
        const result = await processUpdate(supabase, supabaseUrl, anonKey, u);
        if (result) {
          await sendMessage(result.chatId, result.response);
          await supabase
            .from('telegram_messages')
            .update({ processed: true, processed_at: new Date().toISOString(), response_text: result.response })
            .eq('update_id', u.update_id);
        } else {
          await supabase
            .from('telegram_messages')
            .update({ processed: true, processed_at: new Date().toISOString() })
            .eq('update_id', u.update_id);
        }
        totalProcessed++;
      } catch (e) {
        console.error('Process update error:', e);
      }
    }

    const newOffset = Math.max(...updates.map((u: any) => u.update_id)) + 1;
    await supabase
      .from('telegram_bot_state')
      .update({ update_offset: newOffset, updated_at: new Date().toISOString() })
      .eq('id', 1);
    currentOffset = newOffset;
  }

  return new Response(JSON.stringify({ ok: true, processed: totalProcessed, finalOffset: currentOffset }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});