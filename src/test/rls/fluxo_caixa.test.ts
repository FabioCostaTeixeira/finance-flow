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

/**
 * A tela de Fluxo de Caixa lê `lancamentos` linha a linha (histórico de
 * entradas e saídas), não um agregado mensal. Isso só é seguro porque a policy
 * `lancamentos_select` concede SELECT a quem tem o módulo 'fluxo-caixa', mesmo
 * sem os módulos 'receitas'/'despesas'.
 *
 * Estes testes travam essa premissa: se alguém restringir a policy de novo, a
 * tela volta a ficar vazia para usuários só-fluxo-caixa — e o teste quebra
 * antes de chegar em produção.
 */
describe("fluxo de caixa: leitura detalhada por módulo", () => {
  const admin = createAdminClient();
  let tenantId: string;
  let outroTenantId: string;
  let clienteFluxo: SupabaseClient;
  let userIds: string[] = [];

  beforeAll(async () => {
    tenantId = (await seedTenant(admin, "Tenant Fluxo")).tenantId;
    outroTenantId = (await seedTenant(admin, "Tenant Alheio")).tenantId;

    const email = uniqueEmail("user-fluxo");
    const membro = await createMember(admin, tenantId, email, "user");
    userIds = [membro.userId];

    // Só o módulo de fluxo de caixa: nada de receitas nem despesas.
    await admin.from("user_permissions").insert({
      tenant_id: tenantId,
      user_id: membro.userId,
      module_key: "fluxo-caixa",
      allowed: true,
    });

    await admin.from("lancamentos").insert([
      {
        tenant_id: tenantId,
        tipo: "receita",
        status: "recebido",
        cliente_credor: "Entrada do mês",
        valor: 500,
        valor_pago: 500,
        data_vencimento: "2026-09-10",
        data_pagamento: "2026-09-10",
      },
      {
        tenant_id: tenantId,
        tipo: "despesa",
        status: "a_pagar",
        cliente_credor: "Saída do mês",
        valor: 200,
        data_vencimento: "2026-09-20",
      },
      {
        tenant_id: outroTenantId,
        tipo: "receita",
        status: "recebido",
        cliente_credor: "Receita de outro tenant",
        valor: 999,
        valor_pago: 999,
        data_vencimento: "2026-09-15",
        data_pagamento: "2026-09-15",
      },
    ]);

    clienteFluxo = await createUserClient(email, membro.password);
  });

  afterAll(async () => {
    await cleanup(admin, userIds, [tenantId, outroTenantId]);
  });

  it("usuário só com módulo fluxo-caixa lê as linhas individuais (entradas e saídas)", async () => {
    const { data, error } = await clienteFluxo
      .from("lancamentos")
      .select("id, tipo, cliente_credor, valor")
      .order("data_vencimento");

    expect(error).toBeNull();
    // Precisa enxergar receita E despesa — é disso que a tela monta o extrato.
    expect(data!.map((l) => l.cliente_credor).sort()).toEqual([
      "Entrada do mês",
      "Saída do mês",
    ]);
  });

  it("não enxerga lançamentos de outro tenant", async () => {
    const { data, error } = await clienteFluxo
      .from("lancamentos")
      .select("id, cliente_credor")
      .eq("cliente_credor", "Receita de outro tenant");

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("ler não vira escrever: continua sem poder inserir receita sem o módulo", async () => {
    const { error } = await clienteFluxo.from("lancamentos").insert({
      tenant_id: tenantId,
      tipo: "receita",
      status: "a_receber",
      cliente_credor: "Tentativa indevida",
      valor: 1,
      data_vencimento: "2026-09-30",
    });

    expect(error).not.toBeNull();
  });
});
