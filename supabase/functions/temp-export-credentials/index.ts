import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = {
      SUPABASE_URL: Deno.env.get("SUPABASE_URL") ?? null,
      SUPABASE_DB_URL: Deno.env.get("SUPABASE_DB_URL") ?? null,
      SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY") ?? null,
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? null,
      SUPABASE_PUBLISHABLE_KEY: Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? null,
      generated_at: new Date().toISOString(),
      warning: "TEMPORARY ENDPOINT - DELETE IMMEDIATELY AFTER USE",
    };

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});