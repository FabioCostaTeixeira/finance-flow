import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Calculate financial metrics
    const now = new Date();
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

    // Find overdue items
    const atrasados = lancamentos.filter((l: any) => {
      const vencimento = new Date(l.data_vencimento);
      return vencimento < now && ["a_pagar", "a_receber", "parcial"].includes(l.status);
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

🏦 BANCOS CADASTRADOS:
${bancos.map((b: any) => `- ${b.nome}`).join("\n") || "- Nenhum banco cadastrado"}

📋 CATEGORIAS DISPONÍVEIS:
${categorias.filter((c: any) => !c.categoria_pai_id).map((c: any) => `- ${c.nome} (${c.tipo})`).join("\n") || "- Nenhuma categoria cadastrada"}

📅 ÚLTIMOS 10 LANÇAMENTOS:
${lancamentos.slice(0, 10).map((l: any) => `- ${l.data_vencimento}: ${l.tipo === "receita" ? "↑" : "↓"} ${l.cliente_credor} - R$ ${Number(l.valor).toFixed(2)} (${l.status})`).join("\n") || "- Nenhum lançamento"}

⚠️ LANÇAMENTOS ATRASADOS (${atrasados.length}):
${atrasados.slice(0, 5).map((l: any) => `- ${l.data_vencimento}: ${l.cliente_credor} - R$ ${Number(l.valor).toFixed(2)} (${l.tipo})`).join("\n") || "- Nenhum atraso"}
`;

    const systemPrompt = `Você é um assistente financeiro inteligente especializado em análise de dados financeiros. 
Você tem acesso aos dados financeiros reais do usuário e deve fornecer insights, análises e recomendações baseadas nesses dados.

SUAS CAPACIDADES:
1. Analisar receitas e despesas
2. Identificar padrões de gastos
3. Alertar sobre contas atrasadas
4. Sugerir melhorias na gestão financeira
5. Responder perguntas sobre a situação financeira
6. Fornecer insights sobre fluxo de caixa
7. Comparar períodos e identificar tendências

REGRAS:
- Sempre baseie suas respostas nos dados fornecidos
- Seja objetivo e claro nas análises
- Use formatação com markdown quando apropriado (negrito, listas, etc)
- Forneça insights acionáveis
- Se não tiver dados suficientes para uma análise, informe isso claramente
- Valores monetários devem estar em R$ (Reais)
- Datas no formato brasileiro (DD/MM/YYYY)

${financialContext}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
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

    return new Response(response.body, {
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
