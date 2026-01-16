import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { addDays } from "https://esm.sh/date-fns@3.6.0";
import { formatInTimeZone, zonedTimeToUtc } from "https://esm.sh/date-fns-tz@2.0.0?deps=date-fns@3.6.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const baseUtcMidnight = zonedTimeToUtc(`${data_base}T00:00:00`, TZ);

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

    const systemPrompt = `Você é um assistente financeiro com regras estritas para manipulação de datas.

REGRA MESTRE DE DATA:
- A data de referência para **TODAS** as operações é a \`data_base\`.
- **data_base = ${data_base}** (formato YYYY-MM-DD).

SUAS RESPONSABILIDADES:
1.  **Interpretar Datas Relativas**: Você DEVE converter qualquer expressão de data relativa dita pelo usuário (ex: 'hoje', 'amanhã', 'ontem', 'daqui a 2 dias') em uma data absoluta no formato \`YYYY-MM-DD\`, usando a \`data_base\` como ponto de partida.
2.  **Proibição de Inferência**: Você está **PROIBIDO** de usar qualquer outra fonte para inferir datas. Isso inclui o histórico da conversa, lançamentos anteriores, ou a data do sistema. A \`data_base\` é sua única fonte da verdade temporal.
3.  **Usar a Ferramenta \`criar_lancamento\`**: Para registrar qualquer despesa ou receita, você DEVE usar a função \`criar_lancamento\`, fornecendo a data de vencimento calculada no formato \`YYYY-MM-DD\`.

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
