import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get API key from header
    const apiKey = req.headers.get("x-api-key");
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API key is required. Add X-API-Key header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate API key
    const { data: keyData, error: keyError } = await supabase
      .from("api_keys")
      .select("id, ativa")
      .eq("chave", apiKey)
      .single();

    if (keyError || !keyData) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!keyData.ativa) {
      return new Response(
        JSON.stringify({ error: "API key is inactive" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse URL to get endpoint
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const endpoint = pathParts[pathParts.length - 1] || "lancamentos";

    // Get request metadata for logging
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    let responseStatus = 200;
    let responseData: any;

    try {
      if (endpoint === "lancamentos") {
        // Fetch lancamentos with related data
        const { data, error } = await supabase
          .from("lancamentos_bi")
          .select("*")
          .order("data_vencimento", { ascending: false });

        if (error) throw error;
        responseData = data;
      } else if (endpoint === "categorias") {
        const { data, error } = await supabase
          .from("categorias")
          .select("*")
          .order("nome");

        if (error) throw error;
        responseData = data;
      } else if (endpoint === "bancos") {
        const { data, error } = await supabase
          .from("bancos")
          .select("*")
          .order("nome");

        if (error) throw error;
        responseData = data;
      } else if (endpoint === "resumo") {
        // Financial summary
        const { data: lancamentos, error } = await supabase
          .from("lancamentos")
          .select("*");

        if (error) throw error;

        const receitas = lancamentos?.filter(l => l.tipo === "receita") || [];
        const despesas = lancamentos?.filter(l => l.tipo === "despesa") || [];

        responseData = {
          total_receitas: receitas.reduce((sum, l) => sum + (l.valor || 0), 0),
          total_despesas: despesas.reduce((sum, l) => sum + (l.valor || 0), 0),
          total_recebido: receitas.filter(l => l.status === "recebido").reduce((sum, l) => sum + (l.valor_pago || 0), 0),
          total_pago: despesas.filter(l => l.status === "pago").reduce((sum, l) => sum + (l.valor_pago || 0), 0),
          a_receber: receitas.filter(l => l.status === "a_receber").reduce((sum, l) => sum + (l.valor || 0), 0),
          a_pagar: despesas.filter(l => l.status === "a_pagar").reduce((sum, l) => sum + (l.valor || 0), 0),
          quantidade_lancamentos: lancamentos?.length || 0,
        };
      } else {
        responseStatus = 404;
        responseData = { 
          error: "Endpoint not found",
          available_endpoints: ["lancamentos", "categorias", "bancos", "resumo"]
        };
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      responseStatus = 500;
      responseData = { error: "Internal server error" };
    }

    // Log access
    await supabase.from("api_access_logs").insert({
      api_key_id: keyData.id,
      endpoint,
      ip_address: ipAddress,
      user_agent: userAgent,
      response_status: responseStatus,
    });

    // Update last access
    await supabase
      .from("api_keys")
      .update({ ultimo_acesso: new Date().toISOString() })
      .eq("id", keyData.id);

    return new Response(
      JSON.stringify(responseData),
      { 
        status: responseStatus, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("API Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
