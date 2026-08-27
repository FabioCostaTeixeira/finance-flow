import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const VALID_ROLES = ['master', 'admin', 'user'] as const;
type Role = typeof VALID_ROLES[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DIACRITICS_RE = new RegExp('[\\u0300-\\u036f]', 'g');

function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD').replace(DIACRITICS_RE, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('origin'));
  const out = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return out({ error: 'Não autorizado' }, 401);

    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) return out({ error: 'Não autorizado: token inválido' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: operatorRow } = await admin
      .from('platform_operators')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!operatorRow) return out({ error: 'Acesso restrito a operadores de plataforma' }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string | undefined;

    switch (action) {
      case 'whoami': {
        return out({ isOperator: true, userId: user.id, email: user.email }, 200);
      }

      case 'list_tenants': {
        const { data, error } = await admin
          .from('tenants')
          .select('id, nome, slug, plano, ativo, created_at')
          .order('created_at', { ascending: false });
        if (error) return out({ error: error.message }, 500);
        return out({ tenants: data }, 200);
      }

      case 'create_tenant': {
        const nome = (body.nome as string | undefined)?.trim();
        const slugRaw = (body.slug as string | undefined)?.trim();
        if (!nome || !slugRaw) return out({ error: 'Nome e slug são obrigatórios' }, 400);
        const slug = sanitizeSlug(slugRaw);
        if (!slug) return out({ error: 'Slug inválido' }, 400);
        const { data, error } = await admin
          .from('tenants')
          .insert({ nome, slug })
          .select('id, nome, slug, plano, ativo, created_at')
          .single();
        if (error) return out({ error: error.code === '23505' ? 'Já existe um tenant com esse slug' : error.message }, 400);
        return out({ tenant: data }, 200);
      }

      case 'update_tenant': {
        const tenantId = body.tenant_id as string | undefined;
        const nome = (body.nome as string | undefined)?.trim();
        const slugRaw = (body.slug as string | undefined)?.trim();
        if (!tenantId || (!nome && !slugRaw)) return out({ error: 'tenant_id e nome/slug são obrigatórios' }, 400);

        const updates: Record<string, string> = {};
        if (nome) updates.nome = nome;
        if (slugRaw) {
          const slug = sanitizeSlug(slugRaw);
          if (!slug) return out({ error: 'Slug inválido' }, 400);
          updates.slug = slug;
        }

        const { data, error } = await admin
          .from('tenants')
          .update(updates)
          .eq('id', tenantId)
          .select('id, nome, slug, plano, ativo, created_at')
          .single();
        if (error) return out({ error: error.code === '23505' ? 'Já existe um tenant com esse slug' : error.message }, 400);
        return out({ tenant: data }, 200);
      }

      case 'toggle_tenant_ativo': {
        const tenantId = body.tenant_id as string | undefined;
        const ativo = body.ativo as boolean | undefined;
        if (!tenantId || typeof ativo !== 'boolean') return out({ error: 'Dados incompletos' }, 400);
        const { data, error } = await admin
          .from('tenants')
          .update({ ativo })
          .eq('id', tenantId)
          .select('id, nome, slug, plano, ativo, created_at')
          .single();
        if (error) return out({ error: error.message }, 400);
        return out({ tenant: data }, 200);
      }

      case 'list_members': {
        const tenantId = body.tenant_id as string | undefined;
        if (!tenantId) return out({ error: 'tenant_id é obrigatório' }, 400);
        const { data: members, error } = await admin
          .from('tenant_members')
          .select('user_id, role, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: true });
        if (error) return out({ error: error.message }, 500);
        const userIds = (members ?? []).map((m) => m.user_id);
        let profilesById: Record<string, { email: string | null; nome: string | null }> = {};
        if (userIds.length > 0) {
          const { data: profiles, error: profilesError } = await admin
            .from('profiles')
            .select('user_id, email, nome')
            .in('user_id', userIds);
          if (profilesError) return out({ error: profilesError.message }, 500);
          profilesById = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, { email: p.email, nome: p.nome }]));
        }
        const result = (members ?? []).map((m) => ({
          user_id: m.user_id,
          role: m.role,
          created_at: m.created_at,
          email: profilesById[m.user_id]?.email ?? null,
          nome: profilesById[m.user_id]?.nome ?? null,
        }));
        return out({ members: result }, 200);
      }

      case 'add_member': {
        const tenantId = body.tenant_id as string | undefined;
        const email = (body.email as string | undefined)?.trim().toLowerCase();
        const role = body.role as string | undefined;
        if (!tenantId || !email || !role) return out({ error: 'Dados incompletos' }, 400);
        if (!EMAIL_RE.test(email)) return out({ error: 'Email inválido' }, 400);
        if (!VALID_ROLES.includes(role as Role)) return out({ error: 'Role inválida' }, 400);

        const { data: tenant } = await admin.from('tenants').select('id').eq('id', tenantId).maybeSingle();
        if (!tenant) return out({ error: 'Tenant não encontrado' }, 404);

        let userId: string | undefined;

        // 1. Busca na tabela profiles primeiro
        const { data: existingProfile } = await admin
          .from('profiles')
          .select('user_id')
          .eq('email', email)
          .maybeSingle();

        if (existingProfile?.user_id) {
          userId = existingProfile.user_id;
        } else {
          // Detecta a URL pública da aplicação a partir dos cabeçalhos da requisição
          const originHeader = req.headers.get('origin') || req.headers.get('referer');
          let siteUrl = 'https://finance-flow-supabase.vercel.app';
          if (originHeader) {
            try {
              const parsed = new URL(originHeader);
              if (!parsed.hostname.includes('localhost') && !parsed.hostname.includes('127.0.0.1')) {
                siteUrl = parsed.origin;
              }
            } catch {
              // fallback para vercel
            }
          }
          const redirectTo = siteUrl + '/auth';

          // 2. Se não achou no profiles, tenta criar/enviar convite por email com a URL de produção
          const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
            redirectTo,
          });

          if (inviteError) {
            if (inviteError.message?.toLowerCase().includes('already') || inviteError.message?.toLowerCase().includes('registered')) {
              const { data: userList, error: listError } = await admin.auth.admin.listUsers();
              if (listError) return out({ error: inviteError.message }, 400);

              const foundUser = userList?.users?.find((u) => u.email?.toLowerCase() === email);
              if (foundUser) {
                userId = foundUser.id;
              } else {
                return out({ error: inviteError.message }, 400);
              }
            } else {
              return out({ error: inviteError.message }, 400);
            }
          } else {
            userId = invited.user.id;
          }
        }

        const { error: memberError } = await admin
          .from('tenant_members')
          .insert({ tenant_id: tenantId, user_id: userId, role });
        if (memberError) {
          return out({ error: memberError.code === '23505' ? 'Usuário já é membro deste tenant' : memberError.message }, 400);
        }
        return out({ success: true, userId }, 200);
      }

      case 'update_member_role': {
        const tenantId = body.tenant_id as string | undefined;
        const userId = body.user_id as string | undefined;
        const role = body.role as string | undefined;
        if (!tenantId || !userId || !role) return out({ error: 'Dados incompletos' }, 400);
        if (!VALID_ROLES.includes(role as Role)) return out({ error: 'Role inválida' }, 400);
        const { error } = await admin
          .from('tenant_members')
          .update({ role })
          .eq('tenant_id', tenantId)
          .eq('user_id', userId);
        if (error) return out({ error: error.message }, 400);
        return out({ success: true }, 200);
      }

      case 'remove_member': {
        const tenantId = body.tenant_id as string | undefined;
        const userId = body.user_id as string | undefined;
        if (!tenantId || !userId) return out({ error: 'Dados incompletos' }, 400);
        const { error } = await admin
          .from('tenant_members')
          .delete()
          .eq('tenant_id', tenantId)
          .eq('user_id', userId);
        if (error) return out({ error: error.message }, 400);
        return out({ success: true }, 200);
      }

      default:
        return out({ error: 'Ação desconhecida' }, 400);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno do servidor';
    return out({ error: msg }, 500);
  }
});
