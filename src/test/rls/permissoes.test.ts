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

describe("ataque: tenant_id explícito de tenant do qual o usuário não é membro", () => {
  // A Task 5 deixou o trigger set_tenant_id agir só quando tenant_id vem nulo.
  // Um INSERT que informa tenant_id explicitamente, de um tenant alheio, passa
  // direto pelo trigger. A única barreira é o WITH CHECK das policies criadas
  // nesta task. Este teste prova que essa barreira segura sozinha.
  const admin = createAdminClient();
  let tenantA: string;
  let tenantB: string;
  let clienteA: SupabaseClient;
  let userIds: string[] = [];

  beforeAll(async () => {
    tenantA = (await seedTenant(admin, "Tenant Ataque A")).tenantId;
    tenantB = (await seedTenant(admin, "Tenant Ataque B")).tenantId;

    const emailA = uniqueEmail("master-ataque-a");
    const a = await createMember(admin, tenantA, emailA, "master");
    userIds = [a.userId];

    clienteA = await createUserClient(emailA, a.password);
  });

  afterAll(async () => {
    await cleanup(admin, userIds, [tenantA, tenantB]);
  });

  it("membro só do tenant A não consegue inserir lancamentos com tenant_id do tenant B", async () => {
    const { error } = await clienteA.from("lancamentos").insert({
      tenant_id: tenantB,
      tipo: "despesa",
      status: "a_pagar",
      cliente_credor: "Ataque via tenant_id explícito",
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
      .eq("tenant_id", tenantB);
    expect(data).toHaveLength(0);
  });

  it("membro só do tenant A não consegue inserir bancos com tenant_id do tenant B", async () => {
    const { error } = await clienteA.from("bancos").insert({
      tenant_id: tenantB,
      nome: "Banco Invasor",
    });

    expect(error).not.toBeNull();
    const isRlsDenial =
      error?.code === "42501" ||
      error?.message?.toLowerCase().includes("row-level security");
    expect(isRlsDenial).toBe(true);

    const { data } = await admin.from("bancos").select("id").eq("tenant_id", tenantB);
    expect(data).toHaveLength(0);
  });

  it("membro só do tenant A não consegue inserir categorias com tenant_id do tenant B", async () => {
    const { error } = await clienteA.from("categorias").insert({
      tenant_id: tenantB,
      nome: "Categoria Invasora",
    });

    expect(error).not.toBeNull();
    const isRlsDenial =
      error?.code === "42501" ||
      error?.message?.toLowerCase().includes("row-level security");
    expect(isRlsDenial).toBe(true);

    const { data } = await admin.from("categorias").select("id").eq("tenant_id", tenantB);
    expect(data).toHaveLength(0);
  });
});

describe("transferência exige acesso simultâneo a receitas e despesas", () => {
  const admin = createAdminClient();
  let tenantId: string;
  let clienteSoReceitas: SupabaseClient;
  let userIds: string[] = [];

  beforeAll(async () => {
    tenantId = (await seedTenant(admin, "Tenant Transferencia")).tenantId;

    const email = uniqueEmail("user-so-receitas");
    const u = await createMember(admin, tenantId, email, "user");
    userIds = [u.userId];

    await admin.from("user_permissions").insert({
      tenant_id: tenantId,
      user_id: u.userId,
      module_key: "receitas",
      allowed: true,
    });

    clienteSoReceitas = await createUserClient(email, u.password);
  });

  afterAll(async () => {
    await cleanup(admin, userIds, [tenantId]);
  });

  it("usuário com só o módulo receitas NÃO consegue criar uma transferência", async () => {
    const { error } = await clienteSoReceitas.from("lancamentos").insert({
      tenant_id: tenantId,
      tipo: "receita",
      status: "transferencia",
      cliente_credor: "Transferência indevida",
      valor: 100,
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
      .eq("tenant_id", tenantId)
      .eq("status", "transferencia");
    expect(data).toHaveLength(0);
  });

  it("usuário com só o módulo receitas NÃO consegue promover um lançamento existente para transferência via UPDATE", async () => {
    const { data: inserted, error: insertError } = await admin
      .from("lancamentos")
      .insert({
        tenant_id: tenantId,
        tipo: "receita",
        status: "a_receber",
        cliente_credor: "Receita normal",
        valor: 100,
        data_vencimento: "2026-09-01",
      })
      .select("id")
      .single();

    expect(insertError).toBeNull();

    const { error } = await clienteSoReceitas
      .from("lancamentos")
      .update({ status: "transferencia" })
      .eq("id", inserted!.id);

    expect(error).not.toBeNull();
    const isRlsDenial =
      error?.code === "42501" ||
      error?.message?.toLowerCase().includes("row-level security");
    expect(isRlsDenial).toBe(true);

    const { data: unchanged } = await admin
      .from("lancamentos")
      .select("status")
      .eq("id", inserted!.id)
      .single();
    expect(unchanged?.status).toBe("a_receber");
  });
});
