import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Supabase client (configured via environment variables)
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
function todayBRT(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

function normalizeDateInput(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().toLowerCase();
  const today = todayBRT();
  const toDate = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const base = new Date(`${today}T12:00:00-03:00`);
  if (s === "hoje" || s === "hj") return today;
  if (s === "amanhã" || s === "amanha") return toDate(new Date(base.getTime() + 86400000));
  if (s === "ontem") return toDate(new Date(base.getTime() - 86400000));
  if (s === "anteontem") return toDate(new Date(base.getTime() - 2 * 86400000));
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim();
  const m = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------
const TOOLS: Tool[] = [
  {
    name: "listar_lancamentos",
    description:
      "Lista lançamentos financeiros com filtros opcionais. Use para buscar contas a pagar/receber, despesas, receitas ou qualquer transação.",
    inputSchema: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["receita", "despesa"], description: "Filtra por tipo" },
        status: {
          type: "string",
          description: "Status: a_receber | recebido | a_pagar | pago | parcial | atrasado | vencida | transferencia",
        },
        banco_nome: { type: "string", description: "Nome (ou parte) do banco" },
        categoria_nome: { type: "string", description: "Nome (ou parte) da categoria" },
        cliente_credor: { type: "string", description: "Nome (ou parte) do cliente ou credor" },
        data_inicio: { type: "string", description: "Data inicial YYYY-MM-DD" },
        data_fim: { type: "string", description: "Data final YYYY-MM-DD" },
        limite: { type: "number", description: "Máximo de resultados (default 20, max 100)" },
      },
    },
  },
  {
    name: "criar_lancamento",
    description: "Cria um novo lançamento financeiro (receita ou despesa).",
    inputSchema: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["receita", "despesa"] },
        cliente_credor: { type: "string", description: "Nome do cliente (receita) ou fornecedor (despesa)" },
        valor: { type: "number", description: "Valor em reais" },
        data_vencimento: { type: "string", description: "Data YYYY-MM-DD ou relativa (hoje/amanhã/ontem)" },
        banco_id: { type: "string", description: "UUID do banco (use listar_bancos para obter)" },
        categoria_id: { type: "string", description: "UUID da categoria (use listar_categorias para obter)" },
        observacao: { type: "string" },
      },
      required: ["tipo", "cliente_credor", "valor", "data_vencimento"],
    },
  },
  {
    name: "atualizar_lancamento",
    description: "Atualiza campos de um lançamento existente. Apenas os campos fornecidos são alterados.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "UUID do lançamento" },
        cliente_credor: { type: "string" },
        valor: { type: "number" },
        data_vencimento: { type: "string" },
        banco_id: { type: "string" },
        categoria_id: { type: "string" },
        observacao: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "excluir_lancamento",
    description: "Exclui permanentemente um lançamento. Esta ação não pode ser desfeita.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "UUID do lançamento" },
      },
      required: ["id"],
    },
  },
  {
    name: "baixar_lancamento",
    description: "Registra pagamento ou recebimento de um lançamento (total ou parcial).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "UUID do lançamento" },
        valor_pago: { type: "number", description: "Valor sendo pago/recebido agora" },
        data_pagamento: { type: "string", description: "Data do pagamento YYYY-MM-DD" },
      },
      required: ["id", "valor_pago", "data_pagamento"],
    },
  },
  {
    name: "transferir_entre_contas",
    description: "Transfere valor entre dois bancos. Cria saída na origem e entrada no destino.",
    inputSchema: {
      type: "object",
      properties: {
        banco_origem_id: { type: "string", description: "UUID do banco de origem" },
        banco_destino_id: { type: "string", description: "UUID do banco de destino" },
        valor: { type: "number" },
        data: { type: "string", description: "Data YYYY-MM-DD" },
      },
      required: ["banco_origem_id", "banco_destino_id", "valor", "data"],
    },
  },
  {
    name: "consultar_saldo",
    description: "Retorna saldo, entradas e saídas por banco. Aceita filtro por nome e período.",
    inputSchema: {
      type: "object",
      properties: {
        banco_nome: { type: "string", description: "Nome (ou parte) do banco" },
        data_inicio: { type: "string" },
        data_fim: { type: "string" },
      },
    },
  },
  {
    name: "executar_sql",
    description:
      "Executa uma query SELECT no banco de dados para análises complexas (agrupamentos, comparativos, médias). Apenas SELECT é permitido.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Query SQL começando com SELECT ou WITH. Tabelas disponíveis: lancamentos, bancos, categorias. Sem ponto-e-vírgula no final.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "listar_bancos",
    description: "Retorna todos os bancos cadastrados com seus IDs. Use para obter banco_id ao criar lançamentos.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "listar_categorias",
    description:
      "Retorna todas as categorias e subcategorias com seus IDs. Use para obter categoria_id ao criar lançamentos.",
    inputSchema: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["receita", "despesa"], description: "Filtra por tipo" },
      },
    },
  },
  {
    name: "consultar_lancamentos_bi",
    description:
      "Consulta a view desnormalizada lancamentos_bi (ideal para análises e BI). Retorna dados planos com categoria, categoria_pai e banco já resolvidos.",
    inputSchema: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["receita", "despesa"] },
        status: { type: "string" },
        data_inicio: { type: "string", description: "YYYY-MM-DD" },
        data_fim: { type: "string", description: "YYYY-MM-DD" },
        limite: { type: "number", description: "Máximo de registros (default 100)" },
      },
    },
  },
  {
    name: "relatorio_fluxo_caixa",
    description:
      "Relatório de fluxo de caixa mensal: receita e despesa projetada vs realizada, saldo do mês. Últimos N meses.",
    inputSchema: {
      type: "object",
      properties: {
        meses: { type: "number", description: "Quantidade de meses anteriores (default 12, max 24)" },
      },
    },
  },
  {
    name: "relatorio_por_categoria",
    description:
      "Análise de lançamentos agrupados por categoria: quantidade, valor total, valor pago, taxa de realização, ticket médio.",
    inputSchema: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["receita", "despesa"], description: "Filtra por tipo" },
        meses: { type: "number", description: "Quantidade de meses (default 12)" },
      },
    },
  },
  {
    name: "relatorio_inadimplencia",
    description:
      "Taxa de inadimplência por categoria: total de lançamentos, realizados, pendentes, atrasados, valor em atraso.",
    inputSchema: {
      type: "object",
      properties: {
        meses: { type: "number", description: "Quantidade de meses analisados (default 12)" },
      },
    },
  },
  {
    name: "relatorio_kpi",
    description:
      "KPIs do mês atual: receita projetada, despesa projetada, saldo projetado, pendências abertas.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "top_clientes_credores",
    description:
      "Top 20 clientes ou credores por valor total: quantidade, valor total, valor recebido/pago, taxa de realização, ticket médio.",
    inputSchema: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["receita", "despesa"], description: "Filtra por tipo (default: ambos)" },
        meses: { type: "number", description: "Quantidade de meses (default 12)" },
        limite: { type: "number", description: "Número de resultados (default 20)" },
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------
type ToolResult = { content: Array<{ type: "text"; text: string }> };

function textResult(obj: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] };
}

function errorResult(message: string): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify({ success: false, error: message }) }] };
}

async function handleListarLancamentos(args: Record<string, unknown>): Promise<ToolResult> {
  const bancos = args.banco_nome
    ? (await supabase.from("bancos").select("id, nome")).data ?? []
    : [];
  const categorias = args.categoria_nome
    ? (await supabase.from("categorias").select("id, nome")).data ?? []
    : [];

  let q = supabase
    .from("lancamentos")
    .select("id, tipo, cliente_credor, valor, valor_pago, data_vencimento, data_pagamento, status, observacao, bancos(nome), categorias(nome)")
    .order("data_vencimento", { ascending: false })
    .limit(Math.min(Number(args.limite) || 20, 100));

  if (args.tipo) q = q.eq("tipo", args.tipo as string);
  if (args.status) q = q.eq("status", args.status as string);
  if (args.cliente_credor) q = q.ilike("cliente_credor", `%${args.cliente_credor}%`);
  if (args.data_inicio) q = q.gte("data_vencimento", args.data_inicio as string);
  if (args.data_fim) q = q.lte("data_vencimento", args.data_fim as string);
  if (args.banco_nome) {
    const banco = bancos.find((b) => b.nome.toLowerCase().includes((args.banco_nome as string).toLowerCase()));
    if (banco) q = q.eq("banco_id", banco.id);
  }
  if (args.categoria_nome) {
    const cat = categorias.find((c) => c.nome.toLowerCase().includes((args.categoria_nome as string).toLowerCase()));
    if (cat) q = q.eq("categoria_id", cat.id);
  }

  const { data, error } = await q;
  if (error) return errorResult(error.message);

  const totalValor = (data ?? []).reduce((acc, l) => acc + Number(l.valor ?? 0), 0);
  return textResult({ success: true, count: data?.length ?? 0, total_valor: totalValor, data });
}

async function handleCriarLancamento(args: Record<string, unknown>): Promise<ToolResult> {
  if (!args.tipo || !args.cliente_credor || !args.valor || !args.data_vencimento) {
    return errorResult("Campos obrigatórios: tipo, cliente_credor, valor, data_vencimento");
  }

  const safeDate = normalizeDateInput(args.data_vencimento);
  if (!safeDate) return errorResult("Data inválida. Use YYYY-MM-DD, DD/MM/YYYY ou hoje/amanhã/ontem.");

  const status = args.tipo === "receita" ? "a_receber" : "a_pagar";
  const { data, error } = await supabase
    .from("lancamentos")
    .insert({
      tipo: args.tipo,
      cliente_credor: args.cliente_credor,
      valor: args.valor,
      data_vencimento: safeDate,
      banco_id: args.banco_id ?? null,
      categoria_id: args.categoria_id ?? null,
      observacao: args.observacao ?? null,
      status,
      parcela_atual: 1,
      total_parcelas: 1,
    })
    .select()
    .single();

  if (error) return errorResult(error.message);
  return textResult({ success: true, message: `Lançamento criado com sucesso!`, data });
}

async function handleAtualizarLancamento(args: Record<string, unknown>): Promise<ToolResult> {
  if (!args.id) return errorResult("Campo obrigatório: id");

  const updateData: Record<string, unknown> = {};
  if (args.cliente_credor) updateData.cliente_credor = args.cliente_credor;
  if (args.valor !== undefined) updateData.valor = args.valor;
  if (args.data_vencimento) {
    const nd = normalizeDateInput(args.data_vencimento);
    if (nd) updateData.data_vencimento = nd;
  }
  if (args.banco_id) updateData.banco_id = args.banco_id;
  if (args.categoria_id) updateData.categoria_id = args.categoria_id;
  if (args.observacao !== undefined) updateData.observacao = args.observacao;

  if (Object.keys(updateData).length === 0) return errorResult("Nenhum campo para atualizar fornecido");

  const { data, error } = await supabase.from("lancamentos").update(updateData).eq("id", args.id as string).select().single();
  if (error) return errorResult(error.message);
  return textResult({ success: true, message: "Lançamento atualizado com sucesso!", data });
}

async function handleExcluirLancamento(args: Record<string, unknown>): Promise<ToolResult> {
  if (!args.id) return errorResult("Campo obrigatório: id");

  const { data: existente } = await supabase.from("lancamentos").select("*").eq("id", args.id as string).single();
  if (!existente) return errorResult("Lançamento não encontrado");

  const { error } = await supabase.from("lancamentos").delete().eq("id", args.id as string);
  if (error) return errorResult(error.message);
  return textResult({ success: true, message: `Lançamento de ${existente.cliente_credor} excluído.`, data: existente });
}

async function handleBaixarLancamento(args: Record<string, unknown>): Promise<ToolResult> {
  if (!args.id || args.valor_pago === undefined || !args.data_pagamento) {
    return errorResult("Campos obrigatórios: id, valor_pago, data_pagamento");
  }

  const { data: lancamento } = await supabase.from("lancamentos").select("*").eq("id", args.id as string).single();
  if (!lancamento) return errorResult("Lançamento não encontrado");

  const novoValorPago = (Number(lancamento.valor_pago) || 0) + Number(args.valor_pago);
  const novoStatus = novoValorPago >= Number(lancamento.valor)
    ? (lancamento.tipo === "receita" ? "recebido" : "pago")
    : "parcial";

  const safeDate = normalizeDateInput(args.data_pagamento) ?? todayBRT();
  const { data, error } = await supabase
    .from("lancamentos")
    .update({ valor_pago: novoValorPago, status: novoStatus, data_pagamento: safeDate })
    .eq("id", args.id as string)
    .select()
    .single();

  if (error) return errorResult(error.message);
  return textResult({ success: true, message: `Lançamento ${novoStatus}!`, data });
}

async function handleTransferirEntreContas(args: Record<string, unknown>): Promise<ToolResult> {
  if (!args.banco_origem_id || !args.banco_destino_id || !args.valor || !args.data) {
    return errorResult("Campos obrigatórios: banco_origem_id, banco_destino_id, valor, data");
  }
  if (args.banco_origem_id === args.banco_destino_id) return errorResult("Banco de origem e destino devem ser diferentes");

  const safeDate = normalizeDateInput(args.data) ?? todayBRT();
  const { data: orig } = await supabase.from("bancos").select("nome").eq("id", args.banco_origem_id as string).single();
  const { data: dest } = await supabase.from("bancos").select("nome").eq("id", args.banco_destino_id as string).single();
  if (!orig || !dest) return errorResult("Banco de origem ou destino não encontrado");

  const vinculoId = crypto.randomUUID();
  const base = { data_vencimento: safeDate, valor: args.valor, valor_pago: args.valor, status: "transferencia", data_pagamento: safeDate, parcela_atual: 1, total_parcelas: 1, transferencia_vinculo_id: vinculoId };

  const { error: e1 } = await supabase.from("lancamentos").insert({ ...base, tipo: "despesa", cliente_credor: `Transferência para ${dest.nome}`, banco_id: args.banco_origem_id });
  if (e1) return errorResult(`Erro ao criar saída: ${e1.message}`);

  const { error: e2 } = await supabase.from("lancamentos").insert({ ...base, tipo: "receita", cliente_credor: `Transferência de ${orig.nome}`, banco_id: args.banco_destino_id });
  if (e2) return errorResult(`Erro ao criar entrada: ${e2.message}`);

  return textResult({ success: true, message: `Transferência de R$ ${Number(args.valor).toFixed(2)} de ${orig.nome} para ${dest.nome} realizada.` });
}

async function handleConsultarSaldo(args: Record<string, unknown>): Promise<ToolResult> {
  const { data, error } = await supabase.rpc("get_bancos_com_saldos", {
    data_inicio: args.data_inicio ?? null,
    data_fim: args.data_fim ?? null,
  });
  if (error) return errorResult(error.message);

  let resultado = data ?? [];
  if (args.banco_nome) {
    const q = (args.banco_nome as string).toLowerCase();
    resultado = resultado.filter((b: Record<string, unknown>) => String(b.banco_nome ?? "").toLowerCase().includes(q));
  }
  return textResult({ success: true, count: resultado.length, data: resultado });
}

async function handleExecutarSQL(args: Record<string, unknown>): Promise<ToolResult> {
  if (!args.query || typeof args.query !== "string") return errorResult("Campo obrigatório: query");

  const lower = args.query.trim().toLowerCase();
  if (!lower.startsWith("select") && !lower.startsWith("with")) {
    return errorResult("Apenas queries SELECT são permitidas");
  }

  const { data, error } = await supabase.rpc("execute_readonly_query", { query_text: args.query });
  if (error) return errorResult(error.message);

  const rows = Array.isArray(data) ? data : [];
  return textResult({ success: true, count: rows.length, data: rows });
}

async function handleListarBancos(): Promise<ToolResult> {
  const { data, error } = await supabase.from("bancos").select("id, nome").order("nome");
  if (error) return errorResult(error.message);
  return textResult({ success: true, count: data?.length ?? 0, data });
}

async function handleListarCategorias(args: Record<string, unknown>): Promise<ToolResult> {
  let q = supabase.from("categorias").select("id, nome, tipo, categoria_pai_id").order("nome");
  if (args.tipo) q = q.eq("tipo", args.tipo as string);
  const { data, error } = await q;
  if (error) return errorResult(error.message);
  return textResult({ success: true, count: data?.length ?? 0, data });
}

async function handleConsultarLancamentosBi(args: Record<string, unknown>): Promise<ToolResult> {
  let q = supabase
    .from("lancamentos_bi")
    .select("*")
    .order("data_vencimento", { ascending: false })
    .limit(Math.min(Number(args.limite) || 100, 500));
  if (args.tipo) q = q.eq("tipo", args.tipo as string);
  if (args.status) q = q.eq("status", args.status as string);
  if (args.data_inicio) q = q.gte("data_vencimento", args.data_inicio as string);
  if (args.data_fim) q = q.lte("data_vencimento", args.data_fim as string);
  const { data, error } = await q;
  if (error) return errorResult(error.message);
  return textResult({ success: true, count: data?.length ?? 0, data });
}

async function handleRelatorioFluxoCaixa(args: Record<string, unknown>): Promise<ToolResult> {
  const meses = Math.min(Number(args.meses) || 12, 24);
  const { data, error } = await supabase.rpc("execute_readonly_query", {
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
      GROUP BY DATE_TRUNC('month', data_vencimento)
      ORDER BY mes DESC
    `,
  });
  if (error) return errorResult(error.message);
  return textResult({ success: true, periodo_meses: meses, count: (data as unknown[])?.length ?? 0, data });
}

async function handleRelatorioPorCategoria(args: Record<string, unknown>): Promise<ToolResult> {
  const meses = Math.min(Number(args.meses) || 12, 24);
  const tipoFilter = args.tipo ? `AND l.tipo = '${args.tipo}'` : "";
  const { data, error } = await supabase.rpc("execute_readonly_query", {
    query_text: `
      SELECT
        c.nome AS categoria,
        cp.nome AS categoria_pai,
        l.tipo,
        COUNT(*) AS quantidade,
        SUM(l.valor) AS valor_total,
        SUM(l.valor_pago) AS valor_pago,
        ROUND(100.0 * SUM(l.valor_pago) / NULLIF(SUM(l.valor), 0), 2) AS taxa_realizacao_pct,
        ROUND(AVG(l.valor), 2) AS ticket_medio
      FROM lancamentos l
      JOIN categorias c ON l.categoria_id = c.id
      LEFT JOIN categorias cp ON c.categoria_pai_id = cp.id
      WHERE l.data_vencimento >= CURRENT_DATE - INTERVAL '${meses} months'
      ${tipoFilter}
      GROUP BY c.id, c.nome, cp.nome, l.tipo
      ORDER BY valor_total DESC
    `,
  });
  if (error) return errorResult(error.message);
  return textResult({ success: true, periodo_meses: meses, count: (data as unknown[])?.length ?? 0, data });
}

async function handleRelatorioInadimplencia(args: Record<string, unknown>): Promise<ToolResult> {
  const meses = Math.min(Number(args.meses) || 12, 24);
  const { data, error } = await supabase.rpc("execute_readonly_query", {
    query_text: `
      SELECT
        c.nome AS categoria,
        l.tipo,
        COUNT(*) AS total_lancamentos,
        COUNT(CASE WHEN l.status IN ('recebido','pago') THEN 1 END) AS realizados,
        COUNT(CASE WHEN l.status IN ('a_receber','a_pagar') THEN 1 END) AS pendentes,
        COUNT(CASE WHEN l.status = 'atrasado' THEN 1 END) AS atrasados,
        ROUND(100.0 * COUNT(CASE WHEN l.status = 'atrasado' THEN 1 END) / NULLIF(COUNT(*), 0), 2) AS taxa_atraso_pct,
        SUM(CASE WHEN l.status = 'atrasado' THEN l.valor - l.valor_pago ELSE 0 END) AS valor_em_atraso
      FROM lancamentos l
      JOIN categorias c ON l.categoria_id = c.id
      WHERE l.data_vencimento >= CURRENT_DATE - INTERVAL '${meses} months'
      GROUP BY c.id, c.nome, l.tipo
      HAVING COUNT(CASE WHEN l.status = 'atrasado' THEN 1 END) > 0
      ORDER BY taxa_atraso_pct DESC
    `,
  });
  if (error) return errorResult(error.message);
  return textResult({ success: true, periodo_meses: meses, data });
}

async function handleRelatorioKpi(): Promise<ToolResult> {
  const { data, error } = await supabase.rpc("execute_readonly_query", {
    query_text: `
      SELECT 'Receita Projetada (Mês)' AS kpi,
             SUM(CASE WHEN tipo='receita' THEN valor ELSE 0 END)::TEXT AS valor, 'BRL' AS moeda
      FROM lancamentos
      WHERE EXTRACT(MONTH FROM data_vencimento) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM data_vencimento) = EXTRACT(YEAR FROM CURRENT_DATE)
      UNION ALL
      SELECT 'Despesa Projetada (Mês)',
             SUM(CASE WHEN tipo='despesa' THEN valor ELSE 0 END)::TEXT, 'BRL'
      FROM lancamentos
      WHERE EXTRACT(MONTH FROM data_vencimento) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM data_vencimento) = EXTRACT(YEAR FROM CURRENT_DATE)
      UNION ALL
      SELECT 'Saldo Projetado (Mês)',
             SUM(CASE WHEN tipo='receita' THEN valor ELSE -valor END)::TEXT, 'BRL'
      FROM lancamentos
      WHERE EXTRACT(MONTH FROM data_vencimento) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM data_vencimento) = EXTRACT(YEAR FROM CURRENT_DATE)
      UNION ALL
      SELECT 'Pendências Abertas', COUNT(*)::TEXT, 'UN'
      FROM lancamentos
      WHERE status IN ('a_receber', 'a_pagar', 'atrasado')
      UNION ALL
      SELECT 'Valor Total em Atraso',
             SUM(valor - COALESCE(valor_pago, 0))::TEXT, 'BRL'
      FROM lancamentos
      WHERE status = 'atrasado'
    `,
  });
  if (error) return errorResult(error.message);
  return textResult({ success: true, data });
}

async function handleTopClientesCredores(args: Record<string, unknown>): Promise<ToolResult> {
  const meses = Math.min(Number(args.meses) || 12, 24);
  const limite = Math.min(Number(args.limite) || 20, 50);
  const tipoFilter = args.tipo ? `AND tipo = '${args.tipo}'` : "";
  const { data, error } = await supabase.rpc("execute_readonly_query", {
    query_text: `
      SELECT
        cliente_credor,
        tipo,
        COUNT(*) AS quantidade,
        SUM(valor) AS valor_total,
        SUM(valor_pago) AS valor_realizado,
        ROUND(100.0 * SUM(valor_pago) / NULLIF(SUM(valor), 0), 2) AS taxa_realizacao_pct,
        ROUND(AVG(valor), 2) AS ticket_medio
      FROM lancamentos
      WHERE data_vencimento >= CURRENT_DATE - INTERVAL '${meses} months'
      ${tipoFilter}
      GROUP BY cliente_credor, tipo
      ORDER BY valor_total DESC
      LIMIT ${limite}
    `,
  });
  if (error) return errorResult(error.message);
  return textResult({ success: true, periodo_meses: meses, count: (data as unknown[])?.length ?? 0, data });
}

// ---------------------------------------------------------------------------
// MCP Server setup
// ---------------------------------------------------------------------------
const server = new Server(
  { name: "finance-flow", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const a = args as Record<string, unknown>;

  switch (name) {
    case "listar_lancamentos":      return handleListarLancamentos(a);
    case "criar_lancamento":        return handleCriarLancamento(a);
    case "atualizar_lancamento":    return handleAtualizarLancamento(a);
    case "excluir_lancamento":      return handleExcluirLancamento(a);
    case "baixar_lancamento":       return handleBaixarLancamento(a);
    case "transferir_entre_contas": return handleTransferirEntreContas(a);
    case "consultar_saldo":         return handleConsultarSaldo(a);
    case "executar_sql":            return handleExecutarSQL(a);
    case "listar_bancos":               return handleListarBancos();
    case "listar_categorias":           return handleListarCategorias(a);
    case "consultar_lancamentos_bi":    return handleConsultarLancamentosBi(a);
    case "relatorio_fluxo_caixa":       return handleRelatorioFluxoCaixa(a);
    case "relatorio_por_categoria":     return handleRelatorioPorCategoria(a);
    case "relatorio_inadimplencia":     return handleRelatorioInadimplencia(a);
    case "relatorio_kpi":               return handleRelatorioKpi();
    case "top_clientes_credores":       return handleTopClientesCredores(a);
    default:
      return errorResult(`Tool desconhecida: ${name}`);
  }
});

// ---------------------------------------------------------------------------
// Start server via stdio transport
// ---------------------------------------------------------------------------
const transport = new StdioServerTransport();
await server.connect(transport);
