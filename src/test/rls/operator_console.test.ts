import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  createAdminClient,
  createUserClient,
  seedTenant,
  createMember,
  createOperator,
  cleanup,
  uniqueEmail,
} from "./helpers";

/**
 * Console de operador: prova, no nível de banco, que um usuário comum (não
 * operador) não consegue ler platform_operators nem tenant_members de um
 * tenant que não é seu — via client autenticado direto, sem passar pela
 * edge function. Isso garante que mesmo com um bug na function, a RLS já
 * bloqueia o acesso.
 */
describe("console de operador — RLS de defesa em profundidade", () => {
  const admin = createAdminClient();
  let tenantA: string;
  let tenantB: string;
  let clienteA: SupabaseClient;
  let userIds: string[] = [];

  beforeAll(async () => {
    tenantA = (await seedTenant(admin, "Operador Console A")).tenantId;
    tenantB = (await seedTenant(admin, "Operador Console B")).tenantId;

    const emailA = uniqueEmail("user-a");
    const a = await createMember(admin, tenantA, emailA, "user");
    const b = await createMember(admin, tenantB, uniqueEmail("user-b"), "user");
    const op = await createOperator(admin, uniqueEmail("op-console"));
    userIds = [a.userId, b.userId, op.userId];

    clienteA = await createUserClient(emailA, a.password);
  });

  afterAll(() => cleanup(admin, userIds, [tenantA, tenantB]));

  it("usuário comum não lê platform_operators", async () => {
    const { data, error } = await clienteA.from("platform_operators").select("user_id");
    // RLS habilitada sem policy para authenticated, mais o REVOKE explícito:
    // ou nega com erro de permissão, ou simplesmente não retorna nenhuma linha.
    if (error) {
      expect(error.code === "42501" || /permission denied/i.test(error.message)).toBe(true);
    } else {
      expect(data).toHaveLength(0);
    }
  });

  it("usuário comum não lê tenant_members de um tenant que não é seu", async () => {
    const { data, error } = await clienteA
      .from("tenant_members")
      .select("user_id, role")
      .eq("tenant_id", tenantB);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("usuário comum não vê o tenant B na lista de tenants", async () => {
    const { data } = await clienteA.from("tenants").select("id").eq("id", tenantB);
    expect(data).toHaveLength(0);
  });
});
