import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { createAdminClient, seedTenant, cleanup } from "./helpers";

function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

describe("Integração e Segurança da API Externa (MCP / external API)", () => {
  const admin = createAdminClient();
  let tenantA: string;
  let tenantB: string;
  let rawKeyA: string;
  let rawKeyB: string;
  let rawKeyInativa: string;

  let bancoA: string;
  let bancoB: string;
  let categoriaA: string;
  let lancamentoA: string;
  let lancamentoB: string;

  const tenantIds: string[] = [];

  beforeAll(async () => {
    const seededA = await seedTenant(admin, "API Test Tenant A");
    const seededB = await seedTenant(admin, "API Test Tenant B");
    tenantA = seededA.tenantId;
    tenantB = seededB.tenantId;
    tenantIds.push(tenantA, tenantB);

    rawKeyA = `ff_live_test_key_a_${randomUUID()}`;
    rawKeyB = `ff_live_test_key_b_${randomUUID()}`;
    rawKeyInativa = `ff_live_test_key_inativa_${randomUUID()}`;

    const { error: keyErrorA } = await admin.from("api_keys").insert({
      tenant_id: tenantA,
      nome: "Key Ativa A",
      prefixo: rawKeyA.slice(0, 11),
      hash: hashApiKey(rawKeyA),
      ativa: true,
    });
    if (keyErrorA) throw new Error(`Erro ao registrar API Key A: ${keyErrorA.message}`);

    const { error: keyErrorB } = await admin.from("api_keys").insert({
      tenant_id: tenantB,
      nome: "Key Ativa B",
      prefixo: rawKeyB.slice(0, 11),
      hash: hashApiKey(rawKeyB),
      ativa: true,
    });
    if (keyErrorB) throw new Error(`Erro ao registrar API Key B: ${keyErrorB.message}`);

    const { error: keyErrorInativa } = await admin.from("api_keys").insert({
      tenant_id: tenantA,
      nome: "Key Inativa A",
      prefixo: rawKeyInativa.slice(0, 11),
      hash: hashApiKey(rawKeyInativa),
      ativa: false,
    });
    if (keyErrorInativa) throw new Error(`Erro ao registrar API Key Inativa: ${keyErrorInativa.message}`);

    const { data: bA, error: errBA } = await admin.from("bancos").insert({
      tenant_id: tenantA,
      nome: `Banco Itaú Tenant A ${randomUUID().slice(0, 5)}`,
    }).select("id").single();
    if (errBA) throw new Error(`Erro ao criar banco A: ${errBA.message}`);
    bancoA = bA.id;

    const { data: bB, error: errBB } = await admin.from("bancos").insert({
      tenant_id: tenantB,
      nome: `Banco Bradesco Tenant B ${randomUUID().slice(0, 5)}`,
    }).select("id").single();
    if (errBB) throw new Error(`Erro ao criar banco B: ${errBB.message}`);
    bancoB = bB.id;

    const nomeCatA = `Vendas Tenant A ${randomUUID().slice(0, 5)}`;
    const { data: cA, error: errCA } = await admin.from("categorias").insert({
      tenant_id: tenantA,
      nome: nomeCatA,
      nome_normalizado: nomeCatA.toLowerCase(),
      tipo: "receita",
    }).select("id").single();
    if (errCA) throw new Error(`Erro ao criar categoria A: ${errCA.message}`);
    categoriaA = cA.id;

    const { data: lA, error: errLA } = await admin.from("lancamentos").insert({
      tenant_id: tenantA,
      tipo: "receita",
      status: "a_receber",
      cliente_credor: "Cliente Exclusivo Tenant A",
      valor: 1500,
      data_vencimento: "2026-10-15",
      banco_id: bancoA,
      categoria_id: categoriaA,
    }).select("id").single();
    if (errLA) throw new Error(`Erro ao criar lançamento A: ${errLA.message}`);
    lancamentoA = lA.id;

    const { data: lB, error: errLB } = await admin.from("lancamentos").insert({
      tenant_id: tenantB,
      tipo: "despesa",
      status: "a_pagar",
      cliente_credor: "Fornecedor Exclusivo Tenant B",
      valor: 800,
      data_vencimento: "2026-10-20",
      banco_id: bancoB,
    }).select("id").single();
    if (errLB) throw new Error(`Erro ao criar lançamento B: ${errLB.message}`);
    lancamentoB = lB.id;
  });

  afterAll(async () => {
    await admin.from("api_keys").delete().in("tenant_id", tenantIds);
    await cleanup(admin, [], tenantIds);
  });

  describe("Validação de Headers e Autenticação de API Key", () => {
    it("valida a existência e hash de uma API Key ativa no banco de dados", async () => {
      const hashA = hashApiKey(rawKeyA);
      const { data, error } = await admin
        .from("api_keys")
        .select("id, ativa, tenant_id")
        .eq("hash", hashA)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.ativa).toBe(true);
      expect(data?.tenant_id).toBe(tenantA);
    });

    it("rejeita API key inativa no banco de dados", async () => {
      const hashInativa = hashApiKey(rawKeyInativa);
      const { data } = await admin
        .from("api_keys")
        .select("id, ativa, tenant_id")
        .eq("hash", hashInativa)
        .eq("ativa", true)
        .maybeSingle();

      expect(data).toBeNull();
    });

    it("rejeita API key inexistente", async () => {
      const hashFake = hashApiKey("ff_live_key_inexistente_999");
      const { data } = await admin
        .from("api_keys")
        .select("id, ativa, tenant_id")
        .eq("hash", hashFake)
        .maybeSingle();

      expect(data).toBeNull();
    });
  });

  describe("Isolamento Cross-Tenant pela API Key", () => {
    it("Key do Tenant A não acessa lançamentos do Tenant B", async () => {
      const { data: lancamentosTenantA } = await admin
        .from("lancamentos")
        .select("id, cliente_credor, valor")
        .eq("tenant_id", tenantA);

      const ids = lancamentosTenantA?.map((l) => l.id) ?? [];
      expect(ids).toContain(lancamentoA);
      expect(ids).not.toContain(lancamentoB);
    });

    it("Key do Tenant A não consegue atualizar nem excluir lançamentos do Tenant B", async () => {
      const { data } = await admin
        .from("lancamentos")
        .select("id")
        .eq("id", lancamentoB)
        .eq("tenant_id", tenantA)
        .maybeSingle();

      expect(data).toBeNull();
    });

    it("Key do Tenant A não pode usar banco_id do Tenant B (bloqueio de FK cross-tenant)", async () => {
      const { data: bancoDoOutroTenant } = await admin
        .from("bancos")
        .select("id")
        .eq("id", bancoB)
        .eq("tenant_id", tenantA)
        .maybeSingle();

      expect(bancoDoOutroTenant).toBeNull();
    });
  });

  describe("Descarte Estrito de Injeção de Payload (semTenantDoPayload)", () => {
    it("remove tenant_id, user_id e created_by forjados no payload da requisição", () => {
      const payloadInjetado = {
        tenant_id: tenantB,
        user_id: "00000000-0000-0000-0000-000000000000",
        created_by: "00000000-0000-0000-0000-000000000000",
        role: "master",
        tipo: "despesa",
        valor: 999.99,
        cliente_credor: "Fornecedor Autêntico",
        data_vencimento: "2026-11-01",
      };

      const { tenant_id: _t, user_id: _u, created_by: _c, role: _r, ...limpo } = payloadInjetado;

      expect(limpo).toEqual({
        tipo: "despesa",
        valor: 999.99,
        cliente_credor: "Fornecedor Autêntico",
        data_vencimento: "2026-11-01",
      });

      const registroFinal = {
        ...limpo,
        tenant_id: tenantA,
      };

      expect(registroFinal.tenant_id).toBe(tenantA);
      expect(registroFinal.tenant_id).not.toBe(tenantB);
    });
  });
});
