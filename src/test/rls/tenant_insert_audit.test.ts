import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SupabaseClient } from "@supabase/supabase-js";
import { cleanup, createAdminClient, createMember, createUserClient, seedTenant, uniqueEmail } from "./helpers";

describe("inserts explícitos e auditoria por tenant", () => {
  const admin = createAdminClient();
  let tenantA: string, tenantB: string, userA: string, clientA: SupabaseClient;
  beforeAll(async () => {
    tenantA = (await seedTenant(admin, "Insert A")).tenantId;
    tenantB = (await seedTenant(admin, "Insert B")).tenantId;
    const member = await createMember(admin, tenantA, uniqueEmail("insert-a"), "master");
    userA = member.userId;
    const email = (await admin.auth.admin.getUserById(userA)).data.user!.email!;
    clientA = await createUserClient(email, member.password);
  });
  afterAll(() => cleanup(admin, [userA], [tenantA, tenantB]));

  it("recusa plantar bancos em tenant alheio", async () => {
    const banco = await clientA.from("bancos").insert({ tenant_id: tenantB, nome: "Banco alheio" });
    expect(banco.error).not.toBeNull();
  });

  it("gera uma única auditoria tenant-scoped e não expõe a tabela legada", async () => {
    const before = await admin.from("audit_log").select("id", { count: "exact", head: true }).eq("tenant_id", tenantA);
    const inserted = await admin.from("bancos").insert({ tenant_id: tenantA, nome: "Banco auditado" }).select("id").single();
    expect(inserted.error).toBeNull();
    const after = await admin.from("audit_log").select("id", { count: "exact", head: true }).eq("tenant_id", tenantA);
    expect((after.count ?? 0) - (before.count ?? 0)).toBe(1);
    const legacy = await clientA.from("lancamentos_audit").select("id");
    expect(legacy.data).toEqual([]);
  });
});
