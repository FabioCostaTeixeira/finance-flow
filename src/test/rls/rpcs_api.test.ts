import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { createAdminClient, seedTenant, cleanup } from "./helpers";

describe("RPCs Transacionais da API Externa", () => {
  const admin = createAdminClient();
  let tenantA: string;
  let tenantB: string;
  let bancoA1: string;
  let bancoA2: string;
  let bancoB: string;
  let lancamentoA: string;

  const tenantIds: string[] = [];

  beforeAll(async () => {
    const seededA = await seedTenant(admin, "RPC Test Tenant A");
    const seededB = await seedTenant(admin, "RPC Test Tenant B");
    tenantA = seededA.tenantId;
    tenantB = seededB.tenantId;
    tenantIds.push(tenantA, tenantB);

    const { data: bA1 } = await admin.from("bancos").insert({
      tenant_id: tenantA,
      nome: `Banco Origem A ${randomUUID().slice(0, 5)}`,
    }).select("id").single();
    bancoA1 = bA1!.id;

    const { data: bA2 } = await admin.from("bancos").insert({
      tenant_id: tenantA,
      nome: `Banco Destino A ${randomUUID().slice(0, 5)}`,
    }).select("id").single();
    bancoA2 = bA2!.id;

    const { data: bB } = await admin.from("bancos").insert({
      tenant_id: tenantB,
      nome: `Banco Tenant B ${randomUUID().slice(0, 5)}`,
    }).select("id").single();
    bancoB = bB!.id;

    const { data: lA } = await admin.from("lancamentos").insert({
      tenant_id: tenantA,
      tipo: "receita",
      status: "a_receber",
      cliente_credor: "Devedor Fiel",
      valor: 1000,
      data_vencimento: "2026-12-01",
      banco_id: bancoA1,
    }).select("id").single();
    lancamentoA = lA!.id;
  });

  afterAll(async () => {
    await cleanup(admin, [], tenantIds);
  });

  describe("rpc_baixar_lancamento", () => {
    it("executa baixa parcial com sucesso", async () => {
      const { data, error } = await admin.rpc("rpc_baixar_lancamento", {
        p_tenant_id: tenantA,
        p_lancamento_id: lancamentoA,
        p_valor_pago: 400,
      });

      expect(error).toBeNull();
      expect(data).toMatchObject({
        success: true,
        status: "parcial",
        valor_original: 1000,
        valor_pago: 400,
      });
    });

    it("bloqueia tentativa de liquidação com tenant inválido/diferente", async () => {
      const { error } = await admin.rpc("rpc_baixar_lancamento", {
        p_tenant_id: tenantB, // tentando liquidar lançamento do Tenant A com a key/tenant B
        p_lancamento_id: lancamentoA,
        p_valor_pago: 600,
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain("não pertence ao tenant");
    });
  });

  describe("rpc_criar_transferencia", () => {
    it("executa transferência atômica entre bancos do mesmo tenant", async () => {
      const { data, error } = await admin.rpc("rpc_criar_transferencia", {
        p_tenant_id: tenantA,
        p_banco_origem_id: bancoA1,
        p_banco_destino_id: bancoA2,
        p_valor: 250,
      });

      expect(error).toBeNull();
      expect(data).toMatchObject({
        success: true,
        valor: 250,
      });
      expect(data.saida_id).toBeDefined();
      expect(data.entrada_id).toBeDefined();
    });

    it("rejeita transferência cross-tenant quando banco de destino pertence a outro tenant", async () => {
      const { error } = await admin.rpc("rpc_criar_transferencia", {
        p_tenant_id: tenantA,
        p_banco_origem_id: bancoA1,
        p_banco_destino_id: bancoB, // banco do tenant B
        p_valor: 100,
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain("não pertence ao tenant");
    });
  });
});
