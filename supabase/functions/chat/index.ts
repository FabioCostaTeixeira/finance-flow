import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { addDays } from "https://esm.sh/date-fns@3.6.0";
import { formatInTimeZone, fromZonedTime } from "https://esm.sh/date-fns-tz@3.0.0?deps=date-fns@3.6.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const throttle = (limit: number) => {
  let tokens = limit;
  let lastRefill = Date.now();
  return async () => {
    const now = Date.now();
    tokens += ((now - lastRefill) / 60000) * limit;
    if (tokens > limit) tokens = limit;
    lastRefill = now;
    if (tokens < 1) {
      await new Promise((r) => setTimeout(r, (60000 / limit) * (1 - tokens)));
      tokens = 0;
    } else {
      tokens -= 1;
    }
  };
};
const aiThrottle = throttle(30);

async function getAIConfig(supabase: any, fallbackKey: string | null) {
  try {
    const { data } = await supabase.from("ai_settings").select("*").eq("id", 1).single();
    if (!data || data.enabled === false) {
      if (!fallbackKey) throw new Error("AI is disabled and no fallback key configured");
      return { endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions", apiKey: fallbackKey, model: "google/gemini-3-flash-preview", systemOverride: null };
    }
    const provider = data.provider || "groq";
    const model = data.model || "llama-3.3-70b-versatile";
    const systemOverride = data.system_prompt_override || null;

    if (provider === "groq" && data.api_key) {
      return { endpoint: "https://api.groq.com/openai/v1/chat/completions", apiKey: data.api_key, model, systemOverride };
    }
    if (provider === "openai" && data.api_key) {
      return { endpoint: "https://api.openai.com/v1/chat/completions", apiKey: data.api_key, model, systemOverride };
    }
    if (provider === "google" && data.api_key) {
      return { endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", apiKey: data.api_key, model, systemOverride };
    }
    if (provider === "lovable" && fallbackKey) {
      return { endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions", apiKey: fallbackKey, model, systemOverride };
    }
    if (data.api_key) {
      return { endpoint: "https://api.groq.com/openai/v1/chat/completions", apiKey: data.api_key, model, systemOverride };
    }
    throw new Error(`API key not configured for provider: ${provider}`);
  } catch (e) {
    console.error("getAIConfig error:", e);
    throw e;
  }
}

async function executeToolCall(
  toolCall: any,
  supabase: any,
  data_base: string,
  normalizeDateInput: (raw: unknown) => string | null,
  lastUserMessage: string,
  bancos: any[],
  categorias: any[],
): Promise<{ tool_call_id: string; content: string }> {
  const tool_call_id = toolCall.id;
  const name = toolCall.function.name;

  const fail = (error: string) => ({
    tool_call_id,
    content: JSON.stringify({ success: false, error }),
  });

  const ok = (message: string, data?: any) => {
    let result = JSON.stringify({ success: true, ...(data !== undefined ? { data } : {}), message });
    // Truncate large results to stay within token limits
    if (result.length > 2000) {
      const truncated = JSON.stringify({ success: true, data: Array.isArray(data?.data) ? data.data.slice(0, 15) : data, message: message + " (resultados truncados)" });
      result = truncated.length > 2500 ? JSON.stringify({ success: true, message: message + " (dados muito grandes, resumo)" }) : truncated;
    }
    return { tool_call_id, content: result };
  };

  let args: any;
  try {
    args = JSON.parse(toolCall.function.arguments || "{}");
  } catch {
    return fail("Argumentos inválidos (JSON mal formado)");
  }

  try {
    if (name === "criar_lancamento") {
      if (!args.tipo || !args.cliente_credor || !args.valor || !args.data_vencimento) {
        return fail("Dados obrigatórios faltando. Necessário: tipo, cliente_credor, valor, data_vencimento");
      }

      const userAskedToday = /(^|\W)(hj|hoje)(\W|$)/i.test(lastUserMessage);
      const normalizedDate = normalizeDateInput(args.data_vencimento);
      const safeDataVencimento = userAskedToday ? data_base : normalizedDate;

      if (!safeDataVencimento) {
        return fail("Data inválida. Use YYYY-MM-DD, DD/MM/YYYY ou datas relativas (hoje/amanhã/ontem).");
      }

      const status = args.tipo === "receita" ? "a_receber" : "a_pagar";
      const { data: novo, error: insertError } = await supabase
        .from("lancamentos")
        .insert({
          tipo: args.tipo,
          cliente_credor: args.cliente_credor,
          valor: args.valor,
          data_vencimento: safeDataVencimento,
          banco_id: args.banco_id || null,
          categoria_id: args.categoria_id || null,
          observacao: args.observacao || null,
          status,
          parcela_atual: 1,
          total_parcelas: 1,
        })
        .select()
        .single();

      if (insertError) return fail(`Erro ao inserir: ${insertError.message}`);

      return ok(
        `${args.tipo === "receita" ? "Receita" : "Despesa"} de R$ ${Number(args.valor).toFixed(2)} criada com sucesso!`,
        { id: novo.id, tipo: novo.tipo, cliente_credor: novo.cliente_credor, valor: novo.valor, data_vencimento: novo.data_vencimento, status: novo.status },
      );
    }

    if (name === "atualizar_lancamento") {
      if (!args.id) return fail("ID do lançamento é obrigatório para atualização");

      const updateData: Record<string, unknown> = {};
      if (args.cliente_credor) updateData.cliente_credor = args.cliente_credor;
      if (args.valor) updateData.valor = args.valor;
      if (args.data_vencimento) {
        const nd = normalizeDateInput(args.data_vencimento);
        if (nd) updateData.data_vencimento = nd;
      }
      if (args.banco_id) updateData.banco_id = args.banco_id;
      if (args.categoria_id) updateData.categoria_id = args.categoria_id;
      if (args.observacao !== undefined) updateData.observacao = args.observacao;

      if (Object.keys(updateData).length === 0) return fail("Nenhum campo para atualizar foi fornecido");

      const { data: atualizado, error: updateError } = await supabase
        .from("lancamentos")
        .update(updateData)
        .eq("id", args.id)
        .select()
        .single();

      if (updateError) return fail(`Erro ao atualizar: ${updateError.message}`);
      return ok("Lançamento atualizado com sucesso!", atualizado);
    }

    if (name === "excluir_lancamento") {
      if (!args.id) return fail("ID do lançamento é obrigatório para exclusão");

      const { data: existente } = await supabase.from("lancamentos").select("*").eq("id", args.id).single();
      if (!existente) return fail("Lançamento não encontrado");

      const { error: deleteError } = await supabase.from("lancamentos").delete().eq("id", args.id);
      if (deleteError) return fail(`Erro ao excluir: ${deleteError.message}`);

      return ok(`Lançamento de ${existente.cliente_credor} - R$ ${Number(existente.valor).toFixed(2)} excluído com sucesso!`, existente);
    }

    if (name === "baixar_lancamento") {
      if (!args.id || args.valor_pago === undefined || !args.data_pagamento) {
        return fail("Dados obrigatórios faltando. Necessário: id, valor_pago, data_pagamento");
      }

      const { data: lancamento, error: fetchError } = await supabase.from("lancamentos").select("*").eq("id", args.id).single();
      if (fetchError || !lancamento) return fail("Lançamento não encontrado");

      const valorTotal = Number(lancamento.valor);
      const novoValorPago = (Number(lancamento.valor_pago) || 0) + args.valor_pago;
      const novoStatus = novoValorPago >= valorTotal
        ? (lancamento.tipo === "receita" ? "recebido" : "pago")
        : "parcial";

      const normalizedPaymentDate = normalizeDateInput(args.data_pagamento) || data_base;

      const { data: baixado, error: baixaError } = await supabase
        .from("lancamentos")
        .update({ valor_pago: novoValorPago, status: novoStatus, data_pagamento: normalizedPaymentDate })
        .eq("id", args.id)
        .select()
        .single();

      if (baixaError) return fail(`Erro ao baixar: ${baixaError.message}`);

      const statusLabel = lancamento.tipo === "receita"
        ? (novoStatus === "recebido" ? "recebido" : "parcialmente recebido")
        : (novoStatus === "pago" ? "pago" : "parcialmente pago");

      return ok(`Lançamento ${statusLabel}! Valor baixado: R$ ${Number(args.valor_pago).toFixed(2)}`, baixado);
    }

    if (name === "transferir_entre_contas") {
      if (!args.banco_origem_id || !args.banco_destino_id || !args.valor || !args.data) {
        return fail("Dados obrigatórios faltando. Necessário: banco_origem_id, banco_destino_id, valor, data");
      }
      if (args.banco_origem_id === args.banco_destino_id) {
        return fail("O banco de origem deve ser diferente do banco de destino");
      }

      const normalizedDate = normalizeDateInput(args.data) || data_base;

      const { data: bancoOrigem } = await supabase.from("bancos").select("nome").eq("id", args.banco_origem_id).single();
      const { data: bancoDestino } = await supabase.from("bancos").select("nome").eq("id", args.banco_destino_id).single();
      if (!bancoOrigem || !bancoDestino) return fail("Banco de origem ou destino não encontrado. Verifique os IDs.");

      const vinculoId = crypto.randomUUID();

      const { error: errorSaida } = await supabase.from("lancamentos").insert({
        data_vencimento: normalizedDate,
        cliente_credor: `Transferência para ${bancoDestino.nome}`,
        valor: args.valor,
        valor_pago: args.valor,
        banco_id: args.banco_origem_id,
        status: "transferencia",
        tipo: "despesa",
        data_pagamento: normalizedDate,
        parcela_atual: 1,
        total_parcelas: 1,
        transferencia_vinculo_id: vinculoId,
      });
      if (errorSaida) return fail(`Erro ao criar saída: ${errorSaida.message}`);

      const { error: errorEntrada } = await supabase.from("lancamentos").insert({
        data_vencimento: normalizedDate,
        cliente_credor: `Transferência de ${bancoOrigem.nome}`,
        valor: args.valor,
        valor_pago: args.valor,
        banco_id: args.banco_destino_id,
        status: "transferencia",
        tipo: "receita",
        data_pagamento: normalizedDate,
        parcela_atual: 1,
        total_parcelas: 1,
        transferencia_vinculo_id: vinculoId,
      });
      if (errorEntrada) return fail(`Erro ao criar entrada: ${errorEntrada.message}`);

      return ok(`Transferência de R$ ${Number(args.valor).toFixed(2)} realizada com sucesso de ${bancoOrigem.nome} para ${bancoDestino.nome}!`);
    }

    if (name === "consultar_saldo") {
      const { data: saldos, error: saldosErr } = await supabase.rpc("get_bancos_com_saldos", {
        data_inicio: args.data_inicio || null,
        data_fim: args.data_fim || null,
      });
      if (saldosErr) return fail(saldosErr.message);

      let resultado = saldos || [];
      if (args.banco_nome) {
        const q = String(args.banco_nome).toLowerCase();
        resultado = resultado.filter((b: any) => (b.banco_nome || "").toLowerCase().includes(q));
      }
      return ok(`Saldo consultado com sucesso.`, { count: resultado.length, data: resultado });
    }

    if (name === "listar_lancamentos") {
      let q = supabase
        .from("lancamentos")
        .select("id, tipo, cliente_credor, valor, valor_pago, data_vencimento, data_pagamento, status, observacao, bancos(nome), categorias(nome)")
        .order("data_vencimento", { ascending: false })
        .limit(Math.min(Number(args.limite) || 20, 50));

      if (args.tipo) q = q.eq("tipo", args.tipo);
      if (args.status) q = q.eq("status", args.status);
      if (args.cliente_credor) q = q.ilike("cliente_credor", `%${args.cliente_credor}%`);
      if (args.data_inicio) q = q.gte("data_vencimento", args.data_inicio);
      if (args.data_fim) q = q.lte("data_vencimento", args.data_fim);
      if (args.banco_nome) {
        const banco = bancos.find((b: any) => (b.nome || "").toLowerCase().includes(String(args.banco_nome).toLowerCase()));
        if (banco) q = q.eq("banco_id", banco.id);
      }
      if (args.categoria_nome) {
        const cat = categorias.find((c: any) => (c.nome || "").toLowerCase().includes(String(args.categoria_nome).toLowerCase()));
        if (cat) q = q.eq("categoria_id", cat.id);
      }

      const { data: rows, error: listErr } = await q;
      if (listErr) return fail(listErr.message);

      const totalValor = (rows || []).reduce((acc: number, l: any) => acc + Number(l.valor || 0), 0);
      const totalPago = (rows || []).reduce((acc: number, l: any) => acc + Number(l.valor_pago || 0), 0);
      // Return compact summary + limited rows
      const compactRows = (rows || []).slice(0, 15).map((r: any) => ({ id: r.id, cc: r.cliente_credor, v: r.valor, vp: r.valor_pago, dv: r.data_vencimento, s: r.status, b: r.bancos?.nome, c: r.categorias?.nome }));
      return ok(`${rows?.length || 0} lançamento(s). Total: R$${totalValor.toFixed(2)}, Pago: R$${totalPago.toFixed(2)}`, { count: rows?.length || 0, total_valor: totalValor, total_pago: totalPago, data: compactRows });
    }

    if (name === "executar_sql") {
      if (!args.query || typeof args.query !== "string") return fail("Parâmetro 'query' é obrigatório");

      const lower = args.query.trim().toLowerCase();
      if (!lower.startsWith("select") && !lower.startsWith("with")) {
        return fail("Apenas consultas SELECT são permitidas");
      }

      const { data: sqlResult, error: sqlErr } = await supabase.rpc("execute_readonly_query", { query_text: args.query });
      if (sqlErr) return fail(sqlErr.message);

      const rows = Array.isArray(sqlResult) ? sqlResult : [];
      // Limit rows for token budget
      return ok(`Query OK. ${rows.length} linha(s).`, { count: rows.length, data: rows.slice(0, 20) });
    }

    if (name === "atualizar_em_massa") {
      if (!args.cliente_credor && !args.categoria_nome && !args.banco_nome) {
        return fail("Necessário pelo menos um filtro: cliente_credor, categoria_nome ou banco_nome");
      }

      // Build filter query
      let q = supabase.from("lancamentos").select("id, cliente_credor, valor, data_vencimento");
      if (args.cliente_credor) q = q.ilike("cliente_credor", `%${args.cliente_credor}%`);
      if (args.data_a_partir) q = q.gte("data_vencimento", args.data_a_partir);
      if (args.data_ate) q = q.lte("data_vencimento", args.data_ate);
      if (args.tipo) q = q.eq("tipo", args.tipo);
      if (args.banco_nome) {
        const banco = bancos.find((b: any) => (b.nome || "").toLowerCase().includes(String(args.banco_nome).toLowerCase()));
        if (banco) q = q.eq("banco_id", banco.id);
      }
      if (args.categoria_nome) {
        const cat = categorias.find((c: any) => (c.nome || "").toLowerCase().includes(String(args.categoria_nome).toLowerCase()));
        if (cat) q = q.eq("categoria_id", cat.id);
      }

      const { data: found, error: findErr } = await q;
      if (findErr) return fail(findErr.message);
      if (!found || found.length === 0) return fail("Nenhum lançamento encontrado com esses filtros.");

      // Build update payload - only specified fields
      const updateData: Record<string, unknown> = {};
      if (args.novo_valor !== undefined) updateData.valor = args.novo_valor;
      if (args.nova_observacao !== undefined) updateData.observacao = args.nova_observacao;
      if (args.novo_banco_id) updateData.banco_id = args.novo_banco_id;
      if (args.nova_categoria_id) updateData.categoria_id = args.nova_categoria_id;

      if (Object.keys(updateData).length === 0) return fail("Nenhum campo para atualizar (use novo_valor, nova_observacao, etc.)");

      // Update all matched records
      const ids = found.map((r: any) => r.id);
      const { error: updateErr } = await supabase
        .from("lancamentos")
        .update(updateData)
        .in("id", ids);

      if (updateErr) return fail(`Erro ao atualizar: ${updateErr.message}`);

      return ok(`${ids.length} lançamento(s) atualizado(s) com sucesso!`, {
        count: ids.length,
        campos_atualizados: Object.keys(updateData),
        exemplo: { antes: found[0], novos_valores: updateData },
      });
    }

    return fail(`Tool desconhecida: ${name}`);
  } catch (e) {
    console.error(`executeToolCall [${name}] error:`, e);
    return fail(e instanceof Error ? e.message : "Erro desconhecido");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || null;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // Validate user JWT
    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const supabaseAuth = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const aiCfg = await getAIConfig(supabase, LOVABLE_API_KEY);

    // Lazy loading: only fetch lightweight reference data (bancos + categorias)
    const [bancosRes, categoriasRes] = await Promise.all([
      supabase.from("bancos").select("*"),
      supabase.from("categorias").select("*"),
    ]);
    const bancos = bancosRes.data || [];
    const categorias = categoriasRes.data || [];

    // Date setup
    const now = new Date();
    const TZ = "America/Sao_Paulo";
    const data_base = formatInTimeZone(now, TZ, "yyyy-MM-dd");
    const baseUtcMidnight = fromZonedTime(`${data_base}T00:00:00`, TZ);

    const resolveRelativeDate = (raw: string) => {
      const t = raw.trim().toLowerCase();
      if (t === "hoje" || t === "hj") return data_base;
      if (t === "amanha" || t === "amanhã") return formatInTimeZone(addDays(baseUtcMidnight, 1), TZ, "yyyy-MM-dd");
      if (t === "ontem") return formatInTimeZone(addDays(baseUtcMidnight, -1), TZ, "yyyy-MM-dd");
      if (t === "anteontem") return formatInTimeZone(addDays(baseUtcMidnight, -2), TZ, "yyyy-MM-dd");
      return null;
    };

    const normalizeDateInput = (raw: unknown): string | null => {
      if (typeof raw !== "string") return null;
      const s = raw.trim();
      const rel = resolveRelativeDate(s);
      if (rel) return rel;
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) return `${m[3]}-${m[2]}-${m[1]}`;
      return null;
    };

    const bancosList = bancos.map((b: any) => `${b.nome}:${b.id}`).join("|");
    const catsPai = categorias.filter((c: any) => !c.categoria_pai_id).map((c: any) => `${c.nome}(${c.tipo}):${c.id}`).join("|");

    const systemPrompt = `Assistente financeiro. data_base=${data_base}.
Ferramentas: criar_lancamento, atualizar_lancamento, excluir_lancamento, baixar_lancamento, transferir_entre_contas, consultar_saldo, listar_lancamentos, executar_sql, atualizar_em_massa.
Schema: lancamentos(id,tipo[receita|despesa],cliente_credor,valor,valor_pago,data_vencimento,data_pagamento,status[a_receber|recebido|pago|a_pagar|parcial|atrasado|vencida|transferencia],banco_id→bancos.id,categoria_id→categorias.id,observacao,recorrencia_id,parcela_atual,total_parcelas) | bancos(id,nome) | categorias(id,nome,tipo,categoria_pai_id)
Bancos: ${bancosList}
Categorias: ${catsPai}
Regras: Use data_base p/ datas relativas(hoje=${data_base}). Datas YYYY-MM-DD. executar_sql=apenas SELECT. Confirme antes de excluir. Responda em PT-BR.
Para edições em massa (recorrentes): use atualizar_em_massa com filtros. Altere SOMENTE o campo solicitado, sem modificar outros campos.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "criar_lancamento",
          description: "Cria um novo lançamento financeiro (receita ou despesa) no banco de dados.",
          parameters: {
            type: "object",
            properties: {
              tipo: { type: "string", enum: ["receita", "despesa"], description: "Tipo do lançamento" },
              cliente_credor: { type: "string", description: "Nome do cliente (receitas) ou fornecedor (despesas)" },
              valor: { type: "number", description: "Valor em reais" },
              data_vencimento: { type: "string", description: "Data no formato YYYY-MM-DD ou relativa (hoje/amanhã/ontem)" },
              banco_id: { type: "string", description: "ID do banco (UUID)" },
              categoria_id: { type: "string", description: "ID da categoria (UUID)" },
              observacao: { type: "string", description: "Observação opcional" },
            },
            required: ["tipo", "cliente_credor", "valor", "data_vencimento"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "atualizar_lancamento",
          description: "Atualiza um lançamento financeiro existente.",
          parameters: {
            type: "object",
            properties: {
              id: { type: "string", description: "ID do lançamento (UUID)" },
              cliente_credor: { type: "string" },
              valor: { type: "number" },
              data_vencimento: { type: "string" },
              banco_id: { type: "string" },
              categoria_id: { type: "string" },
              observacao: { type: "string" },
            },
            required: ["id"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "excluir_lancamento",
          description: "Exclui um lançamento financeiro. Ação irreversível.",
          parameters: {
            type: "object",
            properties: {
              id: { type: "string", description: "ID do lançamento (UUID)" },
            },
            required: ["id"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "baixar_lancamento",
          description: "Marca um lançamento como pago ou recebido, total ou parcialmente.",
          parameters: {
            type: "object",
            properties: {
              id: { type: "string", description: "ID do lançamento (UUID)" },
              valor_pago: { type: "number", description: "Valor sendo pago/recebido" },
              data_pagamento: { type: "string", description: "Data do pagamento (YYYY-MM-DD)" },
            },
            required: ["id", "valor_pago", "data_pagamento"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "transferir_entre_contas",
          description: "Transfere valor entre bancos. Cria saída na origem e entrada no destino.",
          parameters: {
            type: "object",
            properties: {
              banco_origem_id: { type: "string", description: "ID do banco de origem (UUID)" },
              banco_destino_id: { type: "string", description: "ID do banco de destino (UUID)" },
              valor: { type: "number", description: "Valor da transferência" },
              data: { type: "string", description: "Data da transferência (YYYY-MM-DD)" },
            },
            required: ["banco_origem_id", "banco_destino_id", "valor", "data"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "consultar_saldo",
          description: "Consulta saldo, entradas e saídas por banco. Use SEMPRE para perguntas sobre saldo.",
          parameters: {
            type: "object",
            properties: {
              banco_nome: { type: "string", description: "Nome (ou parte) do banco para filtrar" },
              data_inicio: { type: "string", description: "Data inicial YYYY-MM-DD (opcional)" },
              data_fim: { type: "string", description: "Data final YYYY-MM-DD (opcional)" },
            },
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "listar_lancamentos",
          description: "Lista lançamentos com filtros. Use para buscar/listar contas a pagar/receber, gastos, receitas.",
          parameters: {
            type: "object",
            properties: {
              tipo: { type: "string", enum: ["receita", "despesa"] },
              status: { type: "string", description: "a_receber|recebido|a_pagar|pago|parcial|atrasado|vencida|transferencia" },
              banco_nome: { type: "string" },
              categoria_nome: { type: "string" },
              cliente_credor: { type: "string" },
              data_inicio: { type: "string" },
              data_fim: { type: "string" },
              limite: { type: "number", description: "Máximo de resultados (default 20, max 50)" },
            },
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "executar_sql",
          description: "Executa SELECT SQL para análises complexas (agrupamentos, comparativos, médias). Apenas SELECT permitido.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Query SQL SELECT. Sem ponto-e-vírgula no final." },
            },
            required: ["query"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "atualizar_em_massa",
          description: "Atualiza múltiplos lançamentos de uma vez por filtro (ex: alterar valor de todos os lançamentos de um cliente a partir de uma data). Altera SOMENTE os campos especificados, preservando os demais.",
          parameters: {
            type: "object",
            properties: {
              cliente_credor: { type: "string", description: "Filtro por nome do cliente/credor (busca parcial)" },
              data_a_partir: { type: "string", description: "Filtro: data_vencimento >= YYYY-MM-DD" },
              data_ate: { type: "string", description: "Filtro: data_vencimento <= YYYY-MM-DD" },
              tipo: { type: "string", enum: ["receita", "despesa"] },
              banco_nome: { type: "string", description: "Filtro por nome do banco" },
              categoria_nome: { type: "string", description: "Filtro por nome da categoria" },
              novo_valor: { type: "number", description: "Novo valor para os lançamentos" },
              nova_observacao: { type: "string", description: "Nova observação" },
              novo_banco_id: { type: "string", description: "Novo banco (UUID)" },
              nova_categoria_id: { type: "string", description: "Novo categoria (UUID)" },
            },
            required: [],
            additionalProperties: false,
          },
        },
      },
    ];

    // Last user message used for date blindage in criar_lancamento
    const lastUserMessage = [...messages].reverse().find((m: any) => m?.role === "user")?.content as string || "";

    const callLLM = async (msgs: any[], withTools: boolean, stream: boolean) => {
      await aiThrottle();
      return fetch(aiCfg.endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${aiCfg.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: aiCfg.model,
          messages: msgs,
          ...(withTools ? { tools } : {}),
          stream,
          max_tokens: 800,
        }),
      });
    };

    const errorResponse = (status: number, message: string) =>
      new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const sysMsg = { role: "system", content: aiCfg.systemOverride || systemPrompt };

    // ── STEP 1: Single LLM call with tools (non-streaming) ──
    const step1Msgs: any[] = [sysMsg, ...messages];
    const resp = await callLLM(step1Msgs, true, false);

    if (!resp.ok) {
      if (resp.status === 429) {
        // Wait and retry ONCE for rate limit
        await new Promise(r => setTimeout(r, 3000));
        const retry = await callLLM(step1Msgs, true, false);
        if (!retry.ok) return errorResponse(429, "Limite de requisições excedido. Aguarde 1 minuto.");
        // Continue with retry response below
        const retryResp = await retry.json();
        const retryChoice = retryResp.choices?.[0];
        if (!retryChoice?.message?.tool_calls?.length) {
          // Simple response, stream it directly
          const stream2 = await callLLM(step1Msgs, false, true);
          return new Response(stream2.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
        }
      }
      const t = await resp.text();
      console.error("AI error:", resp.status, t);
      return errorResponse(500, "Erro no serviço de IA");
    }

    const aiResp = await resp.json();
    const choice = aiResp.choices?.[0];

    // ── No tool calls → Simple question, return plain answer ──
    if (!choice?.message?.tool_calls?.length) {
      const answer = choice.message.content || "";
      return new Response(JSON.stringify({ answer }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Tool calls detected → Execute tools ──
    const toolResults: any[] = [];
    for (const toolCall of choice.message.tool_calls) {
      const result = await executeToolCall(
        toolCall, supabase, data_base, normalizeDateInput, lastUserMessage, bancos, categorias,
      );
      toolResults.push(result);
    }

    // ── STEP 2: Stream final answer with tool results as context ──
    const step2Msgs: any[] = [
      sysMsg,
      ...messages,
      choice.message,
      ...toolResults.map(tr => ({ role: "tool", tool_call_id: tr.tool_call_id, content: tr.content })),
    ];

    const streamResp = await callLLM(step2Msgs, false, true);
    if (!streamResp.ok) {
      const t = await streamResp.text();
      console.error("Stream error:", streamResp.status, t);
      if (streamResp.status === 429) return errorResponse(429, "Limite de requisições. Aguarde 1 minuto.");
      return errorResponse(500, "Erro ao processar resposta: " + streamResp.status);
    }

    return new Response(streamResp.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
