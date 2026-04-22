import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { addDays } from "https://esm.sh/date-fns@3.6.0";
import { formatInTimeZone, fromZonedTime } from "https://esm.sh/date-fns-tz@3.0.0?deps=date-fns@3.6.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Resolve provider/model/key dinamicamente a partir de ai_settings.
// Para o chat com tool-calling, só providers OpenAI-compatible são suportados (lovable, openai, google).
// Se o usuário escolher Anthropic, caímos de volta para Lovable (Anthropic exige tradução de tools).
async function getAIConfig(supabase: any, fallbackKey: string) {
  try {
    const { data } = await supabase.from("ai_settings").select("*").eq("id", 1).single();
    if (!data || data.enabled === false) {
      return { endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions", apiKey: fallbackKey, model: "google/gemini-3-flash-preview", systemOverride: null };
    }
    const provider = data.provider || "lovable";
    const model = data.model || "google/gemini-3-flash-preview";
    const systemOverride = data.system_prompt_override || null;

    if (provider === "openai" && data.api_key) {
      return { endpoint: "https://api.openai.com/v1/chat/completions", apiKey: data.api_key, model, systemOverride };
    }
    if (provider === "google" && data.api_key) {
      return { endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", apiKey: data.api_key, model, systemOverride };
    }
    // anthropic ou lovable -> usar Lovable AI (Anthropic não suporta tools nesse formato simples)
    return { endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions", apiKey: fallbackKey, model: provider === "lovable" ? model : "google/gemini-3-flash-preview", systemOverride };
  } catch (e) {
    console.error("getAIConfig error, falling back to Lovable:", e);
    return { endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions", apiKey: fallbackKey, model: "google/gemini-3-flash-preview", systemOverride: null };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch financial data from database
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const aiCfg = await getAIConfig(supabase, LOVABLE_API_KEY);

    const [lancamentosRes, categoriasRes, bancosRes] = await Promise.all([
      supabase.from("lancamentos").select("*, categorias(nome, categoria_pai_id)").order("data_vencimento", { ascending: false }).limit(500),
      supabase.from("categorias").select("*"),
      supabase.from("bancos").select("*"),
    ]);

    const lancamentos = lancamentosRes.data || [];
    const categorias = categoriasRes.data || [];
    const bancos = bancosRes.data || [];

    // --- Deterministic Date Logic ---
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

      // YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

      // DD/MM/YYYY
      const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) {
        const [, dd, mm, yyyy] = m;
        return `${yyyy}-${mm}-${dd}`;
      }

      return null;
    };

    // Calculate financial metrics (using 'now' for simplicity, as it's for broad stats)
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const receitasMes = lancamentos.filter((l: any) => {
      const date = new Date(l.data_vencimento);
      return l.tipo === "receita" && date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const despesasMes = lancamentos.filter((l: any) => {
      const date = new Date(l.data_vencimento);
      return l.tipo === "despesa" && date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const totalReceitasMes = receitasMes.reduce((acc: number, l: any) => acc + Number(l.valor), 0);
    const totalDespesasMes = despesasMes.reduce((acc: number, l: any) => acc + Number(l.valor), 0);

    const aReceber = lancamentos
      .filter((l: any) => l.tipo === "receita" && ["a_receber", "parcial"].includes(l.status))
      .reduce((acc: number, l: any) => acc + Number(l.valor) - Number(l.valor_pago || 0), 0);

    const aPagar = lancamentos
      .filter((l: any) => l.tipo === "despesa" && ["a_pagar", "parcial"].includes(l.status))
      .reduce((acc: number, l: any) => acc + Number(l.valor) - Number(l.valor_pago || 0), 0);

    const atrasados = lancamentos.filter((l: any) => {
      const vencimento = new Date(l.data_vencimento);
      // Use data_base for overdue comparison
      return vencimento < new Date(data_base) && ["a_pagar", "a_receber", "parcial"].includes(l.status);
    });
    
    // Top expenses by category
    const despesasPorCategoria = despesasMes.reduce((acc: Record<string, number>, l: any) => {
      const catName = l.categorias?.nome || "Sem categoria";
      acc[catName] = (acc[catName] || 0) + Number(l.valor);
      return acc;
    }, {});

    // Top clients/creditors
    const topClientes = receitasMes.reduce((acc: Record<string, number>, l: any) => {
      acc[l.cliente_credor] = (acc[l.cliente_credor] || 0) + Number(l.valor);
      return acc;
    }, {});

    const topCredores = despesasMes.reduce((acc: Record<string, number>, l: any) => {
      acc[l.cliente_credor] = (acc[l.cliente_credor] || 0) + Number(l.valor);
      return acc;
    }, {});

    const financialContext = `
CONTEXTO FINANCEIRO ATUAL (dados reais do banco de dados):

📊 RESUMO DO MÊS ATUAL:
- Total de Receitas: R$ ${totalReceitasMes.toFixed(2)}
- Total de Despesas: R$ ${totalDespesasMes.toFixed(2)}
- Saldo do Mês: R$ ${(totalReceitasMes - totalDespesasMes).toFixed(2)}

💰 PENDÊNCIAS:
- Total a Receber: R$ ${aReceber.toFixed(2)}
- Total a Pagar: R$ ${aPagar.toFixed(2)}
- Itens Atrasados: ${atrasados.length} lançamentos

📁 CATEGORIAS DE DESPESAS DO MÊS:
${Object.entries(despesasPorCategoria).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([cat, val]) => `- ${cat}: R$ ${(val as number).toFixed(2)}`).join("\n") || "- Nenhuma despesa registrada"}

👥 TOP 5 CLIENTES (RECEITAS DO MÊS):
${Object.entries(topClientes).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cli, val]) => `- ${cli}: R$ ${(val as number).toFixed(2)}`).join("\n") || "- Nenhuma receita registrada"}

🏢 TOP 5 FORNECEDORES (DESPESAS DO MÊS):
${Object.entries(topCredores).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cre, val]) => `- ${cre}: R$ ${(val as number).toFixed(2)}`).join("\n") || "- Nenhuma despesa registrada"}

🏦 BANCOS CADASTRADOS (IDs para uso):
${bancos.map((b: any) => `- ${b.nome} (ID: ${b.id})`).join("\n") || "- Nenhum banco cadastrado"}

📋 CATEGORIAS DISPONÍVEIS (IDs para uso):
${categorias.filter((c: any) => !c.categoria_pai_id).map((c: any) => `- ${c.nome} (${c.tipo}, ID: ${c.id})`).join("\n") || "- Nenhuma categoria cadastrada"}

📋 SUBCATEGORIAS DISPONÍVEIS (IDs para uso):
${categorias.filter((c: any) => c.categoria_pai_id).map((c: any) => {
  const pai = categorias.find((p: any) => p.id === c.categoria_pai_id);
  return `- ${pai?.nome || '?'} > ${c.nome} (${c.tipo}, ID: ${c.id})`;
}).join("\n") || "- Nenhuma subcategoria cadastrada"}

📅 ÚLTIMOS 10 LANÇAMENTOS:
${lancamentos.slice(0, 10).map((l: any) => `- ${l.data_vencimento}: ${l.tipo === "receita" ? "↑" : "↓"} ${l.cliente_credor} - R$ ${Number(l.valor).toFixed(2)} (${l.status})`).join("\n") || "- Nenhum lançamento"}

⚠️ LANÇAMENTOS ATRASADOS (${atrasados.length}):
${atrasados.slice(0, 5).map((l: any) => `- ${l.data_vencimento}: ${l.cliente_credor} - R$ ${Number(l.valor).toFixed(2)} (${l.tipo})`).join("\n") || "- Nenhum atraso"}
`;

    const systemPrompt = `Você é um assistente financeiro com regras estritas para manipulação de datas e capacidade de criar, atualizar, excluir, baixar lançamentos e realizar transferências entre contas.

REGRA MESTRE DE DATA:
- A data de referência para **TODAS** as operações é a \`data_base\`.
- **data_base = ${data_base}** (formato YYYY-MM-DD).

SUAS RESPONSABILIDADES:
1.  **Interpretar Datas Relativas**: Você DEVE converter qualquer expressão de data relativa dita pelo usuário (ex: 'hoje', 'amanhã', 'ontem', 'daqui a 2 dias') em uma data absoluta no formato \`YYYY-MM-DD\`, usando a \`data_base\` como ponto de partida.
2.  **Proibição de Inferência**: Você está **PROIBIDO** de usar qualquer outra fonte para inferir datas. Isso inclui o histórico da conversa, lançamentos anteriores, ou a data do sistema. A \`data_base\` é sua única fonte da verdade temporal.
3.  **Usar Ferramentas Apropriadas**:
    - \`criar_lancamento\`: Para criar novos lançamentos financeiros
    - \`atualizar_lancamento\`: Para modificar lançamentos existentes (valor, data, cliente, categoria, etc.)
    - \`excluir_lancamento\`: Para remover lançamentos (use com cuidado!)
    - \`baixar_lancamento\`: Para marcar lançamentos como pagos ou recebidos
    - \`transferir_entre_contas\`: Para transferir valores entre bancos/contas

COMO CALCULAR DATAS:
- 'hoje', 'hj': use a \`data_base\` diretamente. (Ex: ${data_base})
- 'amanhã': \`data_base\` + 1 dia.
- 'ontem': \`data_base\` - 1 dia.
- 'anteontem': \`data_base\` - 2 dias.
- 'daqui a 5 dias': \`data_base\` + 5 dias.
- 'semana passada' (mesmo dia da semana): \`data_base\` - 7 dias.
- 'próxima terça-feira': calcule a data da próxima terça-feira a partir da \`data_base\`.

EXEMPLO DE FLUXO:
- Usuário: "Lança uma despesa de 50 reais de aluguel para ontem."
- Você (pensamento): "O usuário disse 'ontem'. A \`data_base\` é ${data_base}. 'ontem' é \`data_base\` - 1 dia. Calculo a data e chamo a função."
- Você (ação): chama a ferramenta \`criar_lancamento\` com \`data_vencimento\` sendo a data calculada.

DADOS OBRIGATÓRIOS PARA \`criar_lancamento\`:
- \`tipo\`: 'receita' ou 'despesa'.
- \`cliente_credor\`: Nome do cliente ou fornecedor.
- \`valor\`: O montante numérico.
- \`data_vencimento\`: A data **calculada por você** no formato **YYYY-MM-DD**.

REGRAS PARA ATUALIZAÇÃO E EXCLUSÃO:
- Para atualizar ou excluir, você precisa do ID do lançamento.
- Consulte os últimos lançamentos no contexto para encontrar IDs.
- Ao atualizar, mencione claramente o que foi alterado.
- Ao excluir, confirme a ação com o usuário antes de executar.

REGRAS PARA BAIXA:
- Use \`baixar_lancamento\` para marcar como pago ou recebido.
- Informe o valor sendo pago e a data do pagamento.

REGRAS PARA TRANSFERÊNCIA:
- Use \`transferir_entre_contas\` para mover dinheiro entre bancos.
- Necessário: banco de origem, banco de destino, valor e data.
- A transferência cria automaticamente uma saída no banco de origem e uma entrada no banco de destino.
- Use os IDs dos bancos fornecidos no contexto.

Se alguma informação obrigatória estiver faltando, você DEVE pedi-la ao usuário.

${financialContext}`;

    const tools = [
      {
        type: "function",
        function: {
          name: "criar_lancamento",
          description: "Cria um novo lançamento financeiro (receita ou despesa) no banco de dados.",
          parameters: {
            type: "object",
            properties: {
              tipo: {
                type: "string",
                enum: ["receita", "despesa"],
                description: "Tipo do lançamento: receita para entradas e despesa para saídas"
              },
              cliente_credor: {
                type: "string",
                description: "Nome do cliente (para receitas) ou credor/fornecedor (para despesas)"
              },
              valor: {
                type: "number",
                description: "Valor do lançamento em reais (ex: 100.50)"
              },
              data_vencimento: {
                type: "string",
                description: "Data de vencimento no formato YYYY-MM-DD (ex: 2024-01-15)"
              },
              banco_id: {
                type: "string",
                description: "ID do banco (UUID). Use os IDs fornecidos no contexto."
              },
              categoria_id: {
                type: "string",
                description: "ID da categoria ou subcategoria (UUID). Use os IDs fornecidos no contexto."
              },
              observacao: {
                type: "string",
                description: "Observação opcional sobre o lançamento"
              }
            },
            required: ["tipo", "cliente_credor", "valor", "data_vencimento"],
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "atualizar_lancamento",
          description: "Atualiza um lançamento financeiro existente. Use para alterar dados como valor, data, cliente/credor, categoria, banco ou observação.",
          parameters: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "ID do lançamento a ser atualizado (UUID)"
              },
              cliente_credor: {
                type: "string",
                description: "Novo nome do cliente ou credor"
              },
              valor: {
                type: "number",
                description: "Novo valor do lançamento"
              },
              data_vencimento: {
                type: "string",
                description: "Nova data de vencimento no formato YYYY-MM-DD"
              },
              banco_id: {
                type: "string",
                description: "ID do novo banco (UUID)"
              },
              categoria_id: {
                type: "string",
                description: "ID da nova categoria (UUID)"
              },
              observacao: {
                type: "string",
                description: "Nova observação"
              }
            },
            required: ["id"],
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "excluir_lancamento",
          description: "Exclui um lançamento financeiro. Use com cuidado, esta ação não pode ser desfeita.",
          parameters: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "ID do lançamento a ser excluído (UUID)"
              }
            },
            required: ["id"],
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "baixar_lancamento",
          description: "Marca um lançamento como pago ou recebido, total ou parcialmente.",
          parameters: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "ID do lançamento a ser baixado (UUID)"
              },
              valor_pago: {
                type: "number",
                description: "Valor sendo pago/recebido nesta baixa"
              },
              data_pagamento: {
                type: "string",
                description: "Data do pagamento no formato YYYY-MM-DD"
              }
            },
            required: ["id", "valor_pago", "data_pagamento"],
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "transferir_entre_contas",
          description: "Realiza uma transferência entre contas bancárias. Cria uma saída no banco de origem e uma entrada no banco de destino.",
          parameters: {
            type: "object",
            properties: {
              banco_origem_id: {
                type: "string",
                description: "ID do banco de origem (UUID)"
              },
              banco_destino_id: {
                type: "string",
                description: "ID do banco de destino (UUID)"
              },
              valor: {
                type: "number",
                description: "Valor da transferência em reais"
              },
              data: {
                type: "string",
                description: "Data da transferência no formato YYYY-MM-DD"
              }
            },
            required: ["banco_origem_id", "banco_destino_id", "valor", "data"],
            additionalProperties: false
          }
        }
      }
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools,
        stream: false, // Precisamos processar tool calls primeiro
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados. Por favor, adicione créditos à sua conta." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await response.json();
    const choice = aiResponse.choices?.[0];
    
    // Verificar se há tool calls
    if (choice?.message?.tool_calls?.length > 0) {
      const toolResults = [];
      
      for (const toolCall of choice.message.tool_calls) {
        if (toolCall.function.name === "criar_lancamento") {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            
            // Validar dados obrigatórios
            if (!args.tipo || !args.cliente_credor || !args.valor || !args.data_vencimento) {
              toolResults.push({
                tool_call_id: toolCall.id,
                content: JSON.stringify({ 
                  success: false, 
                  error: "Dados obrigatórios faltando. Necessário: tipo, cliente_credor, valor, data_vencimento" 
                })
              });
              continue;
            }

            // Blindagem de data: normaliza e força datas relativas (ex: 'hoje') a baterem com data_base.
            const lastUserMessage = [...messages]
              .slice()
              .reverse()
              .find((m: any) => m?.role === "user")?.content as string | undefined;

            const userAskedToday = /(^|\W)(hj|hoje)(\W|$)/i.test(lastUserMessage || "");
            const normalizedDate = normalizeDateInput(args.data_vencimento);
            const safeDataVencimento = userAskedToday ? data_base : normalizedDate;

            if (!safeDataVencimento) {
              toolResults.push({
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                  success: false,
                  error: "Data inválida. Use YYYY-MM-DD (ex: 2026-01-15), DD/MM/YYYY (ex: 15/01/2026) ou datas relativas (hoje/amanhã/ontem).",
                }),
              });
              continue;
            }

            // Determinar status baseado no tipo
            const status = args.tipo === "receita" ? "a_receber" : "a_pagar";

            // Inserir no banco de dados
            const { data: novoLancamento, error: insertError } = await supabase
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

            if (insertError) {
              console.error("Insert error:", insertError);
              toolResults.push({
                tool_call_id: toolCall.id,
                content: JSON.stringify({ 
                  success: false, 
                  error: `Erro ao inserir: ${insertError.message}` 
                })
              });
            } else {
              toolResults.push({
                tool_call_id: toolCall.id,
                content: JSON.stringify({ 
                  success: true, 
                  data: {
                    id: novoLancamento.id,
                    tipo: novoLancamento.tipo,
                    cliente_credor: novoLancamento.cliente_credor,
                    valor: novoLancamento.valor,
                    data_vencimento: novoLancamento.data_vencimento,
                    status: novoLancamento.status
                  },
                  message: `${args.tipo === 'receita' ? 'Receita' : 'Despesa'} de R$ ${Number(args.valor).toFixed(2)} criada com sucesso!`
                })
              });
            }
          } catch (e) {
            console.error("Tool call error:", e);
            toolResults.push({
              tool_call_id: toolCall.id,
              content: JSON.stringify({ 
                success: false, 
                error: `Erro ao processar: ${e instanceof Error ? e.message : 'Erro desconhecido'}` 
              })
            });
          }
        } else if (toolCall.function.name === "atualizar_lancamento") {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            
            if (!args.id) {
              toolResults.push({
                tool_call_id: toolCall.id,
                content: JSON.stringify({ 
                  success: false, 
                  error: "ID do lançamento é obrigatório para atualização" 
                })
              });
              continue;
            }

            const updateData: Record<string, unknown> = {};
            if (args.cliente_credor) updateData.cliente_credor = args.cliente_credor;
            if (args.valor) updateData.valor = args.valor;
            if (args.data_vencimento) {
              const normalizedDate = normalizeDateInput(args.data_vencimento);
              if (normalizedDate) updateData.data_vencimento = normalizedDate;
            }
            if (args.banco_id) updateData.banco_id = args.banco_id;
            if (args.categoria_id) updateData.categoria_id = args.categoria_id;
            if (args.observacao !== undefined) updateData.observacao = args.observacao;

            if (Object.keys(updateData).length === 0) {
              toolResults.push({
                tool_call_id: toolCall.id,
                content: JSON.stringify({ 
                  success: false, 
                  error: "Nenhum campo para atualizar foi fornecido" 
                })
              });
              continue;
            }

            const { data: lancamentoAtualizado, error: updateError } = await supabase
              .from("lancamentos")
              .update(updateData)
              .eq("id", args.id)
              .select()
              .single();

            if (updateError) {
              console.error("Update error:", updateError);
              toolResults.push({
                tool_call_id: toolCall.id,
                content: JSON.stringify({ 
                  success: false, 
                  error: `Erro ao atualizar: ${updateError.message}` 
                })
              });
            } else {
              toolResults.push({
                tool_call_id: toolCall.id,
                content: JSON.stringify({ 
                  success: true, 
                  data: lancamentoAtualizado,
                  message: `Lançamento atualizado com sucesso!`
                })
              });
            }
          } catch (e) {
            console.error("Update tool call error:", e);
            toolResults.push({
              tool_call_id: toolCall.id,
              content: JSON.stringify({ 
                success: false, 
                error: `Erro ao processar atualização: ${e instanceof Error ? e.message : 'Erro desconhecido'}` 
              })
            });
          }
        } else if (toolCall.function.name === "excluir_lancamento") {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            
            if (!args.id) {
              toolResults.push({
                tool_call_id: toolCall.id,
                content: JSON.stringify({ 
                  success: false, 
                  error: "ID do lançamento é obrigatório para exclusão" 
                })
              });
              continue;
            }

            // Buscar o lançamento antes de excluir para confirmar
            const { data: lancamentoExistente } = await supabase
              .from("lancamentos")
              .select("*")
              .eq("id", args.id)
              .single();

            if (!lancamentoExistente) {
              toolResults.push({
                tool_call_id: toolCall.id,
                content: JSON.stringify({ 
                  success: false, 
                  error: "Lançamento não encontrado" 
                })
              });
              continue;
            }

            const { error: deleteError } = await supabase
              .from("lancamentos")
              .delete()
              .eq("id", args.id);

            if (deleteError) {
              console.error("Delete error:", deleteError);
              toolResults.push({
                tool_call_id: toolCall.id,
                content: JSON.stringify({ 
                  success: false, 
                  error: `Erro ao excluir: ${deleteError.message}` 
                })
              });
            } else {
              toolResults.push({
                tool_call_id: toolCall.id,
                content: JSON.stringify({ 
                  success: true, 
                  data: lancamentoExistente,
                  message: `Lançamento de ${lancamentoExistente.cliente_credor} - R$ ${Number(lancamentoExistente.valor).toFixed(2)} excluído com sucesso!`
                })
              });
            }
          } catch (e) {
            console.error("Delete tool call error:", e);
            toolResults.push({
              tool_call_id: toolCall.id,
              content: JSON.stringify({ 
                success: false, 
                error: `Erro ao processar exclusão: ${e instanceof Error ? e.message : 'Erro desconhecido'}` 
              })
            });
          }
        } else if (toolCall.function.name === "baixar_lancamento") {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            
            if (!args.id || args.valor_pago === undefined || !args.data_pagamento) {
              toolResults.push({
                tool_call_id: toolCall.id,
                content: JSON.stringify({ 
                  success: false, 
                  error: "Dados obrigatórios faltando. Necessário: id, valor_pago, data_pagamento" 
                })
              });
              continue;
            }

            // Buscar lançamento atual
            const { data: lancamento, error: fetchError } = await supabase
              .from("lancamentos")
              .select("*")
              .eq("id", args.id)
              .single();

            if (fetchError || !lancamento) {
              toolResults.push({
                tool_call_id: toolCall.id,
                content: JSON.stringify({ 
                  success: false, 
                  error: "Lançamento não encontrado" 
                })
              });
              continue;
            }

            const valorTotal = Number(lancamento.valor);
            const valorPagoAtual = Number(lancamento.valor_pago) || 0;
            const novoValorPago = valorPagoAtual + args.valor_pago;

            let novoStatus: string;
            if (novoValorPago >= valorTotal) {
              novoStatus = lancamento.tipo === "receita" ? "recebido" : "pago";
            } else {
              novoStatus = "parcial";
            }

            const normalizedPaymentDate = normalizeDateInput(args.data_pagamento) || data_base;

            const { data: lancamentoBaixado, error: baixaError } = await supabase
              .from("lancamentos")
              .update({
                valor_pago: novoValorPago,
                status: novoStatus,
                data_pagamento: normalizedPaymentDate,
              })
              .eq("id", args.id)
              .select()
              .single();

            if (baixaError) {
              console.error("Baixa error:", baixaError);
              toolResults.push({
                tool_call_id: toolCall.id,
                content: JSON.stringify({ 
                  success: false, 
                  error: `Erro ao baixar: ${baixaError.message}` 
                })
              });
            } else {
              const statusLabel = lancamento.tipo === "receita" 
                ? (novoStatus === "recebido" ? "recebido" : "parcialmente recebido")
                : (novoStatus === "pago" ? "pago" : "parcialmente pago");
              
              toolResults.push({
                tool_call_id: toolCall.id,
                content: JSON.stringify({ 
                  success: true, 
                  data: lancamentoBaixado,
                  message: `Lançamento ${statusLabel}! Valor baixado: R$ ${Number(args.valor_pago).toFixed(2)}`
                })
              });
            }
          } catch (e) {
            console.error("Baixa tool call error:", e);
            toolResults.push({
              tool_call_id: toolCall.id,
              content: JSON.stringify({ 
                success: false, 
                error: `Erro ao processar baixa: ${e instanceof Error ? e.message : 'Erro desconhecido'}` 
              })
            });
          }
        } else if (toolCall.function.name === "transferir_entre_contas") {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            
            if (!args.banco_origem_id || !args.banco_destino_id || !args.valor || !args.data) {
              toolResults.push({
                tool_call_id: toolCall.id,
                content: JSON.stringify({ 
                  success: false, 
                  error: "Dados obrigatórios faltando. Necessário: banco_origem_id, banco_destino_id, valor, data" 
                })
              });
              continue;
            }

            if (args.banco_origem_id === args.banco_destino_id) {
              toolResults.push({
                tool_call_id: toolCall.id,
                content: JSON.stringify({ 
                  success: false, 
                  error: "O banco de origem deve ser diferente do banco de destino" 
                })
              });
              continue;
            }

            const normalizedDate = normalizeDateInput(args.data) || data_base;

            // Buscar nomes dos bancos
            const { data: bancoOrigem } = await supabase
              .from("bancos")
              .select("nome")
              .eq("id", args.banco_origem_id)
              .single();

            const { data: bancoDestino } = await supabase
              .from("bancos")
              .select("nome")
              .eq("id", args.banco_destino_id)
              .single();

            if (!bancoOrigem || !bancoDestino) {
              toolResults.push({
                tool_call_id: toolCall.id,
                content: JSON.stringify({ 
                  success: false, 
                  error: "Banco de origem ou destino não encontrado. Verifique os IDs." 
                })
              });
              continue;
            }

            // Gerar ID de vínculo para conectar os dois lançamentos
            const vinculoId = crypto.randomUUID();

            // Criar saída no banco de origem
            const { error: errorSaida } = await supabase
              .from("lancamentos")
              .insert({
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

            if (errorSaida) {
              console.error("Transfer outflow error:", errorSaida);
              toolResults.push({
                tool_call_id: toolCall.id,
                content: JSON.stringify({ 
                  success: false, 
                  error: `Erro ao criar saída: ${errorSaida.message}` 
                })
              });
              continue;
            }

            // Criar entrada no banco de destino
            const { error: errorEntrada } = await supabase
              .from("lancamentos")
              .insert({
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

            if (errorEntrada) {
              console.error("Transfer inflow error:", errorEntrada);
              toolResults.push({
                tool_call_id: toolCall.id,
                content: JSON.stringify({ 
                  success: false, 
                  error: `Erro ao criar entrada: ${errorEntrada.message}` 
                })
              });
              continue;
            }

            toolResults.push({
              tool_call_id: toolCall.id,
              content: JSON.stringify({ 
                success: true, 
                message: `Transferência de R$ ${Number(args.valor).toFixed(2)} realizada com sucesso de ${bancoOrigem.nome} para ${bancoDestino.nome}!`
              })
            });
          } catch (e) {
            console.error("Transfer tool call error:", e);
            toolResults.push({
              tool_call_id: toolCall.id,
              content: JSON.stringify({ 
                success: false, 
                error: `Erro ao processar transferência: ${e instanceof Error ? e.message : 'Erro desconhecido'}` 
              })
            });
          }
        }
      }

      // Fazer segunda chamada para obter resposta final após tool calls
      const followUpMessages = [
        { role: "system", content: systemPrompt },
        ...messages,
        choice.message,
        ...toolResults.map((tr: any) => ({
          role: "tool",
          tool_call_id: tr.tool_call_id,
          content: tr.content
        }))
      ];

      const finalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: followUpMessages,
          stream: true,
        }),
      });

      if (!finalResponse.ok) {
        const errorText = await finalResponse.text();
        console.error("Final response error:", errorText);
        return new Response(JSON.stringify({ error: "Erro ao processar resposta" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(finalResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Se não houver tool calls, fazer streaming normal
    const streamResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    return new Response(streamResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
