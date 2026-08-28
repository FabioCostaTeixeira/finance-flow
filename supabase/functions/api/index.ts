import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(null), "Content-Type": "application/json" },
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
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}
function semTenantDoPayload(body: Record<string, unknown>) {
  const { tenant_id: _ignorado, user_id: _ignoradoUser, created_by: _ignoradoCreated, role: _r, ...rest } = body;
  return rest;
}
async function referenciasDoTenant(supabase: any, tenantId: string, bancoId?: string | null, categoriaId?: string | null, categoriaPaiId?: string | null) {
  if (bancoId) {
    const { data } = await supabase.from("bancos").select("id").eq("id", bancoId).eq("tenant_id", tenantId).maybeSingle();
    if (!data) return false;
  }
  for (const id of [categoriaId, categoriaPaiId].filter(Boolean)) {
    const { data } = await supabase.from("categorias").select("id").eq("id", id).eq("tenant_id", tenantId).maybeSingle();
    if (!data) return false;
  }
  return true;
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
  const cors = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
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

    const keyHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(apiKey)))).map(b=>b.toString(16).padStart(2,"0")).join("");

    const { data: keyData, error: keyError } = await supabase
      .from("api_keys")
      .select("id, ativa, tenant_id")
      .eq("hash", keyHash)
      .single();

    if (keyError || !keyData) return json({ error: "Invalid API key" }, 401);
    if (!keyData.ativa) return json({ error: "API key is inactive" }, 403);
    const tenantId = keyData.tenant_id;

    // Rate Limit 100/min por API key
    const { count } = await supabase.from("api_access_logs").select("id", { count: "exact", head: true }).eq("api_key_id", keyData.id).gte("created_at", new Date(Date.now()-60000).toISOString());
    if ((count ?? 0) >= 100) return json({ error: "Rate limit exceeded. Max 100 requests per minute." }, 429);

    // ============ Idempotency Verification ============
    const idempotencyKey = req.headers.get("idempotency-key");
    const method = req.method;
    const url = new URL(req.url);
    const fullPath = url.pathname.replace(/^\/+/, "");
    const parts = fullPath.split("/").filter(Boolean);
    if (parts[0] === "api" || parts[0] === "v1") parts.shift();

    if (idempotencyKey && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      const { data: cachedResponse } = await supabase
        .from("api_idempotency_keys")
        .select("response_body, status_code")
        .eq("tenant_id", tenantId)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (cachedResponse) {
        return json(cachedResponse.response_body, cachedResponse.status_code);
      }
    }

    // ============ Routing ============
    const resource = parts[0] || "";
    const id = parts[1];
    const action = parts[2];

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
      // ===================== METADATA / SYSTEM ENDPOINTS =====================
      if (resource === "health" && method === "GET") {
        await logAndReturn({
          status: "healthy",
          timestamp: new Date().toISOString(),
          tenant_id: tenantId,
          version: "2.1.0",
        });
      } else if (resource === "capabilities" && method === "GET") {
        await logAndReturn({
          version: "2.1.0",
          protocol: "MCP",
          capabilities: {
            auth: ["X-API-Key"],
            idempotency: true,
            transactions: true,
            pagination: true,
          },
          supported_resources: ["lancamentos", "transferencias", "categorias", "bancos", "resumo"],
        });
      } else if (resource === "schema" && method === "GET") {
        await logAndReturn({
          version: "2.1.0",
          entities: {
            lancamento: ["id", "tenant_id", "cliente_credor", "valor", "valor_pago", "data_vencimento", "data_pagamento", "tipo", "status", "banco_id", "categoria_id"],
            banco: ["id", "tenant_id", "nome"],
            categoria: ["id", "tenant_id", "nome", "tipo", "categoria_pai_id"],
            transferencia: ["id", "tenant_id", "banco_origem_id", "banco_destino_id", "valor", "data", "descricao"],
          },
        });
      } else if (resource === "version" && method === "GET") {
        await logAndReturn({ version: "2.1.0", mcp_spec: "2026-08", build: "20260828.1" });
      }

      // ===================== LANCAMENTOS =====================
      else if (resource === "lancamentos") {
        // Special action endpoints: Baixa atômica via RPC Transacional
        if (id && action === "baixa" && method === "POST") {
          const valorPago = Number(body.valor_pago);
          const dataPagamento = body.data_pagamento || toISODate(new Date());
          if (!valorPago || valorPago <= 0) {
            await logAndReturn({ error: "valor_pago is required and must be > 0" }, 400);
          } else {
            const { data: rpcRes, error: rpcErr } = await supabase.rpc("rpc_baixar_lancamento", {
              p_tenant_id: tenantId,
              p_lancamento_id: id,
              p_valor_pago: valorPago,
              p_data_pagamento: dataPagamento,
              p_banco_id: body.banco_id || null,
            });

            if (rpcErr) {
              if (rpcErr.code === "P0002") {
                await logAndReturn({ error: "Lançamento not found or tenant mismatch" }, 404);
              } else {
                await logAndReturn({ error: rpcErr.message }, 400);
              }
            } else {
              await logAndReturn(rpcRes);
            }
          }
        } else if (id && method === "GET") {
          const { data, error } = await supabase
            .from("lancamentos")
            .select("*, categorias(id,nome,categoria_pai_id), bancos(id,nome)")
            .eq("id", id).eq("tenant_id", tenantId).maybeSingle();
          if (error || !data) await logAndReturn({ error: "Lançamento not found" }, 404);
          else await logAndReturn(data);
        } else if (id && (method === "PUT" || method === "PATCH")) {
          const { data: existing } = await supabase.from("lancamentos").select("id").eq("id", id).eq("tenant_id", tenantId).maybeSingle();
          if (!existing) {
            await logAndReturn({ error: "Lançamento not found" }, 404);
          } else if (!await referenciasDoTenant(supabase, tenantId, body.banco_id, body.categoria_id)) {
            await logAndReturn({ error: "Banco ou categoria não pertence ao tenant da API key" }, 403);
          } else {
            const { data, error } = await supabase
              .from("lancamentos").update(semTenantDoPayload(body)).eq("id", id).eq("tenant_id", tenantId).select().single();
            if (error) throw error;
            await logAndReturn(data);
          }
        } else if (id && method === "DELETE") {
          const { data: existing } = await supabase.from("lancamentos").select("id, recorrencia_id").eq("id", id).eq("tenant_id", tenantId).maybeSingle();
          if (!existing) {
            await logAndReturn({ error: "Lançamento not found" }, 404);
          } else {
            const deleteAll = url.searchParams.get("recorrencia") === "true";
            if (deleteAll && existing.recorrencia_id) {
              const { error } = await supabase
                .from("lancamentos").delete().eq("recorrencia_id", existing.recorrencia_id).eq("tenant_id", tenantId);
              if (error) throw error;
              await logAndReturn({ success: true, deleted: "series" });
            } else {
              const { error } = await supabase.from("lancamentos").delete().eq("id", id).eq("tenant_id", tenantId);
              if (error) throw error;
              await logAndReturn({ success: true, deleted: "single" });
            }
          }
        } else if (method === "POST") {
          const { recorrente, frequencia, qtd_parcelas, lancar_como_pago, data_pagamento, ...rest } = body;
          const tipo = rest.tipo;
          if (!tipo || !["receita", "despesa"].includes(tipo)) {
            await logAndReturn({ error: "tipo must be 'receita' or 'despesa'" }, 400);
          } else if (!rest.cliente_credor || !rest.valor || !rest.data_vencimento) {
            await logAndReturn({ error: "cliente_credor, valor and data_vencimento are required" }, 400);
          } else {
            const baseStatus = tipo === "receita" ? "a_receber" : "a_pagar";
            if (!await referenciasDoTenant(supabase, tenantId, rest.banco_id, rest.categoria_id)) {
              await logAndReturn({ error: "Banco ou categoria não pertence ao tenant da API key" }, 403);
            } else if (recorrente && frequencia) {
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
                tenant_id: tenantId,
              }));
              const { data, error } = await supabase.from("lancamentos").insert(rows).select();
              if (error) throw error;
              await logAndReturn({ recorrencia_id: recId, lancamentos: data }, 201);
            } else {
              const insertData: Record<string, unknown> = {
                tenant_id: tenantId,
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
          let query = supabase
            .from("lancamentos")
            .select("*, categorias(id,nome,categoria_pai_id), bancos(id,nome)")
            .eq("tenant_id", tenantId);

          const tipo = url.searchParams.get("tipo");
          const status = url.searchParams.get("status");
          const dataInicio = url.searchParams.get("data_inicio");
          const dataFim = url.searchParams.get("data_fim");
          const q = url.searchParams.get("q");

          const limit = Math.min(Number(url.searchParams.get("limit") || 100), 1000);
          const offset = Number(url.searchParams.get("offset") || 0);

          if (tipo) query = query.eq("tipo", tipo);
          if (status) query = query.eq("status", status);
          if (dataInicio) query = query.gte("data_vencimento", dataInicio);
          if (dataFim) query = query.lte("data_vencimento", dataFim);
          if (q) query = query.ilike("cliente_credor", `%${q}%`);

          const { data, error } = await query
            .order("data_vencimento", { ascending: false })
            .range(offset, offset + limit - 1);

          if (error) throw error;
          await logAndReturn(data);
        } else {
          await logAndReturn({ error: "Method not allowed" }, 405);
        }
      }

      // ===================== TRANSFERENCIAS =====================
      else if (resource === "transferencias") {
        if (method === "POST") {
          const { banco_origem_id, banco_destino_id, valor, data, descricao } = body;
          if (!banco_origem_id || !banco_destino_id || !valor || !data) {
            await logAndReturn({ error: "banco_origem_id, banco_destino_id, valor and data are required" }, 400);
          } else {
            const { data: rpcRes, error: rpcErr } = await supabase.rpc("rpc_criar_transferencia", {
              p_tenant_id: tenantId,
              p_banco_origem_id: banco_origem_id,
              p_banco_destino_id: banco_destino_id,
              p_valor: Number(valor),
              p_data: data,
              p_descricao: descricao || "Transferência entre contas",
            });

            if (rpcErr) {
              if (rpcErr.code === "P0002") {
                await logAndReturn({ error: "Os bancos devem pertencer ao tenant da API key" }, 403);
              } else {
                await logAndReturn({ error: rpcErr.message }, 400);
              }
            } else {
              await logAndReturn(rpcRes, 201);
            }
          }
        } else if (id && (method === "PUT" || method === "PATCH")) {
          const { data: existing } = await supabase.from("lancamentos").select("id").eq("transferencia_vinculo_id", id).eq("tenant_id", tenantId).limit(1);
          if (!existing || existing.length === 0) {
            await logAndReturn({ error: "Transferência not found" }, 404);
          } else {
            const { valor, data, descricao } = body;
            const update: Record<string, unknown> = {};
            if (valor !== undefined) { update.valor = valor; update.valor_pago = valor; }
            if (data) { update.data_vencimento = data; update.data_pagamento = data; }
            if (descricao) update.cliente_credor = descricao;
            const { data: updated, error } = await supabase
              .from("lancamentos").update(update)
              .eq("transferencia_vinculo_id", id).eq("tenant_id", tenantId).select();
            if (error) throw error;
            await logAndReturn(updated);
          }
        } else if (id && method === "DELETE") {
          const { data: existing } = await supabase.from("lancamentos").select("id").eq("transferencia_vinculo_id", id).eq("tenant_id", tenantId).limit(1);
          if (!existing || existing.length === 0) {
            await logAndReturn({ error: "Transferência not found" }, 404);
          } else {
            const { error } = await supabase
              .from("lancamentos").delete().eq("transferencia_vinculo_id", id).eq("tenant_id", tenantId);
            if (error) throw error;
            await logAndReturn({ success: true });
          }
        } else if (method === "GET") {
          const limit = Math.min(Number(url.searchParams.get("limit") || 100), 1000);
          const offset = Number(url.searchParams.get("offset") || 0);

          const { data, error } = await supabase
            .from("lancamentos").select("*")
            .eq("status", "transferencia").eq("tenant_id", tenantId)
            .order("data_vencimento", { ascending: false })
            .range(offset, offset + limit - 1);
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
            .from("categorias").select("*").eq("id", id).eq("tenant_id", tenantId).maybeSingle();
          if (error || !data) await logAndReturn({ error: "Categoria not found" }, 404);
          else await logAndReturn(data);
        } else if (id && (method === "PUT" || method === "PATCH")) {
          const { data: existing } = await supabase.from("categorias").select("id").eq("id", id).eq("tenant_id", tenantId).maybeSingle();
          if (!existing) {
            await logAndReturn({ error: "Categoria not found" }, 404);
          } else {
            const update: Record<string, unknown> = semTenantDoPayload(body);
            if (body.nome) update.nome_normalizado = normalizar(body.nome);
            if (!await referenciasDoTenant(supabase, tenantId, null, null, body.categoria_pai_id)) {
              await logAndReturn({ error: "Categoria pai não pertence ao tenant da API key" }, 403);
            } else {
              const { data, error } = await supabase
                .from("categorias").update(update).eq("id", id).eq("tenant_id", tenantId).select().single();
              if (error) throw error;
              await logAndReturn(data);
            }
          }
        } else if (id && method === "DELETE") {
          const { data: existing } = await supabase.from("categorias").select("id").eq("id", id).eq("tenant_id", tenantId).maybeSingle();
          if (!existing) {
            await logAndReturn({ error: "Categoria not found" }, 404);
          } else {
            const { error } = await supabase.from("categorias").delete().eq("id", id).eq("tenant_id", tenantId);
            if (error) throw error;
            await logAndReturn({ success: true });
          }
        } else if (method === "POST") {
          const { nome, tipo, categoria_pai_id } = body;
          if (!nome || !tipo) {
            await logAndReturn({ error: "nome and tipo are required" }, 400);
          } else if (!await referenciasDoTenant(supabase, tenantId, null, null, categoria_pai_id)) {
            await logAndReturn({ error: "Categoria pai não pertence ao tenant da API key" }, 403);
          } else {
            const { data, error } = await supabase.from("categorias").insert({
              nome, tipo,
              nome_normalizado: normalizar(nome),
              categoria_pai_id: categoria_pai_id || null,
              tenant_id: tenantId,
            }).select().single();
            if (error) throw error;
            await logAndReturn(data, 201);
          }
        } else if (method === "GET") {
          let q = supabase.from("categorias").select("*").eq("tenant_id", tenantId).order("nome");
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
            .from("bancos").select("*").eq("id", id).eq("tenant_id", tenantId).maybeSingle();
          if (error || !data) await logAndReturn({ error: "Banco not found" }, 404);
          else await logAndReturn(data);
        } else if (id && (method === "PUT" || method === "PATCH")) {
          const { data: existing } = await supabase.from("bancos").select("id").eq("id", id).eq("tenant_id", tenantId).maybeSingle();
          if (!existing) {
            await logAndReturn({ error: "Banco not found" }, 404);
          } else {
            const { data, error } = await supabase
              .from("bancos").update(semTenantDoPayload(body)).eq("id", id).eq("tenant_id", tenantId).select().single();
            if (error) throw error;
            await logAndReturn(data);
          }
        } else if (id && method === "DELETE") {
          const { data: existing } = await supabase.from("bancos").select("id").eq("id", id).eq("tenant_id", tenantId).maybeSingle();
          if (!existing) {
            await logAndReturn({ error: "Banco not found" }, 404);
          } else {
            const { error } = await supabase.from("bancos").delete().eq("id", id).eq("tenant_id", tenantId);
            if (error) throw error;
            await logAndReturn({ success: true });
          }
        } else if (method === "POST") {
          if (!body.nome) await logAndReturn({ error: "nome is required" }, 400);
          else {
            const { data, error } = await supabase
              .from("bancos").insert({ nome: body.nome, tenant_id: tenantId }).select().single();
            if (error) throw error;
            await logAndReturn(data, 201);
          }
        } else if (method === "GET") {
          if (url.searchParams.get("com_saldos") === "true") {
            const { data, error } = await supabase.rpc("get_bancos_com_saldos", {
              _tenant: tenantId,
              data_inicio: url.searchParams.get("data_inicio") || undefined,
              data_fim: url.searchParams.get("data_fim") || undefined,
            });
            if (error) throw error;
            await logAndReturn(data);
          } else {
            const { data, error } = await supabase
              .from("bancos").select("*").eq("tenant_id", tenantId).order("nome");
            if (error) throw error;
            await logAndReturn(data);
          }
        } else {
          await logAndReturn({ error: "Method not allowed" }, 405);
        }
      }

      // ===================== RESUMO =====================
      else if (resource === "resumo" && method === "GET") {
        const { data: lancamentos, error } = await supabase.from("lancamentos").select("*").eq("tenant_id", tenantId);
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
          message: "Finance Flow API",
          version: "2.1.0",
          endpoints: {
            health: "GET",
            capabilities: "GET",
            schema: "GET",
            version: "GET",
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
          available_endpoints: ["health", "capabilities", "schema", "version", "lancamentos", "transferencias", "categorias", "bancos", "resumo"],
        }, 404);
      }
    } catch (err: any) {
      console.error("Handler error:", err);
      await logAndReturn({ error: err?.message || "Internal server error" }, 500);
    }

    // ============ Save Idempotency Cache if requested ============
    if (idempotencyKey && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      await supabase.from("api_idempotency_keys").insert({
        tenant_id: tenantId,
        idempotency_key: idempotencyKey,
        request_path: `${method} /${parts.join("/")}`,
        response_body: responseData,
        status_code: responseStatus,
      }).maybeSingle();
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
