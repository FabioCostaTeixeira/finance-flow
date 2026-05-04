// Roteador unificado para múltiplos provedores de IA (Lovable AI, OpenAI, Anthropic, Google).
// Lê config de public.ai_settings e encaminha o request mantendo formato OpenAI-compatible (com streaming SSE).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

interface AISettings {
  provider: 'lovable' | 'openai' | 'anthropic' | 'google' | 'groq';
  model: string;
  api_key: string | null;
  system_prompt_override: string | null;
  enabled: boolean;
}

async function loadSettings(): Promise<AISettings> {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, key);
  const { data, error } = await admin.from('ai_settings').select('*').eq('id', 1).single();
  if (error || !data) throw new Error('AI settings not found');
  return data as AISettings;
}

function pickKey(settings: AISettings): string {
  if (settings.provider === 'lovable') {
    const k = Deno.env.get('LOVABLE_API_KEY');
    if (!k) throw new Error('LOVABLE_API_KEY not configured. Switch to another provider in AI settings.');
    return k;
  }
  if (!settings.api_key) throw new Error(`API key missing for provider ${settings.provider}. Configure it in AI settings.`);
  return settings.api_key;
}

function endpointFor(provider: string): string {
  switch (provider) {
    case 'lovable':
      return 'https://ai.gateway.lovable.dev/v1/chat/completions';
    case 'openai':
      return 'https://api.openai.com/v1/chat/completions';
    case 'google':
      // Google's OpenAI-compatible endpoint
      return 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
    case 'anthropic':
      return 'https://api.anthropic.com/v1/messages';
    case 'groq':
      return 'https://api.groq.com/openai/v1/chat/completions';
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Calls Anthropic and converts the streamed events to OpenAI-style SSE chunks
 * so that the frontend parser can stay unchanged.
 */
async function streamAnthropic(messages: ChatMessage[], model: string, apiKey: string, system: string | null): Promise<Response> {
  const sysParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
  if (system) sysParts.unshift(system);
  const userMsgs = messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content }));

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      stream: true,
      system: sysParts.join('\n\n') || undefined,
      messages: userMsgs,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const txt = await upstream.text();
    return new Response(JSON.stringify({ error: `Anthropic error: ${txt}` }), {
      status: upstream.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (!data) continue;
            try {
              const evt = JSON.parse(data);
              if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
                const chunk = {
                  choices: [{ delta: { content: evt.delta.text } }],
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
              } else if (evt.type === 'message_stop') {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              }
            } catch { /* ignore */ }
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { messages, stream = true, tools, tool_choice } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'messages must be an array' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const settings = await loadSettings();
    if (!settings.enabled) {
      return new Response(JSON.stringify({ error: 'AI is disabled in settings' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = pickKey(settings);

    // Anthropic uses a different request schema — handle separately.
    if (settings.provider === 'anthropic') {
      return await streamAnthropic(messages, settings.model, apiKey, settings.system_prompt_override);
    }

    // Inject system prompt override if provided.
    let finalMessages = messages;
    if (settings.system_prompt_override) {
      finalMessages = [{ role: 'system', content: settings.system_prompt_override }, ...messages];
    }

    const body: Record<string, unknown> = {
      model: settings.model,
      messages: finalMessages,
      stream,
    };
    if (tools) body.tools = tools;
    if (tool_choice) body.tool_choice = tool_choice;

    const upstream = await fetch(endpointFor(settings.provider), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      const txt = await upstream.text();
      const status = upstream.status;
      let userMsg = 'Erro ao chamar a IA';
      if (status === 429) userMsg = 'Limite de requisições atingido. Aguarde alguns segundos e tente novamente.';
      else if (status === 402) userMsg = 'Créditos esgotados. Adicione fundos na sua conta do provedor de IA.';
      else if (status === 401) userMsg = 'Chave de API inválida. Verifique a configuração de IA.';
      console.error('Upstream error', status, txt);
      return new Response(JSON.stringify({ error: userMsg, detail: txt }), {
        status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!stream) {
      const data = await upstream.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(upstream.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('ai-router error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});