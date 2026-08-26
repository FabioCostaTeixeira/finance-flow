import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

// SQL arbitrário foi removido até existir um executor com parser/escopo de tenant
// dedicado. As ferramentas estruturadas continuam sendo a superfície suportada.
async function executeScopedQuery(_sb: unknown, _query: unknown): Promise<{ data: unknown; error: Error }> {
  return { data: null, error: new Error("Consultas SQL arbitrárias estão desativadas por segurança") };
}

const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, ...( typeof data === "object" && data !== null ? data : { data }) }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fail = (message: string, status = 400) =>
  new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function referenciasDoTenant(
  sb: ReturnType<typeof createClient>,
  tenantId: string,
  bancoId?: string | null,
  categoriaId?: string | null,
) {
  if (bancoId) {
    const { data } = await sb.from("bancos").select("id").eq("id", bancoId).eq("tenant_id", tenantId).maybeSingle();
    if (!data) return false;
  }
  for (const id of [categoriaId].filter(Boolean)) {
    const { data } = await sb.from("categorias").select("id").eq("id", id).eq("tenant_id", tenantId).maybeSingle();
    if (!data) return false;
  }
  return true;
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function todayBRT(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

function normalizeDate(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().toLowerCase();
  const today = todayBRT();
  const toDate = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const base = new Date(`${today}T12:00:00-03:00`);
  if (s === "hoje" || s === "hj") return today;
  if (s === "amanhã" || s === "amanha") return toDate(new Date(base.getTime() + 86400000));
  if (s === "ontem") return toDate(new Date(base.getTime() - 86400000));
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim();
  const m = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

// ── Schema descriptor (used by get_schema) ───────────────────────────────────
const SCHEMA = {
  tables: {
    lancamentos: {
      description: "Transações financeiras (receitas e despesas)",
      columns: {
        id: "uuid PK",
        tipo: "enum: receita | despesa",
        cliente_credor: "text — nome do cliente (receita) ou fornecedor (despesa)",
        valor: "numeric — valor total do lançamento",
        valor_pago: "numeric — valor já pago/recebido",
        data_vencimento: "date YYYY-MM-DD",
        data_pagamento: "date YYYY-MM-DD | null",
        status: "enum: a_receber | recebido | a_pagar | pago | parcial | atrasado | vencida | transferencia",
        banco_id: "uuid FK → bancos.id | null",
        categoria_id: "uuid FK → categorias.id | null",
        observacao: "text | null",
        parcela_atual: "integer",
        total_parcelas: "integer",
        recorrencia_id: "uuid | null",
        frequencia: "text | null",
        transferencia_vinculo_id: "uuid | null",
        created_at: "timestamptz",
      },
    },
    bancos: {
      description: "Contas bancárias",
      columns: {
        id: "uuid PK",
        nome: "text",
        created_at: "timestamptz",
      },
    },
    categorias: {
      description: "Categorias hierárquicas de lançamentos",
      columns: {
        id: "uuid PK",
        nome: "text",
        tipo: "enum: receita | despesa",
        categoria_pai_id: "uuid FK → categorias.id | null (null = categoria raiz)",
        created_at: "timestamptz",
      },
    },
  },
  views: {
    lancamentos_bi: "View desnormalizada com banco_nome e categoria_nome já resolvidos. Ideal para análises.",
  },
  tools: [
    "get_schema", "listar_lancamentos", "criar_lancamento", "atualizar_lancamento",
    "excluir_lancamento", "baixar_lancamento", "transferir_entre_contas",
    "consultar_saldo", "executar_sql", "listar_bancos", "listar_categorias",
    "relatorio_fluxo_caixa", "relatorio_por_categoria", "relatorio_kpi",
    "top_clientes_credores", "projetar_fluxo_caixa", "comparar_periodos",
  ],
  hints: {
    lancamentos_em_atraso: "SELECT * FROM lancamentos WHERE status = 'atrasado'",
    saldo_por_banco: "Use a tool consultar_saldo ou get_bancos_com_saldos RPC",
    parcelas_vencidas: "SELECT * FROM lancamentos WHERE status IN ('atrasado','vencida') AND data_vencimento < CURRENT_DATE",
  },
};

// ── Tool handlers ─────────────────────────────────────────────────────────────
async function toolListarLancamentos(args: Record<string, unknown>, sb: ReturnType<typeof createClient>) {
  const bancos = args.banco_nome ? ((await sb.from("bancos").select("id, nome")).data ?? []) : [];
  const cats   = args.categoria_nome ? ((await sb.from("categorias").select("id, nome")).data ?? []) : [];

  let q = sb
    .from("lancamentos")
    .select("id, tipo, cliente_credor, valor, valor_pago, data_vencimento, data_pagamento, status, observacao, bancos(nome), categorias(nome)")
    .order("data_vencimento", { ascending: false })
    .limit(Math.min(Number(args.limite) || 20, 100));

  if (args.tipo)           q = q.eq("tipo", args.tipo as string);
  if (args.status)         q = q.eq("status", args.status as string);
  if (args.cliente_credor) q = q.ilike("cliente_credor", `%${args.cliente_credor}%`);
  if (args.data_inicio)    q = q.gte("data_vencimento", args.data_inicio as string);
  if (args.data_fim)       q = q.lte("data_vencimento", args.data_fim as string);
  if (args.banco_nome) {
    const b = bancos.find((x: Record<string,string>) => x.nome.toLowerCase().includes((args.banco_nome as string).toLowerCase()));
    if (b) q = q.eq("banco_id", (b as Record<string,string>).id);
  }
  if (args.categoria_nome) {
    const c = cats.find((x: Record<string,string>) => x.nome.toLowerCase().includes((args.categoria_nome as string).toLowerCase()));
    if (c) q = q.eq("categoria_id", (c as Record<string,string>).id);
  }

  const { data, error } = await q;
  if (error) return fail(error.message);
  const total_valor = (data ?? []).reduce((s: number, l: Record<string,unknown>) => s + Number(l.valor ?? 0), 0);
  return ok({ count: data?.length ?? 0, total_valor, data });
}

async function toolCriarLancamento(args: Record<string, unknown>, sb: ReturnType<typeof createClient>, tenantId: string) {
  if (!args.tipo || !args.cliente_credor || !args.valor || !args.data_vencimento)
    return fail("Campos obrigatórios: tipo, cliente_credor, valor, data_vencimento");

  const safeDate = normalizeDate(args.data_vencimento);
  if (!safeDate) return fail("Data inválida. Use YYYY-MM-DD, DD/MM/YYYY ou hoje/amanhã/ontem.");

  if (!await referenciasDoTenant(sb, tenantId, args.banco_id as string | null, args.categoria_id as string | null))
    return fail("Banco ou categoria não pertence ao tenant da API key", 403);

  const status = args.tipo === "receita" ? "a_receber" : "a_pagar";
  const { data, error } = await sb
    .from("lancamentos")
    .insert({
      tipo: args.tipo, cliente_credor: args.cliente_credor,
      valor: args.valor, data_vencimento: safeDate,
      banco_id: args.banco_id ?? null, categoria_id: args.categoria_id ?? null,
      observacao: args.observacao ?? null, status, parcela_atual: 1, total_parcelas: 1,
    })
    .select().single();

  if (error) return fail(error.message);
  return ok({ message: "Lançamento criado com sucesso!", data });
}

async function toolAtualizarLancamento(args: Record<string, unknown>, sb: ReturnType<typeof createClient>, tenantId: string) {
  if (!args.id) return fail("Campo obrigatório: id");

  const patch: Record<string, unknown> = {};
  if (args.cliente_credor !== undefined) patch.cliente_credor = args.cliente_credor;
  if (args.valor !== undefined)          patch.valor = args.valor;
  if (args.data_vencimento) {
    const d = normalizeDate(args.data_vencimento);
    if (d) patch.data_vencimento = d;
  }
  if (args.banco_id !== undefined)       patch.banco_id = args.banco_id;
  if (args.categoria_id !== undefined)   patch.categoria_id = args.categoria_id;
  if (args.observacao !== undefined)     patch.observacao = args.observacao;
  if (args.status !== undefined)         patch.status = args.status;

  if (Object.keys(patch).length === 0) return fail("Nenhum campo para atualizar fornecido");

  if (!await referenciasDoTenant(sb, tenantId, args.banco_id as string | null, args.categoria_id as string | null))
    return fail("Banco ou categoria não pertence ao tenant da API key", 403);

  const { data, error } = await sb.from("lancamentos").update(patch).eq("id", args.id as string).select().single();
  if (error) return fail(error.message);
  return ok({ message: "Lançamento atualizado!", data });
}

async function toolExcluirLancamento(args: Record<string, unknown>, sb: ReturnType<typeof createClient>) {
  if (!args.id) return fail("Campo obrigatório: id");
  const { data: existente } = await sb.from("lancamentos").select("*").eq("id", args.id as string).single();
  if (!existente) return fail("Lançamento não encontrado");
  const { error } = await sb.from("lancamentos").delete().eq("id", args.id as string);
  if (error) return fail(error.message);
  return ok({ message: `Lançamento de ${existente.cliente_credor} excluído.`, data: existente });
}

async function toolBaixarLancamento(args: Record<string, unknown>, sb: ReturnType<typeof createClient>) {
  if (!args.id || args.valor_pago === undefined || !args.data_pagamento)
    return fail("Campos obrigatórios: id, valor_pago, data_pagamento");

  const { data: l } = await sb.from("lancamentos").select("*").eq("id", args.id as string).single();
  if (!l) return fail("Lançamento não encontrado");

  const novoValorPago = (Number(l.valor_pago) || 0) + Number(args.valor_pago);
  const novoStatus = novoValorPago >= Number(l.valor)
    ? (l.tipo === "receita" ? "recebido" : "pago")
    : "parcial";

  const safeDate = normalizeDate(args.data_pagamento) ?? todayBRT();
  const { data, error } = await sb
    .from("lancamentos")
    .update({ valor_pago: novoValorPago, status: novoStatus, data_pagamento: safeDate })
    .eq("id", args.id as string).select().single();

  if (error) return fail(error.message);
  return ok({ message: `Lançamento ${novoStatus}!`, data });
}

async function toolTransferirEntreContas(args: Record<string, unknown>, sb: ReturnType<typeof createClient>) {
  if (!args.banco_origem_id || !args.banco_destino_id || !args.valor || !args.data)
    return fail("Campos obrigatórios: banco_origem_id, banco_destino_id, valor, data");
  if (args.banco_origem_id === args.banco_destino_id)
    return fail("Banco de origem e destino devem ser diferentes");

  const safeDate = normalizeDate(args.data) ?? todayBRT();
  const { data: orig } = await sb.from("bancos").select("nome").eq("id", args.banco_origem_id as string).single();
  const { data: dest } = await sb.from("bancos").select("nome").eq("id", args.banco_destino_id as string).single();
  if (!orig || !dest) return fail("Banco de origem ou destino não encontrado");

  const vinculoId = crypto.randomUUID();
  const base = {
    data_vencimento: safeDate, valor: args.valor, valor_pago: args.valor,
    status: "transferencia", data_pagamento: safeDate,
    parcela_atual: 1, total_parcelas: 1, transferencia_vinculo_id: vinculoId,
  };

  const { error: e1 } = await sb.from("lancamentos").insert({
    ...base, tipo: "despesa",
    cliente_credor: `Transferência para ${dest.nome}`, banco_id: args.banco_origem_id,
  });
  if (e1) return fail(`Erro ao criar saída: ${e1.message}`);

  const { error: e2 } = await sb.from("lancamentos").insert({
    ...base, tipo: "receita",
    cliente_credor: `Transferência de ${orig.nome}`, banco_id: args.banco_destino_id,
  });
  if (e2) return fail(`Erro ao criar entrada: ${e2.message}`);

  return ok({ message: `Transferência de R$ ${Number(args.valor).toFixed(2)} de ${orig.nome} para ${dest.nome} realizada.` });
}

async function toolConsultarSaldo(args: Record<string, unknown>, sb: ReturnType<typeof createClient>) {
  // Calcula saldo do mês corrente: soma lançamentos pagos/recebidos com data_pagamento no mês atual.
  // Inclui "saldo Anterior" (que representa o carry-forward do mês anterior).
  const mesAtual = args.mes
    ? String(args.mes).slice(0, 7)          // aceita "2026-06" ou "2026-06-01"
    : new Date().toISOString().slice(0, 7);  // padrão: mês de hoje

  const query = `
    SELECT
      b.id   AS banco_id,
      b.nome AS banco_nome,
      COALESCE(SUM(CASE WHEN l.tipo = 'receita' THEN l.valor_pago ELSE 0 END), 0) AS total_entradas,
      COALESCE(SUM(CASE WHEN l.tipo = 'despesa' THEN l.valor_pago ELSE 0 END), 0) AS total_saidas,
      COALESCE(SUM(CASE WHEN l.tipo = 'receita' THEN l.valor_pago ELSE -l.valor_pago END), 0) AS saldo
    FROM bancos b
    LEFT JOIN lancamentos l
      ON l.banco_id = b.id
      AND l.status IN ('pago','recebido','transferencia')
      AND TO_CHAR(l.data_pagamento, 'YYYY-MM') = '${mesAtual}'
    GROUP BY b.id, b.nome
    ORDER BY b.nome
  `;

  const { data, error } = await executeScopedQuery(sb, query);
  if (error) return fail(error.message);

  let resultado = (data ?? []) as Record<string, unknown>[];
  if (args.banco_nome) {
    const q = (args.banco_nome as string).toLowerCase();
    resultado = resultado.filter((b) => String(b.banco_nome ?? "").toLowerCase().includes(q));
  }
  if (args.banco_id) {
    resultado = resultado.filter((b) => b.banco_id === args.banco_id);
  }
  return ok({ count: resultado.length, data: resultado, mes: mesAtual });
}

async function toolExecutarSQL(args: Record<string, unknown>, sb: ReturnType<typeof createClient>) {
  if (!args.query || typeof args.query !== "string")
    return fail("Campo obrigatório: query (string SELECT)");

  const lower = args.query.trim().toLowerCase();
  if (!lower.startsWith("select") && !lower.startsWith("with"))
    return fail("Apenas queries SELECT são permitidas por segurança");

  const { data, error } = await executeScopedQuery(sb, args.query);
  if (error) return fail(error.message);

  const rows = Array.isArray(data) ? data : [];
  return ok({ count: rows.length, data: rows });
}

async function toolListarBancos(sb: ReturnType<typeof createClient>) {
  const { data, error } = await sb.from("bancos").select("id, nome").order("nome");
  if (error) return fail(error.message);
  return ok({ count: data?.length ?? 0, data });
}

async function toolListarCategorias(args: Record<string, unknown>, sb: ReturnType<typeof createClient>) {
  let q = sb.from("categorias").select("id, nome, tipo, categoria_pai_id").order("nome");
  if (args.tipo) q = q.eq("tipo", args.tipo as string);
  const { data, error } = await q;
  if (error) return fail(error.message);
  return ok({ count: data?.length ?? 0, data });
}

async function toolRelatorioFluxoCaixa(args: Record<string, unknown>, sb: ReturnType<typeof createClient>) {
  const meses = Math.min(Number(args.meses) || 12, 24);
  const { data, error } = await executeScopedQuery(sb, {
    query_text: `
      SELECT
        DATE_TRUNC('month', data_vencimento)::DATE AS mes,
        SUM(CASE WHEN tipo='receita' THEN valor ELSE 0 END) AS receita_projetada,
        SUM(CASE WHEN tipo='despesa' THEN valor ELSE 0 END) AS despesa_projetada,
        SUM(CASE WHEN tipo='receita' THEN valor ELSE -valor END) AS saldo_projetado,
        SUM(CASE WHEN tipo='receita' AND status IN ('recebido','parcial') THEN valor_pago ELSE 0 END) AS receita_realizada,
        SUM(CASE WHEN tipo='despesa' AND status IN ('pago','parcial') THEN valor_pago ELSE 0 END) AS despesa_realizada
      FROM lancamentos
      WHERE data_vencimento >= CURRENT_DATE - INTERVAL '${meses} months'
        AND status != 'transferencia'
      GROUP BY DATE_TRUNC('month', data_vencimento)
      ORDER BY mes DESC
    `,
  });
  if (error) return fail(error.message);
  return ok({ periodo_meses: meses, count: (data as unknown[])?.length ?? 0, data });
}

async function toolRelatorioKpi(sb: ReturnType<typeof createClient>) {
  const { data, error } = await executeScopedQuery(sb, {
    query_text: `
      SELECT 'receita_projetada_mes' AS kpi, SUM(CASE WHEN tipo='receita' THEN valor ELSE 0 END) AS valor
      FROM lancamentos
      WHERE EXTRACT(MONTH FROM data_vencimento) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM data_vencimento) = EXTRACT(YEAR FROM CURRENT_DATE)
        AND status != 'transferencia'
      UNION ALL
      SELECT 'despesa_projetada_mes', SUM(CASE WHEN tipo='despesa' THEN valor ELSE 0 END)
      FROM lancamentos
      WHERE EXTRACT(MONTH FROM data_vencimento) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM data_vencimento) = EXTRACT(YEAR FROM CURRENT_DATE)
        AND status != 'transferencia'
      UNION ALL
      SELECT 'pendencias_abertas', COUNT(*)
      FROM lancamentos WHERE status IN ('a_receber','a_pagar','atrasado')
      UNION ALL
      SELECT 'valor_total_em_atraso', COALESCE(SUM(valor - COALESCE(valor_pago,0)), 0)
      FROM lancamentos WHERE status = 'atrasado'
    `,
  });
  if (error) return fail(error.message);
  return ok({ data });
}

async function toolTopClientesCredores(args: Record<string, unknown>, sb: ReturnType<typeof createClient>) {
  const meses = Math.min(Number(args.meses) || 12, 24);
  const limite = Math.min(Number(args.limite) || 20, 50);
  const tipoFilter = args.tipo ? `AND tipo = '${args.tipo}'` : "";
  const { data, error } = await executeScopedQuery(sb, {
    query_text: `
      SELECT cliente_credor, tipo, COUNT(*) AS quantidade,
        SUM(valor) AS valor_total, SUM(valor_pago) AS valor_realizado,
        ROUND(100.0 * SUM(valor_pago) / NULLIF(SUM(valor),0), 2) AS taxa_realizacao_pct,
        ROUND(AVG(valor), 2) AS ticket_medio
      FROM lancamentos
      WHERE data_vencimento >= CURRENT_DATE - INTERVAL '${meses} months'
        AND status != 'transferencia'
      ${tipoFilter}
      GROUP BY cliente_credor, tipo
      ORDER BY valor_total DESC
      LIMIT ${limite}
    `,
  });
  if (error) return fail(error.message);
  return ok({ periodo_meses: meses, count: (data as unknown[])?.length ?? 0, data });
}

async function toolProjetarFluxoCaixa(args: Record<string, unknown>, sb: ReturnType<typeof createClient>) {
  const mesesHist = Math.min(Number(args.meses_historico) || 3, 12);
  const mesesProj = Math.min(Number(args.meses_projecao) || 3, 6);

  const { data: hist, error } = await executeScopedQuery(sb, {
    query_text: `
      SELECT DATE_TRUNC('month', data_vencimento)::DATE AS mes,
        SUM(CASE WHEN tipo='receita' THEN valor ELSE 0 END) AS receita,
        SUM(CASE WHEN tipo='despesa' THEN valor ELSE 0 END) AS despesa
      FROM lancamentos
      WHERE data_vencimento >= CURRENT_DATE - INTERVAL '${mesesHist} months'
        AND data_vencimento < DATE_TRUNC('month', CURRENT_DATE)
        AND status != 'transferencia'
      GROUP BY DATE_TRUNC('month', data_vencimento) ORDER BY mes
    `,
  });
  if (error) return fail(error.message);

  const rows = (hist as Array<{ mes: string; receita: number; despesa: number }>) ?? [];
  if (rows.length === 0) return fail("Histórico insuficiente para projeção.");

  const mediaR = rows.reduce((s, r) => s + Number(r.receita), 0) / rows.length;
  const mediaD = rows.reduce((s, r) => s + Number(r.despesa), 0) / rows.length;

  const projecao = Array.from({ length: mesesProj }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + i + 1);
    const mes = d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
    return {
      mes,
      receita_projetada: Math.round(mediaR * 100) / 100,
      despesa_projetada: Math.round(mediaD * 100) / 100,
      saldo_projetado: Math.round((mediaR - mediaD) * 100) / 100,
    };
  });

  return ok({
    historico_meses: rows.length,
    media_mensal: { receita: Math.round(mediaR * 100) / 100, despesa: Math.round(mediaD * 100) / 100 },
    projecao,
  });
}

async function toolCompararPeriodos(args: Record<string, unknown>, sb: ReturnType<typeof createClient>) {
  if (!args.periodo_a_inicio || !args.periodo_a_fim || !args.periodo_b_inicio || !args.periodo_b_fim)
    return fail("Campos obrigatórios: periodo_a_inicio, periodo_a_fim, periodo_b_inicio, periodo_b_fim");

  const tipoFilter = args.tipo ? `AND tipo = '${args.tipo}'` : "";
  const { data, error } = await executeScopedQuery(sb, {
    query_text: `
      SELECT 'A' AS periodo,
        SUM(CASE WHEN tipo='receita' THEN valor ELSE 0 END) AS receita,
        SUM(CASE WHEN tipo='despesa' THEN valor ELSE 0 END) AS despesa,
        SUM(CASE WHEN tipo='receita' THEN valor ELSE -valor END) AS saldo,
        COUNT(*) AS lancamentos
      FROM lancamentos
      WHERE data_vencimento BETWEEN '${args.periodo_a_inicio}' AND '${args.periodo_a_fim}'
        AND status != 'transferencia' ${tipoFilter}
      UNION ALL
      SELECT 'B',
        SUM(CASE WHEN tipo='receita' THEN valor ELSE 0 END),
        SUM(CASE WHEN tipo='despesa' THEN valor ELSE 0 END),
        SUM(CASE WHEN tipo='receita' THEN valor ELSE -valor END),
        COUNT(*)
      FROM lancamentos
      WHERE data_vencimento BETWEEN '${args.periodo_b_inicio}' AND '${args.periodo_b_fim}'
        AND status != 'transferencia' ${tipoFilter}
    `,
  });
  if (error) return fail(error.message);

  const rows = data as Array<{ periodo: string; receita: number; despesa: number; saldo: number; lancamentos: number }>;
  const a = rows.find((r) => r.periodo === "A") ?? { receita: 0, despesa: 0, saldo: 0, lancamentos: 0 };
  const b = rows.find((r) => r.periodo === "B") ?? { receita: 0, despesa: 0, saldo: 0, lancamentos: 0 };
  const pct = (va: number, vb: number) => vb === 0 ? null : Math.round(((va - vb) / Math.abs(vb)) * 10000) / 100;

  return ok({
    periodo_a: { inicio: args.periodo_a_inicio, fim: args.periodo_a_fim, ...a },
    periodo_b: { inicio: args.periodo_b_inicio, fim: args.periodo_b_fim, ...b },
    variacao: {
      receita: { absoluta: Number(a.receita) - Number(b.receita), percentual_pct: pct(Number(a.receita), Number(b.receita)) },
      despesa: { absoluta: Number(a.despesa) - Number(b.despesa), percentual_pct: pct(Number(a.despesa), Number(b.despesa)) },
      saldo:   { absoluta: Number(a.saldo)   - Number(b.saldo),   percentual_pct: pct(Number(a.saldo),   Number(b.saldo)) },
    },
  });
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // ── API Key auth ──
  const apiKey = req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  if (!apiKey) return fail("x-api-key header obrigatório", 401);

  const sbAdmin = createClient(supabaseUrl, serviceKey);

  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(apiKey));
  const apiKeyHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const { data: keyRow } = await sbAdmin
    .from("api_keys")
    .select("id, ativa, tenant_id")
    .eq("hash", apiKeyHash)
    .maybeSingle();

  if (!keyRow) return fail("API Key inválida", 401);
  if (!keyRow.ativa) return fail("API Key desativada", 403);

  // Atualiza ultimo_acesso de forma assíncrona (não bloqueia)
  sbAdmin.from("api_keys").update({ ultimo_acesso: new Date().toISOString() }).eq("id", keyRow.id).then(() => {});

  // ── Parse body ──
  let body: { tool?: string; args?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return fail("Body deve ser JSON válido: { tool: string, args: object }");
  }

  const { tool, args = {} } = body;
  if (!tool) return fail("Campo obrigatório: tool");
  const tenantId = keyRow.tenant_id;
  if (!tenantId) return fail("API Key sem tenant associado", 403);
  // Nenhuma operação privilegiada sem escopo explícito. As ferramentas de
  // dados permanecem bloqueadas até serem migradas para RPCs tenant-scoped.
  if (tool !== "get_schema") return fail("Ferramenta temporariamente indisponível durante a migração de segurança", 503);

  // ── Log acesso ──
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const ua = req.headers.get("user-agent") ?? "";
  const logPromise = sbAdmin.from("api_access_logs").insert({
    api_key_id: keyRow.id,
    endpoint: tool,
    ip_address: ip,
    user_agent: ua,
    response_status: 200,
  });

  // ── Dispatch ──
  const sb = sbAdmin; // já usa service role — sem RLS
  let result: Response;

  switch (tool) {
    case "get_schema":
      result = ok({ schema: SCHEMA, today: todayBRT() });
      break;
    case "listar_lancamentos":
      result = await toolListarLancamentos(args, sb);
      break;
    case "criar_lancamento":
      result = await toolCriarLancamento(args, sb, tenantId);
      break;
    case "atualizar_lancamento":
      result = await toolAtualizarLancamento(args, sb, tenantId);
      break;
    case "excluir_lancamento":
      result = await toolExcluirLancamento(args, sb);
      break;
    case "baixar_lancamento":
      result = await toolBaixarLancamento(args, sb);
      break;
    case "transferir_entre_contas":
      result = await toolTransferirEntreContas(args, sb);
      break;
    case "consultar_saldo":
      result = await toolConsultarSaldo(args, sb);
      break;
    case "executar_sql":
      result = await toolExecutarSQL(args, sb);
      break;
    case "listar_bancos":
      result = await toolListarBancos(sb);
      break;
    case "listar_categorias":
      result = await toolListarCategorias(args, sb);
      break;
    case "relatorio_fluxo_caixa":
      result = await toolRelatorioFluxoCaixa(args, sb);
      break;
    case "relatorio_kpi":
      result = await toolRelatorioKpi(sb);
      break;
    case "top_clientes_credores":
      result = await toolTopClientesCredores(args, sb);
      break;
    case "projetar_fluxo_caixa":
      result = await toolProjetarFluxoCaixa(args, sb);
      break;
    case "comparar_periodos":
      result = await toolCompararPeriodos(args, sb);
      break;
    default:
      result = fail(`Tool desconhecida: "${tool}". Chame get_schema para ver as tools disponíveis.`);
  }

  await logPromise;
  return result;
});
