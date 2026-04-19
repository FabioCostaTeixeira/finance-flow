import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ============ Helpers ============
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}
function toISODate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().split("T")[0];
}
function normalizar(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}
function calcularRecorrencia(dataInicio: Date, frequencia: string, qtd: number) {
  const parcelas: { data_vencimento: Date; parcela_atual: number; total_parcelas: number }[] = [];
  let dataAtual = new Date(dataInicio);
  for (let i = 1; i <= qtd; i++) {
    parcelas.push({ data_vencimento: new Date(dataAtual), parcela_atual: i, total_parcelas: qtd });
    switch (frequencia) {
      case "semanal": dataAtual = addDays(dataAtual, 7); break;
      case "mensal": dataAtual = addMonths(dataAtual, 1); break;
      case "trimestral": dataAtual = addMonths(dataAtual, 3); break;
      case "semestral": dataAtual = addMonths(dataAtual, 6); break;
    }
  }
  return parcelas;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ============ Auth via API key ============
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return json({ error: "API key is required. Add X-API-Key header." }, 401);
    }

    const { data: keyData, error: keyError } = await supabase
      .from("api_keys")
      .select("id, ativa")
      .eq("chave", apiKey)
      .single();

    if (keyError || !keyData) return json({ error: "Invalid API key" }, 401);
    if (!keyData.ativa) return json({ error: "API key is inactive" }, 403);

    // ============ Routing ============
    const url = new URL(req.url);
    // Remove "/api" prefix
    const fullPath = url.pathname.replace(/^\/+/, "");
    const parts = fullPath.split("/").filter(Boolean);
    // First segment is "api" (function name), drop it
    if (parts[0] === "api") parts.shift();

    const resource = parts[0] || "";
    const id = parts[1];
    const action = parts[2]; // for /lancamentos/:id/baixa etc.
    const method = req.method;

    const ipAddress = req.headers.get("x-forwarded-for") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    let responseStatus = 200;
    let responseData: unknown;

    const logAndReturn = async (data: unknown, status = 200) => {
      responseStatus = status;
      responseData = data;
    };

    let body: any = null;
    if (["POST", "PUT", "PATCH"].includes(method)) {
      try { body = await req.json(); } catch { body = {}; }
    }

    try {
      // ===================== LANCAMENTOS =====================
      if (resource === "lancamentos") {
        // Special action endpoints
        if (id && action === "baixa" && method === "POST") {
          // POST /lancamentos/:id/baixa  { valor_pago, data_pagamento }
          const valorPago = Number(body.valor_pago);
          const dataPagamento = body.data_pagamento || toISODate(new Date());
          if (!valorPago || valorPago <= 0) {
            await logAndReturn({ error: "valor_pago is required and must be > 0" }, 400);
          } else {
            const { data: lanc, error: fetchErr } = await supabase
              .from("lancamentos").select("*").eq("id", id).single();
            if (fetchErr || !lanc) {
              await logAndReturn({ error: "Lançamento not found" }, 404);
            } else {
              const valorTotal = Number(lanc.valor);
              const valorAtual = Number(lanc.valor_pago) || 0;
              const novoValorPago = valorAtual + valorPago;
              let novoStatus: string;
              if (novoValorPago >= valorTotal) {
                novoStatus = lanc.tipo === "receita" ? "recebido" : "pago";
              } else {
                novoStatus = "parcial";
              }
              const { data, error } = await supabase
                .from("lancamentos")
                .update({ valor_pago: novoValorPago, status: novoStatus, data_pagamento: dataPagamento })
                .eq("id", id).select().single();
              if (error) throw error;

              // Recorrência infinita: gerar próxima parcela
              if (lanc.total_parcelas === 0 && lanc.recorrencia_id &&
                  (novoStatus === "recebido" || novoStatus === "pago")) {
                const { data: ultima } = await supabase
                  .from("lancamentos").select("*")
                  .eq("recorrencia_id", lanc.recorrencia_id)
                  .order("data_vencimento", { ascending: false }).limit(1).single();
                if (ultima) {
                  const freq = ultima.frequencia || "mensal";
                  let novaData = new Date(ultima.data_vencimento);
                  switch (freq) {
                    case "semanal": novaData = addDays(novaData, 7); break;
                    case "mensal": novaData = addMonths(novaData, 1); break;
                    case "trimestral": novaData = addMonths(novaData, 3); break;
                    case "semestral": novaData = addMonths(novaData, 6); break;
                  }
                  await supabase.from("lancamentos").insert({
                    data_vencimento: toISODate(novaData),
                    cliente_credor: lanc.cliente_credor,
                    valor: lanc.valor,
                    banco_id: lanc.banco_id,
                    status: lanc.tipo === "receita" ? "a_receber" : "a_pagar",
                    tipo: lanc.tipo,
                    categoria_id: lanc.categoria_id,
                    observacao: lanc.observacao,
                    recorrencia_id: lanc.recorrencia_id,
                    parcela_atual: (ultima.parcela_atual || 0) + 1,
                    total_parcelas: 0,
                    frequencia: freq,
                  });
                }
              }
              await logAndReturn(data);
            }
          }
        } else if (id && method === "GET") {
          const { data, error } = await supabase
            .from("lancamentos")
            .select("*, categorias(id,nome,categoria_pai_id), bancos(id,nome)")
            .eq("id", id).single();
          if (error) await logAndReturn({ error: "Not found" }, 404);
          else await logAndReturn(data);
        } else if (id && (method === "PUT" || method === "PATCH")) {
          const { data, error } = await supabase
            .from("lancamentos").update(body).eq("id", id).select().single();
          if (error) throw error;
          await logAndReturn(data);
        } else if (id && method === "DELETE") {
          // ?recorrencia=true → deleta toda a série
          const deleteAll = url.searchParams.get("recorrencia") === "true";
          if (deleteAll) {
            const { data: lanc } = await supabase
              .from("lancamentos").select("recorrencia_id").eq("id", id).single();
            if (lanc?.recorrencia_id) {
              const { error } = await supabase
                .from("lancamentos").delete().eq("recorrencia_id", lanc.recorrencia_id);
              if (error) throw error;
              await logAndReturn({ success: true, deleted: "series" });
            } else {
              const { error } = await supabase.from("lancamentos").delete().eq("id", id);
              if (error) throw error;
              await logAndReturn({ success: true, deleted: "single" });
            }
          } else {
            const { error } = await supabase.from("lancamentos").delete().eq("id", id);
            if (error) throw error;
            await logAndReturn({ success: true });
          }
        } else if (method === "POST") {
          // POST /lancamentos  → cria lançamento (suporta recorrência)
          const { recorrente, frequencia, qtd_parcelas, lancar_como_pago, data_pagamento, ...rest } = body;
          const tipo = rest.tipo;
          if (!tipo || !["receita", "despesa"].includes(tipo)) {
            await logAndReturn({ error: "tipo must be 'receita' or 'despesa'" }, 400);
          } else if (!rest.cliente_credor || !rest.valor || !rest.data_vencimento) {
            await logAndReturn({ error: "cliente_credor, valor and data_vencimento are required" }, 400);
          } else {
            const baseStatus = tipo === "receita" ? "a_receber" : "a_pagar";

            if (recorrente && frequencia) {
              const isInfinite = !qtd_parcelas || qtd_parcelas === 0;
              const qtd = isInfinite ? 12 : Number(qtd_parcelas);
              const recId = crypto.randomUUID();
              const parcelas = calcularRecorrencia(new Date(rest.data_vencimento), frequencia, qtd);
              const rows = parcelas.map((p) => ({
                data_vencimento: toISODate(p.data_vencimento),
                cliente_credor: rest.cliente_credor,
                valor: rest.valor,
                banco_id: rest.banco_id || null,
                status: baseStatus,
                tipo,
                categoria_id: rest.categoria_id || null,
                observacao: rest.observacao || null,
                recorrencia_id: recId,
                parcela_atual: p.parcela_atual,
                total_parcelas: isInfinite ? 0 : p.total_parcelas,
                frequencia,
              }));
              const { data, error } = await supabase.from("lancamentos").insert(rows).select();
              if (error) throw error;
              await logAndReturn({ recorrencia_id: recId, lancamentos: data }, 201);
            } else {
              const insertData: Record<string, unknown> = {
                data_vencimento: rest.data_vencimento,
                cliente_credor: rest.cliente_credor,
                valor: rest.valor,
                banco_id: rest.banco_id || null,
                tipo,
                categoria_id: rest.categoria_id || null,
                observacao: rest.observacao || null,
                parcela_atual: 1,
                total_parcelas: 1,
                status: baseStatus,
              };
              if (lancar_como_pago) {
                insertData.status = tipo === "receita" ? "recebido" : "pago";
                insertData.valor_pago = rest.valor;
                insertData.data_pagamento = data_pagamento || toISODate(new Date());
              }
              const { data, error } = await supabase
                .from("lancamentos").insert(insertData).select().single();
              if (error) throw error;
              await logAndReturn(data, 201);
            }
          }
        } else if (method === "GET") {
          // List with optional filters
          let query = supabase.from("lancamentos_bi").select("*");
          const tipo = url.searchParams.get("tipo");
          const status = url.searchParams.get("status");
          const dataInicio = url.searchParams.get("data_inicio");
          const dataFim = url.searchParams.get("data_fim");
          if (tipo) query = query.eq("tipo", tipo);
          if (status) query = query.eq("status", status);
          if (dataInicio) query = query.gte("data_vencimento", dataInicio);
          if (dataFim) query = query.lte("data_vencimento", dataFim);
          const { data, error } = await query.order("data_vencimento", { ascending: false });
          if (error) throw error;
          await logAndReturn(data);
        } else {
          await logAndReturn({ error: "Method not allowed" }, 405);
        }
      }

      // ===================== TRANSFERENCIAS =====================
      else if (resource === "transferencias") {
        if (method === "POST") {
          // { banco_origem_id, banco_destino_id, valor, data, descricao? }
          const { banco_origem_id, banco_destino_id, valor, data, descricao } = body;
          if (!banco_origem_id || !banco_destino_id || !valor || !data) {
            await logAndReturn({ error: "banco_origem_id, banco_destino_id, valor and data are required" }, 400);
          } else if (banco_origem_id === banco_destino_id) {
            await logAndReturn({ error: "Origin and destination banks must differ" }, 400);
          } else {
            const vinculoId = crypto.randomUUID();
            const desc = descricao || "Transferência entre contas";
            const rows = [
              {
                data_vencimento: data, cliente_credor: desc, valor,
                banco_id: banco_origem_id, tipo: "despesa", status: "transferencia",
                valor_pago: valor, data_pagamento: data,
                transferencia_vinculo_id: vinculoId,
                parcela_atual: 1, total_parcelas: 1,
              },
              {
                data_vencimento: data, cliente_credor: desc, valor,
                banco_id: banco_destino_id, tipo: "receita", status: "transferencia",
                valor_pago: valor, data_pagamento: data,
                transferencia_vinculo_id: vinculoId,
                parcela_atual: 1, total_parcelas: 1,
              },
            ];
            const { data: created, error } = await supabase
              .from("lancamentos").insert(rows).select();
            if (error) throw error;
            await logAndReturn({ transferencia_vinculo_id: vinculoId, lancamentos: created }, 201);
          }
        } else if (id && (method === "PUT" || method === "PATCH")) {
          // Update both linked rows
          const { valor, data, descricao } = body;
          const update: Record<string, unknown> = {};
          if (valor !== undefined) { update.valor = valor; update.valor_pago = valor; }
          if (data) { update.data_vencimento = data; update.data_pagamento = data; }
          if (descricao) update.cliente_credor = descricao;
          const { data: updated, error } = await supabase
            .from("lancamentos").update(update)
            .eq("transferencia_vinculo_id", id).select();
          if (error) throw error;
          await logAndReturn(updated);
        } else if (id && method === "DELETE") {
          const { error } = await supabase
            .from("lancamentos").delete().eq("transferencia_vinculo_id", id);
          if (error) throw error;
          await logAndReturn({ success: true });
        } else if (method === "GET") {
          const { data, error } = await supabase
            .from("lancamentos").select("*")
            .eq("status", "transferencia")
            .order("data_vencimento", { ascending: false });
          if (error) throw error;
          await logAndReturn(data);
        } else {
          await logAndReturn({ error: "Method not allowed" }, 405);
        }
      }

      // ===================== CATEGORIAS =====================
      else if (resource === "categorias") {
        if (id && method === "GET") {
          const { data, error } = await supabase
            .from("categorias").select("*").eq("id", id).single();
          if (error) await logAndReturn({ error: "Not found" }, 404);
          else await logAndReturn(data);
        } else if (id && (method === "PUT" || method === "PATCH")) {
          const update: Record<string, unknown> = { ...body };
          if (body.nome) update.nome_normalizado = normalizar(body.nome);
          const { data, error } = await supabase
            .from("categorias").update(update).eq("id", id).select().single();
          if (error) throw error;
          await logAndReturn(data);
        } else if (id && method === "DELETE") {
          const { error } = await supabase.from("categorias").delete().eq("id", id);
          if (error) throw error;
          await logAndReturn({ success: true });
        } else if (method === "POST") {
          const { nome, tipo, categoria_pai_id } = body;
          if (!nome || !tipo) {
            await logAndReturn({ error: "nome and tipo are required" }, 400);
          } else {
            const { data, error } = await supabase.from("categorias").insert({
              nome, tipo,
              nome_normalizado: normalizar(nome),
              categoria_pai_id: categoria_pai_id || null,
            }).select().single();
            if (error) throw error;
            await logAndReturn(data, 201);
          }
        } else if (method === "GET") {
          let q = supabase.from("categorias").select("*").order("nome");
          const tipo = url.searchParams.get("tipo");
          const apenasSubcategorias = url.searchParams.get("subcategorias") === "true";
          const apenasPais = url.searchParams.get("pais") === "true";
          if (tipo) q = q.eq("tipo", tipo);
          if (apenasSubcategorias) q = q.not("categoria_pai_id", "is", null);
          if (apenasPais) q = q.is("categoria_pai_id", null);
          const { data, error } = await q;
          if (error) throw error;
          await logAndReturn(data);
        } else {
          await logAndReturn({ error: "Method not allowed" }, 405);
        }
      }

      // ===================== BANCOS =====================
      else if (resource === "bancos") {
        if (id && method === "GET") {
          const { data, error } = await supabase
            .from("bancos").select("*").eq("id", id).single();
          if (error) await logAndReturn({ error: "Not found" }, 404);
          else await logAndReturn(data);
        } else if (id && (method === "PUT" || method === "PATCH")) {
          const { data, error } = await supabase
            .from("bancos").update(body).eq("id", id).select().single();
          if (error) throw error;
          await logAndReturn(data);
        } else if (id && method === "DELETE") {
          const { error } = await supabase.from("bancos").delete().eq("id", id);
          if (error) throw error;
          await logAndReturn({ success: true });
        } else if (method === "POST") {
          if (!body.nome) await logAndReturn({ error: "nome is required" }, 400);
          else {
            const { data, error } = await supabase
              .from("bancos").insert({ nome: body.nome }).select().single();
            if (error) throw error;
            await logAndReturn(data, 201);
          }
        } else if (method === "GET") {
          // ?com_saldos=true → usa RPC
          if (url.searchParams.get("com_saldos") === "true") {
            const { data, error } = await supabase.rpc("get_bancos_com_saldos", {
              data_inicio: url.searchParams.get("data_inicio") || undefined,
              data_fim: url.searchParams.get("data_fim") || undefined,
            });
            if (error) throw error;
            await logAndReturn(data);
          } else {
            const { data, error } = await supabase
              .from("bancos").select("*").order("nome");
            if (error) throw error;
            await logAndReturn(data);
          }
        } else {
          await logAndReturn({ error: "Method not allowed" }, 405);
        }
      }

      // ===================== RESUMO =====================
      else if (resource === "resumo" && method === "GET") {
        const { data: lancamentos, error } = await supabase.from("lancamentos").select("*");
        if (error) throw error;
        const receitas = lancamentos?.filter((l: any) => l.tipo === "receita") || [];
        const despesas = lancamentos?.filter((l: any) => l.tipo === "despesa") || [];
        await logAndReturn({
          total_receitas: receitas.reduce((s: number, l: any) => s + (Number(l.valor) || 0), 0),
          total_despesas: despesas.reduce((s: number, l: any) => s + (Number(l.valor) || 0), 0),
          total_recebido: receitas.filter((l: any) => l.status === "recebido")
            .reduce((s: number, l: any) => s + (Number(l.valor_pago) || 0), 0),
          total_pago: despesas.filter((l: any) => l.status === "pago")
            .reduce((s: number, l: any) => s + (Number(l.valor_pago) || 0), 0),
          a_receber: receitas.filter((l: any) => ["a_receber", "vencida"].includes(l.status))
            .reduce((s: number, l: any) => s + (Number(l.valor) || 0), 0),
          a_pagar: despesas.filter((l: any) => ["a_pagar", "atrasado"].includes(l.status))
            .reduce((s: number, l: any) => s + (Number(l.valor) || 0), 0),
          quantidade_lancamentos: lancamentos?.length || 0,
        });
      }

      // ===================== ROOT / 404 =====================
      else if (!resource || resource === "") {
        await logAndReturn({
          message: "MarySysten Financeiro API",
          version: "2.0",
          endpoints: {
            lancamentos: "GET, POST, GET/:id, PUT/:id, DELETE/:id, POST/:id/baixa",
            transferencias: "GET, POST, PUT/:vinculo_id, DELETE/:vinculo_id",
            categorias: "GET, POST, GET/:id, PUT/:id, DELETE/:id",
            bancos: "GET, POST, GET/:id, PUT/:id, DELETE/:id (?com_saldos=true)",
            resumo: "GET",
          },
        });
      } else {
        await logAndReturn({
          error: "Endpoint not found",
          available_endpoints: ["lancamentos", "transferencias", "categorias", "bancos", "resumo"],
        }, 404);
      }
    } catch (err: any) {
      console.error("Handler error:", err);
      await logAndReturn({ error: err?.message || "Internal server error" }, 500);
    }

    // ============ Log access ============
    await supabase.from("api_access_logs").insert({
      api_key_id: keyData.id,
      endpoint: `${method} /${parts.join("/")}`,
      ip_address: ipAddress,
      user_agent: userAgent,
      response_status: responseStatus,
    });
    await supabase.from("api_keys")
      .update({ ultimo_acesso: new Date().toISOString() })
      .eq("id", keyData.id);

    return json(responseData, responseStatus);
  } catch (error: any) {
    console.error("API Error:", error);
    return json({ error: error?.message || "Internal server error" }, 500);
  }
});
