import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_TEST_URL!;
const ANON = process.env.SUPABASE_TEST_ANON_KEY!;
const SERVICE = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY!;

/** Cliente com service role: ignora RLS. Usado só para preparar e limpar cenário. */
export function createAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Cliente autenticado como um usuário real. Sujeito a RLS, como o app. */
export async function createUserClient(
  email: string,
  password: string
): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Falha ao autenticar ${email}: ${error.message}`);
  return client;
}

export async function seedTenant(admin: SupabaseClient, nome: string) {
  const slug = `${nome.toLowerCase().replace(/\s+/g, "-")}-${randomUUID().slice(0, 8)}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await admin.from("tenants").insert({ nome, slug }).select("id").single();
    if (!error) return { tenantId: data.id as string };
    if (error.code !== "PGRST002" || attempt === 4) throw new Error(`Falha ao criar tenant: ${error.message} [${error.code ?? ''}] ${error.details ?? ''}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Falha ao criar tenant: retries esgotados");
}

export async function createMember(
  admin: SupabaseClient,
  tenantId: string,
  email: string,
  role: "master" | "admin" | "user"
) {
  const password = `Test-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`Falha ao criar usuário ${email}: ${error.message}`);
  const userId = data.user.id;

  const { error: memberError } = await admin
    .from("tenant_members")
    .insert({ tenant_id: tenantId, user_id: userId, role });
  if (memberError) throw new Error(`Falha ao vincular membro: ${memberError.message}`);

  return { userId, password };
}

/** Cria um usuário fora de qualquer tenant, registrado como operador de plataforma. */
export async function createOperator(admin: SupabaseClient, email: string) {
  const password = `Test-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`Falha ao criar operador: ${error.message}`);
  const userId = data.user.id;

  const { error: opError } = await admin
    .from("platform_operators")
    .insert({ user_id: userId });
  if (opError) throw new Error(`Falha ao registrar operador: ${opError.message}`);

  return { userId, password, email };
}

export async function cleanup(
  admin: SupabaseClient,
  userIds: string[],
  tenantIds: string[]
) {
  const validUserIds = userIds.filter(Boolean);
  const validTenantIds = tenantIds.filter(Boolean);

  for (const id of validTenantIds) {
    const { error: lancamentosError } = await admin
      .from("lancamentos")
      .delete()
      .eq("tenant_id", id);
    if (lancamentosError) {
      console.warn(`Falha ao limpar lancamentos do tenant ${id}: ${lancamentosError.message}`);
    }

    const { error: bancosError } = await admin
      .from("bancos")
      .delete()
      .eq("tenant_id", id);
    if (bancosError) {
      console.warn(`Falha ao limpar bancos do tenant ${id}: ${bancosError.message}`);
    }

    const { error: categoriasError } = await admin
      .from("categorias")
      .delete()
      .eq("tenant_id", id);
    if (categoriasError) {
      console.warn(`Falha ao limpar categorias do tenant ${id}: ${categoriasError.message}`);
    }

    const { error: membersError } = await admin
      .from("tenant_members")
      .delete()
      .eq("tenant_id", id);
    if (membersError) {
      console.warn(`Falha ao limpar tenant_members do tenant ${id}: ${membersError.message}`);
    }
  }

  if (validUserIds.length > 0) {
    const { error: operatorsError } = await admin
      .from("platform_operators")
      .delete()
      .in("user_id", validUserIds);
    if (operatorsError) {
      console.warn(`Falha ao limpar platform_operators: ${operatorsError.message}`);
    }
  }

  for (const id of validUserIds) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) {
      console.warn(`Falha ao apagar usuário ${id}: ${error.message}`);
    }
  }

  for (const id of validTenantIds) {
    const { error } = await admin.from("tenants").delete().eq("id", id);
    if (error) {
      console.warn(`Falha ao apagar tenant ${id}: ${error.message}`);
    }
  }
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}@rls-test.local`;
}
