import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req.headers.get('origin'));
  const out = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string | undefined;

    if (action === 'first_access') {
      const email = (body.email as string | undefined)?.trim().toLowerCase();
      const password = body.password as string | undefined;

      if (!email || !password) {
        return out({ error: 'Email e senha são obrigatórios' }, 400);
      }

      if (password.length < 6) {
        return out({ error: 'A senha deve ter no mínimo 6 caracteres' }, 400);
      }

      // 1. Busca o usuário por email no Supabase Auth
      const { data: userList, error: listError } = await admin.auth.admin.listUsers();
      if (listError) return out({ error: 'Erro ao consultar cadastros' }, 500);

      const foundUser = userList?.users?.find((u) => u.email?.toLowerCase() === email);
      if (!foundUser) {
        return out({ error: 'E-mail não cadastrado no sistema. Solicite o cadastro ao seu administrador.' }, 404);
      }

      // 2. Atualiza a senha e confirma o e-mail diretamente via Admin SDK (sem disparo de e-mail)
      const { error: updateError } = await admin.auth.admin.updateUserById(foundUser.id, {
        password: password,
        email_confirm: true,
      });

      if (updateError) {
        return out({ error: updateError.message }, 400);
      }

      return out({ success: true, message: 'Senha cadastrada com sucesso!' }, 200);
    }

    return out({ error: 'Ação inválida' }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno do servidor';
    return out({ error: msg }, 500);
  }
});