import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  createAdminClient,
  createUserClient,
  seedTenant,
  createMember,
  cleanup,
  uniqueEmail,
} from "./helpers";

describe("isolamento entre tenants", () => {
  const admin = createAdminClient();
  let tenantA: string;
  let tenantB: string;
  let clienteA: SupabaseClient;
  let clienteB: SupabaseClient;
  let userIds: string[] = [];
  let lancamentoA: string;

  beforeAll(async () => {
    tenantA = (await seedTenant(admin, "Tenant A")).tenantId;
    tenantB = (await seedTenant(admin, "Tenant B")).tenantId;

    const emailA = uniqueEmail("master-a");
    const emailB = uniqueEmail("master-b");
    const a = await createMember(admin, tenantA, emailA, "master");
    const b = await createMember(admin, tenantB, emailB, "master");
    userIds = [a.userId, b.userId];

    const { data, error } = await admin
      .from("lancamentos")
      .insert({
        tenant_id: tenantA,
        tipo: "receita",
        status: "a_receber",
        cliente_credor: "Cliente Secreto do Tenant A",
        valor: 4242.42,
        data_vencimento: "2026-09-01",
      })
      .select("id")
      .single();
    if (error) throw error;
    lancamentoA = data.id;

    clienteA = await createUserClient(emailA, a.password);
    clienteB = await createUserClient(emailB, b.password);
  });

  afterAll(async () => {
    await cleanup(admin, userIds, [tenantA, tenantB]);
  });

  it("o dono enxerga o próprio lançamento", async () => {
    const { data, error } = await clienteA
      .from("lancamentos")
      .select("id, cliente_credor")
      .eq("id", lancamentoA);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].cliente_credor).toBe("Cliente Secreto do Tenant A");
  });

  it("o master de outro tenant NÃO enxerga o lançamento", async () => {
    const { data, error } = await clienteB
      .from("lancamentos")
      .select("id")
      .eq("id", lancamentoA);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("o master de outro tenant não enxerga lançamento algum do tenant A", async () => {
    const { data } = await clienteB
      .from("lancamentos")
      .select("id")
      .eq("tenant_id", tenantA);

    expect(data).toHaveLength(0);
  });

  it("o master de outro tenant NÃO consegue apagar o lançamento", async () => {
    await clienteB.from("lancamentos").delete().eq("id", lancamentoA);

    const { data } = await admin
      .from("lancamentos")
      .select("id")
      .eq("id", lancamentoA);
    expect(data).toHaveLength(1);
  });

  it("o master de outro tenant NÃO consegue escrever no tenant A", async () => {
    const { error } = await clienteB.from("lancamentos").insert({
      tenant_id: tenantA,
      tipo: "despesa",
      status: "a_pagar",
      cliente_credor: "Invasor",
      valor: 1,
      data_vencimento: "2026-09-01",
    });

    expect(error).not.toBeNull();
    const isRlsDenial =
      error?.code === "42501" ||
      error?.message?.toLowerCase().includes("row-level security");
    expect(isRlsDenial).toBe(true);

    const { data } = await admin
      .from("lancamentos")
      .select("id")
      .eq("tenant_id", tenantA)
      .eq("cliente_credor", "Invasor");
    expect(data).toHaveLength(0);
  });
});
