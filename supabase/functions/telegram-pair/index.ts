// Gera um token de pareamento curto para o usuário vincular o Telegram dele.
// Frontend chama essa função (com auth do usuário); ela cria/atualiza o registro em messaging_channels.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders as getCorsHeaders } from '../_shared/cors.ts';

function generateToken(): string {
  // 8 caracteres alfanuméricos legíveis
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get('Authorization');
    if (!auth) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
    const accessToken = auth.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(accessToken);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = claimsData.claims.sub as string;
    const { tenantId } = await req.clone().json().catch(() => ({ tenantId: null }));
    if (!tenantId) return new Response(JSON.stringify({ error: 'tenantId é obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: membership } = await admin.from('tenant_members').select('tenant_id').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
    if (!membership) return new Response(JSON.stringify({ error: 'Usuário não pertence a esta organização' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Revoga pares pendentes anteriores deste usuário
    await admin
      .from('messaging_channels')
      .delete()
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('channel_type', 'telegram')
      .eq('status', 'pending');

    const pairingToken = generateToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    const { data, error } = await admin
      .from('messaging_channels')
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        channel_type: 'telegram',
          pairing_token: pairingToken,
        pairing_expires_at: expiresAt.toISOString(),
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ token: pairingToken, expires_at: expiresAt.toISOString(), id: data.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro';
    console.error('telegram-pair error:', msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
