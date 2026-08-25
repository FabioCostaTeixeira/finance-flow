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

describe("user_permissions aplicado no banco", () => {
  const admin = createAdminClient();
  let tenantId: string;
  let clienteSemPermissao: SupabaseClient;
  let clienteComPermissao: SupabaseClient;
  let userIds: string[] = [];

  beforeAll(async () => {
    tenantId = (await seedTenant(admin, "Tenant Perm")).tenantId;

    const emailSem = uniqueEmail("user-sem");
    const emailCom = uniqueEmail("user-com");
    const sem = await createMember(admin, tenantId, emailSem, "user");
    const com = await createMember(admin, tenantId, emailCom, "user");
    userIds = [sem.userId, com.userId];

    // Só o segundo usuário recebe o módulo de receitas.
    await admin.from("user_permissions").insert({
      tenant_id: tenantId,
      user_id: com.userId,
      module_key: "receitas",
      allowed: true,
    });

    await admin.from("lancamentos").insert({
      tenant_id: tenantId,
      tipo: "receita",
      status: "a_receber",
      cliente_credor: "Receita do tenant",
      valor: 100,
      data_vencimento: "2026-09-01",
    });

    clienteSemPermissao = await createUserClient(emailSem, sem.password);
    clienteComPermissao = await createUserClient(emailCom, com.password);
  });

  afterAll(async () => {
    await cleanup(admin, userIds, [tenantId]);
  });

  it("usuário COM permissão de receitas lê receitas", async () => {
    const { data, error } = await clienteComPermissao
      .from("lancamentos")
      .select("id")
      .eq("tipo", "receita");

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });

  it("usuário SEM permissão não lê nada, mesmo sendo membro do tenant", async () => {
    const { data, error } = await clienteSemPermissao
      .from("lancamentos")
      .select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("usuário SEM permissão não consegue inserir", async () => {
    const { error } = await clienteSemPermissao.from("lancamentos").insert({
      tenant_id: tenantId,
      tipo: "receita",
      status: "a_receber",
      cliente_credor: "Não deveria entrar",
      valor: 1,
      data_vencimento: "2026-09-01",
    });

    expect(error).not.toBeNull();
  });

  it("can_access responde false para módulo não concedido", async () => {
    const { data } = await clienteSemPermissao.rpc("can_access", {
      _tenant: tenantId,
      _module: "receitas",
    });

    expect(data).toBe(false);
  });

  it("can_access responde true para módulo concedido", async () => {
    const { data } = await clienteComPermissao.rpc("can_access", {
      _tenant: tenantId,
      _module: "receitas",
    });

    expect(data).toBe(true);
  });
});

describe("preenchimento automático de tenant_id", () => {
  const admin = createAdminClient();
  let tenantId: string;
  let cliente: SupabaseClient;
  let userIds: string[] = [];

  beforeAll(async () => {
    tenantId = (await seedTenant(admin, "Tenant Trigger")).tenantId;
    const email = uniqueEmail("master-trigger");
    const m = await createMember(admin, tenantId, email, "master");
    userIds = [m.userId];
    cliente = await createUserClient(email, m.password);
  });

  afterAll(async () => {
    await cleanup(admin, userIds, [tenantId]);
  });

  it("insere sem informar tenant_id e o trigger preenche", async () => {
    const { data, error } = await cliente
      .from("bancos")
      .insert({ nome: "Banco Sem Tenant Explícito" })
      .select("id, tenant_id")
      .single();

    expect(error).toBeNull();
    expect(data!.tenant_id).toBe(tenantId);
  });

  it("não permite mover uma linha para outro tenant", async () => {
    const outro = await seedTenant(admin, "Tenant Alvo");
    const { data: banco } = await cliente
      .from("bancos")
      .insert({ nome: "Banco Fixo" })
      .select("id")
      .single();

    const { error } = await cliente
      .from("bancos")
      .update({ tenant_id: outro.tenantId })
      .eq("id", banco!.id);

    expect(error).not.toBeNull();
    expect(error!.message).toContain("tenant_id não pode ser alterado");
    await cleanup(admin, [], [outro.tenantId]);
  });

  it("recusa inserir sem tenant_id quando o usuário pertence a 2 tenants", async () => {
    const outroTenant = await seedTenant(admin, "Tenant Trigger 2");
    await admin.from("tenant_members").insert({
      tenant_id: outroTenant.tenantId,
      user_id: userIds[0],
      role: "master",
    });

    const { error } = await cliente.from("bancos").insert({ nome: "Banco Ambíguo" });

    expect(error).not.toBeNull();
    expect(error!.message).toContain("Usuário pertence a");

    await cleanup(admin, [], [outroTenant.tenantId]);
  });

  it("recusa inserir sem tenant_id quando o usuário não pertence a nenhum tenant", async () => {
    const emailOperador = uniqueEmail("operador-sem-tenant");
    const operador = await createOperator(admin, emailOperador);
    const clienteOperador = await createUserClient(emailOperador, operador.password);

    const { error } = await clienteOperador.from("bancos").insert({ nome: "Banco Órfão" });

    expect(error).not.toBeNull();
    expect(error!.message).toContain("não pertence a nenhum tenant");

    await cleanup(admin, [operador.userId], []);
  });
});
