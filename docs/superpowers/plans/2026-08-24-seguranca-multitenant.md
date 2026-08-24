# Segurança + Fundação Multitenant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar a falha crítica de autorização do Finance Flow e, no mesmo movimento, introduzir multitenancy por organização, com isolamento garantido no banco e provado por testes.

**Architecture:** Todo dado financeiro ganha `tenant_id`. As policies de RLS deixam de ser `USING (true)` e passam a chamar `can_access(tenant_id, modulo)`, uma função `SECURITY DEFINER STABLE` que responde "este usuário é membro deste tenant e tem este módulo liberado?". O papel do usuário sai de `user_roles` (global) para `tenant_members.role` (por tenant). O operador de plataforma vive em `platform_operators`, fora de `tenant_members`, e por isso nunca satisfaz nenhuma policy de dado financeiro.

**Tech Stack:** Supabase (PostgreSQL 15 + RLS + Edge Functions Deno), React 18, Vite 5, TypeScript 5.8, TanStack Query v5, Vitest 4.

## Global Constraints

- Toda migration vai para `supabase/migrations/` com timestamp no formato `YYYYMMDDHHMMSS_descricao.sql`. Nada é aplicado direto pelo painel — o banco já divergiu do repo uma vez e isso não se repete.
- Nada roda em produção antes de passar na branch de teste do Supabase. O projeto de produção é `ngjoyxtmrfmnepwwontd`.
- Toda função `SECURITY DEFINER` criada ou alterada leva `SET search_path = public` e `REVOKE EXECUTE ... FROM anon, public`.
- Nomes de domínio em português (`lancamentos`, `bancos`, `categorias`, `tenants`). Nomes de infraestrutura em inglês (`can_access`, `audit_log`).
- Lógica de fetch e mutação fica em `src/hooks/` — nunca dentro de páginas.
- `src/integrations/supabase/types.ts` é gerado. Após cada migration que altere schema, regenerar com `npx supabase gen types typescript --linked > src/integrations/supabase/types.ts`.
- Nenhuma tarefa é considerada pronta sem os testes que a acompanham passando.
- Roles válidos no enum `app_role`: `master`, `admin`, `user`. Não inventar outros.
- Módulos válidos, conforme `ALL_MODULES` em `src/hooks/useUserPermissions.ts`: `insights`, `receitas`, `despesas`, `categorias`, `bancos`, `fluxo-caixa`, `api`, `api-docs`, `telegram`, `ai-settings`, `usuarios`.

---

## File Structure

**Migrations (criar):**
- `supabase/migrations/20260824120000_tenants_core.sql` — tabelas `tenants`, `tenant_members`, `platform_operators`
- `supabase/migrations/20260824120100_tenant_id_columns.sql` — colunas + backfill
- `supabase/migrations/20260824120200_rls_engine.sql` — `my_tenant_ids`, `can_access`
- `supabase/migrations/20260824120300_tenant_triggers.sql` — preenchimento automático
- `supabase/migrations/20260824120400_policies_financeiro.sql` — troca das policies críticas
- `supabase/migrations/20260824120500_policies_restantes.sql` — demais tabelas
- `supabase/migrations/20260824120600_security_definer_cleanup.sql` — inventário de funções + `get_fluxo_caixa`
- `supabase/migrations/20260824120700_audit_log.sql` — auditoria
- `supabase/migrations/20260824120800_rpc_me.sql` — RPC `me()`
- `supabase/migrations/20260824120900_api_keys_hash.sql` — hash + `tenant_id` em `api_keys`
- `supabase/migrations/20260824121000_indices_e_limpeza.sql` — índices, `DROP TABLE user_roles`

**Testes (criar):**
- `src/test/rls/helpers.ts` — fábrica de clientes autenticados
- `src/test/rls/isolamento.test.ts` — vazamento entre tenants
- `src/test/rls/permissoes.test.ts` — `user_permissions` aplicado no banco
- `src/test/rls/operador.test.ts` — operador de plataforma não lê dado financeiro
- `src/test/rls/funcoes.test.ts` — RPCs respeitam tenant
- `src/contexts/TenantContext.test.tsx` — contexto de tenant

**Frontend (criar):**
- `src/contexts/TenantContext.tsx`
- `src/components/TenantSwitcher.tsx`

**Frontend (modificar):**
- `src/contexts/AuthContext.tsx` — passa a usar a RPC `me()`
- `src/App.tsx` — envolve com `TenantProvider`
- `src/hooks/useUserPermissions.ts` — permissões por tenant
- `src/hooks/useLancamentos.ts`, `useBancos.ts`, `useCategorias.ts`, `useApiKeys.ts`, `useAISettings.ts`, `useTelegram.ts`, `useChatMessages.ts`, `useUsuarios.ts` — `tenant_id` na `queryKey` e no insert
- `src/components/AppSidebar.tsx` — abriga o `TenantSwitcher`

**Edge functions (modificar):**
- `supabase/functions/api/index.ts` — hash de chave, rate limit, CORS
- `supabase/functions/create-user/index.ts`, `delete-user/index.ts` — tenant + CORS
- `supabase/config.toml` — `verify_jwt`

**Edge functions (deletar):**
- `supabase/functions/setup-master/`

---

## Task 1: Harness de teste de RLS

Esta tarefa não muda o app. Ela cria a infraestrutura de teste e escreve o teste que **prova a falha atual**. Todas as tarefas seguintes existem para fazer este teste passar.

**Files:**
- Create: `src/test/rls/helpers.ts`
- Create: `src/test/rls/isolamento.test.ts`
- Create: `.env.test.example`
- Modify: `vite.config.ts`
- Modify: `package.json` (scripts + devDependency `dotenv`)
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nada.
- Produces: `createAdminClient(): SupabaseClient`, `createUserClient(email: string, password: string): Promise<SupabaseClient>`, `seedTenant(admin, nome): Promise<{tenantId: string}>`, `createMember(admin, tenantId, email, role): Promise<{userId: string, password: string}>`, `cleanup(admin, userIds: string[], tenantIds: string[]): Promise<void>`. Usados por todos os testes de RLS das tarefas seguintes.

- [ ] **Step 1: Criar a branch de teste no Supabase**

```bash
cd finance-flow
npx supabase branches create rls-test --experimental
npx supabase branches list --experimental
```

Expected: a branch `rls-test` aparece com status `MIGRATIONS_PASSED` e um `project_ref` próprio. Anote a URL, a anon key e a service role key da branch (`npx supabase branches get rls-test --experimental`).

> Se a organização não tiver branching habilitado (exige plano Pro), use um projeto Supabase separado criado à mão para testes. O resto do plano não muda: só as variáveis de `.env.test` apontam para outro lugar.

- [ ] **Step 2: Instalar dotenv e criar o arquivo de ambiente de teste**

```bash
npm install -D dotenv
```

Crie `.env.test` (não versionado) com os valores da branch:

```
SUPABASE_TEST_URL=https://<ref-da-branch>.supabase.co
SUPABASE_TEST_ANON_KEY=<anon key da branch>
SUPABASE_TEST_SERVICE_ROLE_KEY=<service role key da branch>
```

Crie `.env.test.example` (versionado) com as mesmas chaves e valores vazios.

Adicione ao final de `.gitignore`:

```
# Ambiente de testes de RLS
.env.test
```

- [ ] **Step 3: Configurar o Vitest para separar testes de RLS**

Os testes de RLS falam com um Postgres real e não podem rodar em `jsdom`. Substitua o bloco `test` em `vite.config.ts`:

```ts
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          globals: true,
          setupFiles: "./src/test/setup.ts",
          exclude: ["**/node_modules/**", "src/test/rls/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "rls",
          environment: "node",
          globals: true,
          include: ["src/test/rls/**/*.test.ts"],
          setupFiles: "./src/test/rls/env.ts",
          testTimeout: 30000,
          // Os testes compartilham um Postgres real: rodar arquivos em paralelo
          // faria um cleanup derrubar o cenário de outro.
          fileParallelism: false,
        },
      },
    ],
  },
```

Crie `src/test/rls/env.ts`:

```ts
import dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

const required = [
  "SUPABASE_TEST_URL",
  "SUPABASE_TEST_ANON_KEY",
  "SUPABASE_TEST_SERVICE_ROLE_KEY",
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(
      `Variável ${key} ausente. Copie .env.test.example para .env.test e preencha com os dados da branch de teste.`
    );
  }
}
```

Adicione os scripts em `package.json`:

```json
    "test:unit": "vitest --project unit",
    "test:rls": "vitest --project rls",
```

- [ ] **Step 4: Escrever o helper de clientes**

Crie `src/test/rls/helpers.ts`:

```ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const URL = process.env.SUPABASE_TEST_URL!;
const ANON = process.env.SUPABASE_TEST_ANON_KEY!;
const SERVICE = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY!;

/** Cliente com service role: ignora RLS. Usado só para preparar e limpar cenário. */
export function createAdminClient(): SupabaseClient {
  return createClient(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Cliente autenticado como um usuário real. Sujeito a RLS, como o app. */
export async function createUserClient(
  email: string,
  password: string
): Promise<SupabaseClient> {
  const client = createClient(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Falha ao autenticar ${email}: ${error.message}`);
  return client;
}

export async function seedTenant(admin: SupabaseClient, nome: string) {
  const slug = `${nome.toLowerCase().replace(/\s+/g, "-")}-${randomUUID().slice(0, 8)}`;
  const { data, error } = await admin
    .from("tenants")
    .insert({ nome, slug })
    .select("id")
    .single();
  if (error) throw new Error(`Falha ao criar tenant: ${error.message}`);
  return { tenantId: data.id as string };
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

  return { userId, password };
}

export async function cleanup(
  admin: SupabaseClient,
  userIds: string[],
  tenantIds: string[]
) {
  for (const id of userIds) {
    await admin.auth.admin.deleteUser(id).catch(() => undefined);
  }
  for (const id of tenantIds) {
    await admin.from("lancamentos").delete().eq("tenant_id", id);
    await admin.from("bancos").delete().eq("tenant_id", id);
    await admin.from("categorias").delete().eq("tenant_id", id);
    await admin.from("tenants").delete().eq("id", id);
  }
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}@rls-test.local`;
}
```

- [ ] **Step 5: Escrever o teste de isolamento que prova a falha**

Crie `src/test/rls/isolamento.test.ts`:

```ts
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
  });
});
```

- [ ] **Step 6: Rodar o teste e confirmar que ele falha**

```bash
npm run test:rls
```

Expected: FAIL. Neste ponto as tabelas `tenants`, `tenant_members` e a coluna `tenant_id` não existem, então o `beforeAll` quebra com algo como `relation "public.tenants" does not exist`. Essa falha é o ponto de partida: as tarefas 2 a 6 existem para transformá-la em PASS.

- [ ] **Step 7: Commit**

```bash
git add src/test/rls/ .env.test.example .gitignore vite.config.ts package.json package-lock.json
git commit -m "test: harness de RLS e teste de isolamento entre tenants (vermelho)"
```

---

## Task 2: Tabelas núcleo do tenant

**Files:**
- Create: `supabase/migrations/20260824120000_tenants_core.sql`
- Test: `src/test/rls/isolamento.test.ts` (já existe; avança de erro)

**Interfaces:**
- Consumes: nada.
- Produces: tabelas `tenants(id, nome, slug, plano, ativo, created_at)`, `tenant_members(tenant_id, user_id, role, created_at)`, `platform_operators(user_id, created_at)`. As tarefas 3 a 12 dependem delas.

- [ ] **Step 1: Escrever a migration**

Crie `supabase/migrations/20260824120000_tenants_core.sql`:

```sql
-- Núcleo de multitenancy: organizações, seus membros e os operadores da plataforma.

CREATE TABLE public.tenants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL,
  slug       text NOT NULL UNIQUE,
  plano      text NOT NULL DEFAULT 'padrao',
  ativo      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tenant_members (
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

CREATE INDEX idx_tenant_members_user ON public.tenant_members(user_id);

-- Operadores vivem FORA de tenant_members. É isso que garante, por construção,
-- que eles nunca satisfazem uma policy de dado financeiro.
CREATE TABLE public.platform_operators (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_operators ENABLE ROW LEVEL SECURITY;

-- Sem policies para authenticated em platform_operators: apenas service_role
-- (edge functions do console) enxerga a tabela. RLS habilitada e nenhuma policy
-- significa "ninguém autenticado acessa", que é exatamente a intenção.

-- Migração dos dados atuais: um tenant único com todos os usuários existentes.
INSERT INTO public.tenants (nome, slug) VALUES ('Principal', 'principal');

INSERT INTO public.tenant_members (tenant_id, user_id, role)
SELECT (SELECT id FROM public.tenants WHERE slug = 'principal'),
       ur.user_id,
       ur.role
FROM public.user_roles ur
ON CONFLICT (tenant_id, user_id) DO NOTHING;
```

- [ ] **Step 2: Aplicar na branch de teste**

```bash
npx supabase db push --linked
```

Expected: `Applying migration 20260824120000_tenants_core.sql... done.`

> Confirme antes que o CLI está apontado para a branch de teste, não para produção:
> `npx supabase branches list --experimental` e `npx supabase link --project-ref <ref-da-branch>`.

- [ ] **Step 3: Verificar que o tenant Principal existe com os membros certos**

```bash
npx supabase db execute --linked "SELECT t.nome, count(m.user_id) AS membros FROM tenants t LEFT JOIN tenant_members m ON m.tenant_id = t.id GROUP BY t.nome;"
```

Expected: uma linha, `Principal | 2` (os dois usuários que existem hoje em `user_roles`).

- [ ] **Step 4: Rodar o teste e confirmar que a falha mudou**

```bash
npm run test:rls
```

Expected: ainda FAIL, mas agora com `column "tenant_id" of relation "lancamentos" does not exist`. As tabelas núcleo já existem; falta a coluna. Progresso confirmado.

- [ ] **Step 5: Regenerar os tipos e commitar**

```bash
npx supabase gen types typescript --linked > src/integrations/supabase/types.ts
git add supabase/migrations/20260824120000_tenants_core.sql src/integrations/supabase/types.ts
git commit -m "feat(db): tabelas tenants, tenant_members e platform_operators"
```

---

## Task 3: Coluna tenant_id e backfill

**Files:**
- Create: `supabase/migrations/20260824120100_tenant_id_columns.sql`

**Interfaces:**
- Consumes: tabela `tenants` da Task 2.
- Produces: coluna `tenant_id uuid NOT NULL` em `lancamentos`, `bancos`, `categorias`, `api_keys`, `ai_settings`, `messaging_channels`, `chat_messages`, e coluna `tenant_id` em `user_permissions`. As policies da Task 6 dependem dela.

- [ ] **Step 1: Escrever a migration**

Crie `supabase/migrations/20260824120100_tenant_id_columns.sql`:

```sql
-- Adiciona tenant_id às tabelas de dados, faz backfill com o tenant Principal
-- e trava a coluna como NOT NULL.

DO $$
DECLARE
  tenant_principal uuid;
BEGIN
  SELECT id INTO tenant_principal FROM public.tenants WHERE slug = 'principal';
  IF tenant_principal IS NULL THEN
    RAISE EXCEPTION 'Tenant Principal não encontrado. A migration 20260824120000 rodou?';
  END IF;

  -- Fase nullable + backfill, tabela por tabela.
  ALTER TABLE public.lancamentos        ADD COLUMN tenant_id uuid;
  ALTER TABLE public.bancos             ADD COLUMN tenant_id uuid;
  ALTER TABLE public.categorias         ADD COLUMN tenant_id uuid;
  ALTER TABLE public.api_keys           ADD COLUMN tenant_id uuid;
  ALTER TABLE public.ai_settings        ADD COLUMN tenant_id uuid;
  ALTER TABLE public.messaging_channels ADD COLUMN tenant_id uuid;
  ALTER TABLE public.chat_messages      ADD COLUMN tenant_id uuid;
  ALTER TABLE public.user_permissions   ADD COLUMN tenant_id uuid;

  UPDATE public.lancamentos        SET tenant_id = tenant_principal;
  UPDATE public.bancos             SET tenant_id = tenant_principal;
  UPDATE public.categorias         SET tenant_id = tenant_principal;
  UPDATE public.api_keys           SET tenant_id = tenant_principal;
  UPDATE public.ai_settings        SET tenant_id = tenant_principal;
  UPDATE public.messaging_channels SET tenant_id = tenant_principal;
  UPDATE public.chat_messages      SET tenant_id = tenant_principal;
  UPDATE public.user_permissions   SET tenant_id = tenant_principal;
END $$;

-- Trava: NOT NULL + FK. ON DELETE RESTRICT porque apagar um tenant com dados
-- financeiros deve ser um ato deliberado, nunca um efeito colateral.
ALTER TABLE public.lancamentos
  ALTER COLUMN tenant_id SET NOT NULL,
  ADD CONSTRAINT lancamentos_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE public.bancos
  ALTER COLUMN tenant_id SET NOT NULL,
  ADD CONSTRAINT bancos_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE public.categorias
  ALTER COLUMN tenant_id SET NOT NULL,
  ADD CONSTRAINT categorias_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE public.api_keys
  ALTER COLUMN tenant_id SET NOT NULL,
  ADD CONSTRAINT api_keys_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.messaging_channels
  ALTER COLUMN tenant_id SET NOT NULL,
  ADD CONSTRAINT messaging_channels_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.chat_messages
  ALTER COLUMN tenant_id SET NOT NULL,
  ADD CONSTRAINT chat_messages_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.user_permissions
  ALTER COLUMN tenant_id SET NOT NULL,
  ADD CONSTRAINT user_permissions_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- ai_settings deixa de ser linha única e passa a ter uma linha por tenant.
ALTER TABLE public.ai_settings DROP CONSTRAINT IF EXISTS ai_settings_id_check;
ALTER TABLE public.ai_settings
  ALTER COLUMN tenant_id SET NOT NULL,
  ADD CONSTRAINT ai_settings_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD CONSTRAINT ai_settings_tenant_unico UNIQUE (tenant_id);

-- Permissões passam a ser por tenant.
ALTER TABLE public.user_permissions
  DROP CONSTRAINT IF EXISTS user_permissions_user_id_module_key_key;
ALTER TABLE public.user_permissions
  ADD CONSTRAINT user_permissions_tenant_user_module_key
    UNIQUE (tenant_id, user_id, module_key);
```

- [ ] **Step 2: Aplicar e conferir a contagem**

```bash
npx supabase db push --linked
npx supabase db execute --linked "SELECT count(*) AS total, count(tenant_id) AS com_tenant FROM lancamentos;"
```

Expected: `total` e `com_tenant` iguais. Em produção esse número será 1296; na branch de teste, o que a branch tiver copiado.

- [ ] **Step 3: Confirmar que a coluna é obrigatória**

```bash
npx supabase db execute --linked "INSERT INTO lancamentos (tipo, status, cliente_credor, valor, data_vencimento) VALUES ('receita','a_receber','x',1,'2026-01-01');"
```

Expected: ERRO `null value in column "tenant_id" ... violates not-null constraint`. É o comportamento desejado — a Task 5 adiciona o trigger que preenche o valor automaticamente para o app.

- [ ] **Step 4: Regenerar tipos e commitar**

```bash
npx supabase gen types typescript --linked > src/integrations/supabase/types.ts
git add supabase/migrations/20260824120100_tenant_id_columns.sql src/integrations/supabase/types.ts
git commit -m "feat(db): coluna tenant_id com backfill para o tenant Principal"
```

---

## Task 4: Motor do RLS

**Files:**
- Create: `supabase/migrations/20260824120200_rls_engine.sql`
- Create: `src/test/rls/permissoes.test.ts`

**Interfaces:**
- Consumes: `tenant_members`, `user_permissions.tenant_id` das Tasks 2 e 3.
- Produces: `public.my_tenant_ids() RETURNS SETOF uuid` e `public.can_access(_tenant uuid, _module text) RETURNS boolean`. Toda policy das Tasks 6 e 7 chama `can_access`.

- [ ] **Step 1: Escrever a migration**

Crie `supabase/migrations/20260824120200_rls_engine.sql`:

```sql
-- Motor de autorização. SECURITY DEFINER evita recursão infinita: a policy de
-- tenant_members não pode consultar tenant_members por um caminho que passe por
-- outra policy. STABLE permite ao planner reaproveitar o resultado na query.

CREATE OR REPLACE FUNCTION public.my_tenant_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.can_access(_tenant uuid, _module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.tenant_id = _tenant
      AND (
        tm.role IN ('master', 'admin')
        OR EXISTS (
          SELECT 1
          FROM public.user_permissions up
          WHERE up.user_id = auth.uid()
            AND up.tenant_id = _tenant
            AND up.module_key = _module
            AND up.allowed
        )
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.my_tenant_ids() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_access(uuid, text) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.my_tenant_ids() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.can_access(uuid, text) TO authenticated;

-- Policies das próprias tabelas núcleo.
CREATE POLICY tenants_select ON public.tenants FOR SELECT TO authenticated
  USING (id IN (SELECT public.my_tenant_ids()));

CREATE POLICY tenant_members_select ON public.tenant_members FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.my_tenant_ids()));

CREATE POLICY tenant_members_manage ON public.tenant_members FOR ALL TO authenticated
  USING (public.can_access(tenant_id, 'usuarios'))
  WITH CHECK (public.can_access(tenant_id, 'usuarios'));

CREATE POLICY user_permissions_select ON public.user_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_access(tenant_id, 'usuarios'));

CREATE POLICY user_permissions_manage ON public.user_permissions FOR ALL TO authenticated
  USING (public.can_access(tenant_id, 'usuarios'))
  WITH CHECK (public.can_access(tenant_id, 'usuarios'));
```

- [ ] **Step 2: Aplicar**

```bash
npx supabase db push --linked
```

Expected: `done.`

- [ ] **Step 3: Escrever o teste de permissões**

Crie `src/test/rls/permissoes.test.ts`:

```ts
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
```

- [ ] **Step 4: Rodar e observar o estado esperado**

```bash
npm run test:rls -- permissoes
```

Expected: os dois testes de `can_access` PASSAM. Os testes de leitura ainda FALHAM, porque as policies de `lancamentos` continuam `USING (true)` até a Task 6. Registre isso: o motor está certo, falta ligá-lo.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260824120200_rls_engine.sql src/test/rls/permissoes.test.ts
git commit -m "feat(db): funções my_tenant_ids e can_access com policies das tabelas núcleo"
```

---

## Task 5: Preenchimento automático de tenant_id

**Files:**
- Create: `supabase/migrations/20260824120300_tenant_triggers.sql`

**Interfaces:**
- Consumes: `my_tenant_ids()` da Task 4.
- Produces: trigger `set_tenant_id()` aplicado em `lancamentos`, `bancos`, `categorias`, `chat_messages`, `messaging_channels`. Permite que os hooks do frontend insiram sem informar `tenant_id` quando o usuário tem um único tenant.

- [ ] **Step 1: Escrever a migration**

Crie `supabase/migrations/20260824120300_tenant_triggers.sql`:

```sql
-- Preenche tenant_id automaticamente quando o usuário pertence a exatamente um
-- tenant. Com mais de um, exige o valor explícito — adivinhar seria pior que falhar.

CREATE OR REPLACE FUNCTION public.set_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidatos uuid[];
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(t) INTO candidatos FROM public.my_tenant_ids() AS t;

  IF candidatos IS NULL OR array_length(candidatos, 1) = 0 THEN
    RAISE EXCEPTION 'Usuário não pertence a nenhum tenant';
  ELSIF array_length(candidatos, 1) > 1 THEN
    RAISE EXCEPTION 'Usuário pertence a % tenants; tenant_id é obrigatório',
      array_length(candidatos, 1);
  END IF;

  NEW.tenant_id := candidatos[1];
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.set_tenant_id() FROM anon, public;

CREATE TRIGGER trg_set_tenant_id_lancamentos
  BEFORE INSERT ON public.lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

CREATE TRIGGER trg_set_tenant_id_bancos
  BEFORE INSERT ON public.bancos
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

CREATE TRIGGER trg_set_tenant_id_categorias
  BEFORE INSERT ON public.categorias
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

CREATE TRIGGER trg_set_tenant_id_chat_messages
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

CREATE TRIGGER trg_set_tenant_id_messaging_channels
  BEFORE INSERT ON public.messaging_channels
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- Impede troca de tenant em UPDATE: mover uma linha de tenant é sempre bug ou ataque.
CREATE OR REPLACE FUNCTION public.freeze_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'tenant_id não pode ser alterado';
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.freeze_tenant_id() FROM anon, public;

CREATE TRIGGER trg_freeze_tenant_id_lancamentos
  BEFORE UPDATE ON public.lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.freeze_tenant_id();

CREATE TRIGGER trg_freeze_tenant_id_bancos
  BEFORE UPDATE ON public.bancos
  FOR EACH ROW EXECUTE FUNCTION public.freeze_tenant_id();

CREATE TRIGGER trg_freeze_tenant_id_categorias
  BEFORE UPDATE ON public.categorias
  FOR EACH ROW EXECUTE FUNCTION public.freeze_tenant_id();
```

- [ ] **Step 2: Aplicar**

```bash
npx supabase db push --linked
```

Expected: `done.`

- [ ] **Step 3: Adicionar o teste de trigger ao arquivo de permissões**

Acrescente este bloco ao final de `src/test/rls/permissoes.test.ts`, dentro do mesmo arquivo mas como novo `describe`:

```ts
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
    await cleanup(admin, [], [outro.tenantId]);
  });
});
```

- [ ] **Step 4: Rodar**

```bash
npm run test:rls -- permissoes
```

Expected: os testes de trigger PASSAM (o master tem acesso irrestrito via `can_access`, e as policies de `bancos` ainda são permissivas). Os testes de isolamento seguem falhando até a Task 6.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260824120300_tenant_triggers.sql src/test/rls/permissoes.test.ts
git commit -m "feat(db): triggers de preenchimento e congelamento de tenant_id"
```

---

## Task 6: Troca das policies do núcleo financeiro

Esta é a tarefa que fecha os achados críticos 1 e 2.

**Files:**
- Create: `supabase/migrations/20260824120400_policies_financeiro.sql`

**Interfaces:**
- Consumes: `can_access` da Task 4.
- Produces: policies de tenant em `lancamentos`, `bancos`, `categorias`. A partir daqui `src/test/rls/isolamento.test.ts` passa inteiro.

- [ ] **Step 1: Escrever a migration**

Crie `supabase/migrations/20260824120400_policies_financeiro.sql`:

```sql
-- Substitui as policies USING(true) por isolamento de tenant + checagem de módulo.

DROP POLICY IF EXISTS "Authenticated can view lancamentos"   ON public.lancamentos;
DROP POLICY IF EXISTS "Authenticated can insert lancamentos" ON public.lancamentos;
DROP POLICY IF EXISTS "Authenticated can update lancamentos" ON public.lancamentos;
DROP POLICY IF EXISTS "Authenticated can delete lancamentos" ON public.lancamentos;

DROP POLICY IF EXISTS "Authenticated can view bancos"   ON public.bancos;
DROP POLICY IF EXISTS "Authenticated can insert bancos" ON public.bancos;
DROP POLICY IF EXISTS "Authenticated can update bancos" ON public.bancos;
DROP POLICY IF EXISTS "Authenticated can delete bancos" ON public.bancos;

DROP POLICY IF EXISTS "Authenticated can view categorias"   ON public.categorias;
DROP POLICY IF EXISTS "Authenticated can insert categorias" ON public.categorias;
DROP POLICY IF EXISTS "Authenticated can update categorias" ON public.categorias;
DROP POLICY IF EXISTS "Authenticated can delete categorias" ON public.categorias;

-- lancamentos: o módulo exigido depende do tipo da própria linha.
-- Transferências tocam os dois lados e exigem ambos os módulos.
CREATE OR REPLACE FUNCTION public.modulo_do_lancamento(_tipo public.tipo_lancamento)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$ SELECT CASE WHEN _tipo = 'receita' THEN 'receitas' ELSE 'despesas' END $$;

CREATE POLICY lancamentos_select ON public.lancamentos FOR SELECT TO authenticated
  USING (public.can_access(tenant_id, public.modulo_do_lancamento(tipo)));

CREATE POLICY lancamentos_insert ON public.lancamentos FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access(tenant_id, public.modulo_do_lancamento(tipo))
    AND (status <> 'transferencia' OR (
      public.can_access(tenant_id, 'receitas') AND public.can_access(tenant_id, 'despesas')
    ))
  );

CREATE POLICY lancamentos_update ON public.lancamentos FOR UPDATE TO authenticated
  USING (public.can_access(tenant_id, public.modulo_do_lancamento(tipo)))
  WITH CHECK (
    public.can_access(tenant_id, public.modulo_do_lancamento(tipo))
    AND (status <> 'transferencia' OR (
      public.can_access(tenant_id, 'receitas') AND public.can_access(tenant_id, 'despesas')
    ))
  );

CREATE POLICY lancamentos_delete ON public.lancamentos FOR DELETE TO authenticated
  USING (public.can_access(tenant_id, public.modulo_do_lancamento(tipo)));

-- bancos: leitura liberada a quem acessa qualquer módulo financeiro, porque
-- combos de banco aparecem nos formulários de receita e despesa. Escrita exige
-- o módulo próprio.
CREATE POLICY bancos_select ON public.bancos FOR SELECT TO authenticated
  USING (
    public.can_access(tenant_id, 'bancos')
    OR public.can_access(tenant_id, 'receitas')
    OR public.can_access(tenant_id, 'despesas')
    OR public.can_access(tenant_id, 'fluxo-caixa')
  );

CREATE POLICY bancos_insert ON public.bancos FOR INSERT TO authenticated
  WITH CHECK (public.can_access(tenant_id, 'bancos'));

CREATE POLICY bancos_update ON public.bancos FOR UPDATE TO authenticated
  USING (public.can_access(tenant_id, 'bancos'))
  WITH CHECK (public.can_access(tenant_id, 'bancos'));

CREATE POLICY bancos_delete ON public.bancos FOR DELETE TO authenticated
  USING (public.can_access(tenant_id, 'bancos'));

-- categorias: mesma lógica de leitura ampla, pelo mesmo motivo.
CREATE POLICY categorias_select ON public.categorias FOR SELECT TO authenticated
  USING (
    public.can_access(tenant_id, 'categorias')
    OR public.can_access(tenant_id, 'receitas')
    OR public.can_access(tenant_id, 'despesas')
    OR public.can_access(tenant_id, 'fluxo-caixa')
  );

CREATE POLICY categorias_insert ON public.categorias FOR INSERT TO authenticated
  WITH CHECK (public.can_access(tenant_id, 'categorias'));

CREATE POLICY categorias_update ON public.categorias FOR UPDATE TO authenticated
  USING (public.can_access(tenant_id, 'categorias'))
  WITH CHECK (public.can_access(tenant_id, 'categorias'));

CREATE POLICY categorias_delete ON public.categorias FOR DELETE TO authenticated
  USING (public.can_access(tenant_id, 'categorias'));
```

- [ ] **Step 2: Aplicar**

```bash
npx supabase db push --linked
```

Expected: `done.`

- [ ] **Step 3: Rodar a suíte inteira de RLS**

```bash
npm run test:rls
```

Expected: **PASS em tudo**, incluindo os cinco testes de `isolamento.test.ts` e os de `permissoes.test.ts` que falhavam. Este é o momento em que a falha crítica está fechada.

Se `usuário SEM permissão não lê nada` ainda falhar, verifique se o usuário de teste não foi criado com role `master` ou `admin` por engano — esses dois papéis têm acesso irrestrito dentro do tenant por desenho.

- [ ] **Step 4: Confirmar que não sobrou policy permissiva**

```bash
npx supabase db execute --linked "SELECT tablename, policyname FROM pg_policies WHERE schemaname='public' AND qual = 'true';"
```

Expected: nenhuma linha nas tabelas financeiras. Se algo aparecer, é policy antiga que o `DROP` não pegou — apague pelo nome exato retornado.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260824120400_policies_financeiro.sql
git commit -m "fix(security): isolamento de tenant e checagem de módulo em lancamentos, bancos e categorias"
```

---

## Task 7: Policies das tabelas restantes

**Files:**
- Create: `supabase/migrations/20260824120500_policies_restantes.sql`
- Create: `src/test/rls/operador.test.ts`

**Interfaces:**
- Consumes: `can_access` da Task 4.
- Produces: policies de tenant em `api_keys`, `ai_settings`, `messaging_channels`, `chat_messages`, `telegram_messages`, `telegram_bot_state`, `api_access_logs`, `profiles`.

- [ ] **Step 1: Escrever a migration**

Crie `supabase/migrations/20260824120500_policies_restantes.sql`:

```sql
-- Demais tabelas passam ao mesmo regime de tenant + módulo.

DROP POLICY IF EXISTS "Master can view api_keys"   ON public.api_keys;
DROP POLICY IF EXISTS "Master can insert api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Master can update api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Master can delete api_keys" ON public.api_keys;

CREATE POLICY api_keys_all ON public.api_keys FOR ALL TO authenticated
  USING (public.can_access(tenant_id, 'api'))
  WITH CHECK (public.can_access(tenant_id, 'api'));

DROP POLICY IF EXISTS "Master can view ai settings"   ON public.ai_settings;
DROP POLICY IF EXISTS "Master can update ai settings" ON public.ai_settings;

CREATE POLICY ai_settings_all ON public.ai_settings FOR ALL TO authenticated
  USING (public.can_access(tenant_id, 'ai-settings'))
  WITH CHECK (public.can_access(tenant_id, 'ai-settings'));

DROP POLICY IF EXISTS "Users view own channels"   ON public.messaging_channels;
DROP POLICY IF EXISTS "Users insert own channels" ON public.messaging_channels;
DROP POLICY IF EXISTS "Users update own channels" ON public.messaging_channels;
DROP POLICY IF EXISTS "Users delete own channels" ON public.messaging_channels;

CREATE POLICY messaging_channels_all ON public.messaging_channels FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.my_tenant_ids()) AND user_id = auth.uid())
  WITH CHECK (tenant_id IN (SELECT public.my_tenant_ids()) AND user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own messages" ON public.chat_messages;

CREATE POLICY chat_messages_all ON public.chat_messages FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.my_tenant_ids()) AND user_id = auth.uid())
  WITH CHECK (tenant_id IN (SELECT public.my_tenant_ids()) AND user_id = auth.uid());

DROP POLICY IF EXISTS "Master can view api_access_logs" ON public.api_access_logs;

CREATE POLICY api_access_logs_select ON public.api_access_logs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.api_keys k
    WHERE k.id = api_access_logs.api_key_id
      AND public.can_access(k.tenant_id, 'api')
  ));

DROP POLICY IF EXISTS "Master views telegram messages" ON public.telegram_messages;

CREATE POLICY telegram_messages_select ON public.telegram_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.messaging_channels c
    WHERE c.chat_id = telegram_messages.chat_id
      AND c.tenant_id IN (SELECT public.my_tenant_ids())
  ));

-- telegram_bot_state tinha RLS ligada e nenhuma policy (advisor 0008).
-- É estado global do bot, manipulado só por edge function com service_role.
-- Documentamos a intenção com um comentário; a ausência de policy é deliberada.
COMMENT ON TABLE public.telegram_bot_state IS
  'Estado global do bot. Acesso exclusivo de service_role via edge function. RLS sem policy é intencional.';

-- profiles: visível a quem compartilha tenant, para a tela de Usuários.
DROP POLICY IF EXISTS "Users can view own profile"       ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Only master can insert profiles"  ON public.profiles;
DROP POLICY IF EXISTS "Only master can delete profiles"  ON public.profiles;

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.user_id = public.profiles.user_id
        AND tm.tenant_id IN (SELECT public.my_tenant_ids())
    )
  );

CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

- [ ] **Step 2: Aplicar**

```bash
npx supabase db push --linked
```

Expected: `done.`

- [ ] **Step 3: Escrever o teste do operador de plataforma**

Crie `src/test/rls/operador.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  createAdminClient,
  createUserClient,
  createOperator,
  seedTenant,
  createMember,
  cleanup,
  uniqueEmail,
} from "./helpers";

describe("operador de plataforma não acessa dado financeiro", () => {
  const admin = createAdminClient();
  let tenantId: string;
  let operador: SupabaseClient;
  let userIds: string[] = [];

  beforeAll(async () => {
    tenantId = (await seedTenant(admin, "Tenant Op")).tenantId;

    const emailMembro = uniqueEmail("membro");
    const membro = await createMember(admin, tenantId, emailMembro, "master");

    const emailOp = uniqueEmail("operador");
    const op = await createOperator(admin, emailOp);
    userIds = [membro.userId, op.userId];

    await admin.from("lancamentos").insert({
      tenant_id: tenantId,
      tipo: "despesa",
      status: "a_pagar",
      cliente_credor: "Fornecedor confidencial",
      valor: 999,
      data_vencimento: "2026-09-01",
    });

    operador = await createUserClient(emailOp, op.password);
  });

  afterAll(async () => {
    await cleanup(admin, userIds, [tenantId]);
  });

  it("não lê lançamentos", async () => {
    const { data } = await operador.from("lancamentos").select("id");
    expect(data).toHaveLength(0);
  });

  it("não lê bancos", async () => {
    const { data } = await operador.from("bancos").select("id");
    expect(data).toHaveLength(0);
  });

  it("não lê categorias", async () => {
    const { data } = await operador.from("categorias").select("id");
    expect(data).toHaveLength(0);
  });

  it("não lê api_keys", async () => {
    const { data } = await operador.from("api_keys").select("id");
    expect(data).toHaveLength(0);
  });

  it("não enxerga tenants pelo cliente autenticado", async () => {
    const { data } = await operador.from("tenants").select("id");
    expect(data).toHaveLength(0);
  });

  it("não consegue se auto-inscrever num tenant", async () => {
    const { error } = await operador
      .from("tenant_members")
      .insert({ tenant_id: tenantId, user_id: (await operador.auth.getUser()).data.user!.id, role: "master" });

    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 4: Rodar**

```bash
npm run test:rls
```

Expected: PASS em tudo, incluindo os seis testes de operador.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260824120500_policies_restantes.sql src/test/rls/operador.test.ts
git commit -m "feat(security): policies de tenant nas tabelas restantes e teste do operador"
```

---

## Task 8: Limpeza das funções SECURITY DEFINER

**Files:**
- Create: `supabase/migrations/20260824120600_security_definer_cleanup.sql`
- Create: `src/test/rls/funcoes.test.ts`

**Interfaces:**
- Consumes: `can_access` da Task 4.
- Produces: `public.get_fluxo_caixa(_tenant uuid, _data_inicio date, _data_fim date)` retornando `TABLE(mes date, entradas numeric, saidas numeric, saldo numeric)`. Consumido pela página de Fluxo de Caixa na Task 12.

- [ ] **Step 1: Escrever a migration**

Crie `supabase/migrations/20260824120600_security_definer_cleanup.sql`:

```sql
-- Fecha os WARN do advisor: nenhuma função SECURITY DEFINER acessível a anon,
-- e todas com search_path fixo.

REVOKE EXECUTE ON FUNCTION public.handle_new_user()             FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_chat_message_user_id()    FROM anon, public;

-- audit_lancamentos estava sem search_path. É reescrita na migration de auditoria
-- (20260824120700); aqui apenas trancamos o acesso.
REVOKE EXECUTE ON FUNCTION public.audit_lancamentos()           FROM anon, public;

-- rls_auto_enable não consta em nenhuma migration do repo e não é chamada pelo
-- app. Removida por ser superfície sem dono.
DROP FUNCTION IF EXISTS public.rls_auto_enable();

-- get_user_role, has_role e has_permission são substituídas por can_access.
-- Só podem cair depois que nenhuma policy as referencie — o que já é verdade
-- após as Tasks 6 e 7.
DROP FUNCTION IF EXISTS public.get_user_role(uuid);
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.has_permission(uuid, text);

-- execute_readonly_query: mantém acesso exclusivo de service_role e ganha
-- teto de tempo. O LIMIT é responsabilidade de quem monta a query no agente,
-- mas o timeout impede que uma query patológica trave o banco.
CREATE OR REPLACE FUNCTION public.execute_readonly_query(query_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '5s'
AS $$
DECLARE
  resultado jsonb;
BEGIN
  IF query_text !~* '^\s*select\s' THEN
    RAISE EXCEPTION 'Apenas SELECT é permitido';
  END IF;
  IF query_text ~* '(insert|update|delete|drop|alter|create|grant|revoke|truncate)\s' THEN
    RAISE EXCEPTION 'Comando não permitido na query';
  END IF;

  EXECUTE format('SELECT jsonb_agg(t) FROM (%s LIMIT 500) t', query_text)
    INTO resultado;
  RETURN COALESCE(resultado, '[]'::jsonb);
END $$;

REVOKE ALL ON FUNCTION public.execute_readonly_query(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_readonly_query(text) TO service_role;

-- Agregados de fluxo de caixa para quem tem o módulo mas não pode ler as linhas.
-- SECURITY DEFINER é deliberado aqui, e por isso a checagem vem na primeira instrução.
CREATE OR REPLACE FUNCTION public.get_fluxo_caixa(
  _tenant uuid,
  _data_inicio date DEFAULT NULL,
  _data_fim date DEFAULT NULL
)
RETURNS TABLE(mes date, entradas numeric, saidas numeric, saldo numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_access(_tenant, 'fluxo-caixa') THEN
    RAISE EXCEPTION 'Acesso negado ao fluxo de caixa deste tenant';
  END IF;

  RETURN QUERY
  SELECT
    date_trunc('month', COALESCE(l.data_pagamento, l.data_vencimento))::date AS mes,
    COALESCE(SUM(CASE WHEN l.tipo = 'receita' THEN l.valor ELSE 0 END), 0)::numeric AS entradas,
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa' THEN l.valor ELSE 0 END), 0)::numeric AS saidas,
    (COALESCE(SUM(CASE WHEN l.tipo = 'receita' THEN l.valor ELSE 0 END), 0)
     - COALESCE(SUM(CASE WHEN l.tipo = 'despesa' THEN l.valor ELSE 0 END), 0))::numeric AS saldo
  FROM public.lancamentos l
  WHERE l.tenant_id = _tenant
    AND (_data_inicio IS NULL OR COALESCE(l.data_pagamento, l.data_vencimento) >= _data_inicio)
    AND (_data_fim    IS NULL OR COALESCE(l.data_pagamento, l.data_vencimento) <= _data_fim)
  GROUP BY 1
  ORDER BY 1;
END $$;

REVOKE EXECUTE ON FUNCTION public.get_fluxo_caixa(uuid, date, date) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.get_fluxo_caixa(uuid, date, date) TO authenticated;
```

- [ ] **Step 2: Aplicar**

```bash
npx supabase db push --linked
```

Expected: `done.` Se der erro de dependência ao remover `has_role`, alguma policy ainda a referencia — liste com `SELECT policyname, tablename FROM pg_policies WHERE qual LIKE '%has_role%';` e troque por `can_access` antes de repetir.

- [ ] **Step 3: Escrever o teste das RPCs**

Crie `src/test/rls/funcoes.test.ts`:

```ts
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

describe("RPCs respeitam o tenant", () => {
  const admin = createAdminClient();
  let tenantA: string;
  let tenantB: string;
  let clienteA: SupabaseClient;
  let clienteB: SupabaseClient;
  let userIds: string[] = [];

  beforeAll(async () => {
    tenantA = (await seedTenant(admin, "Func A")).tenantId;
    tenantB = (await seedTenant(admin, "Func B")).tenantId;

    const emailA = uniqueEmail("func-a");
    const emailB = uniqueEmail("func-b");
    const a = await createMember(admin, tenantA, emailA, "master");
    const b = await createMember(admin, tenantB, emailB, "master");
    userIds = [a.userId, b.userId];

    const { data: banco } = await admin
      .from("bancos")
      .insert({ tenant_id: tenantA, nome: "Banco do A" })
      .select("id")
      .single();

    await admin.from("lancamentos").insert({
      tenant_id: tenantA,
      banco_id: banco!.id,
      tipo: "receita",
      status: "recebido",
      cliente_credor: "Cliente A",
      valor: 5000,
      valor_pago: 5000,
      data_vencimento: "2026-09-10",
      data_pagamento: "2026-09-10",
    });

    clienteA = await createUserClient(emailA, a.password);
    clienteB = await createUserClient(emailB, b.password);
  });

  afterAll(async () => {
    await cleanup(admin, userIds, [tenantA, tenantB]);
  });

  it("get_bancos_com_saldos devolve apenas bancos do próprio tenant", async () => {
    const { data: doA } = await clienteA.rpc("get_bancos_com_saldos", {});
    const { data: doB } = await clienteB.rpc("get_bancos_com_saldos", {});

    expect(doA!.some((b: { banco_nome: string }) => b.banco_nome === "Banco do A")).toBe(true);
    expect(doB!.some((b: { banco_nome: string }) => b.banco_nome === "Banco do A")).toBe(false);
  });

  it("get_fluxo_caixa devolve dados para o dono", async () => {
    const { data, error } = await clienteA.rpc("get_fluxo_caixa", { _tenant: tenantA });

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(Number(data![0].entradas)).toBe(5000);
  });

  it("get_fluxo_caixa recusa tenant alheio", async () => {
    const { error } = await clienteB.rpc("get_fluxo_caixa", { _tenant: tenantA });

    expect(error).not.toBeNull();
    expect(error!.message).toContain("Acesso negado");
  });

  it("execute_readonly_query não é chamável por usuário autenticado", async () => {
    const { error } = await clienteA.rpc("execute_readonly_query", {
      query_text: "SELECT 1",
    });

    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 4: Rodar**

```bash
npm run test:rls
```

Expected: PASS. O teste `get_bancos_com_saldos devolve apenas bancos do próprio tenant` é o que confirma na prática que a função `SECURITY INVOKER` herda o isolamento das policies, sem precisar de parâmetro de tenant.

- [ ] **Step 5: Verificar o advisor**

Use a ferramenta de advisors do Supabase apontando para a branch de teste, ou:

```bash
npx supabase db execute --linked "SELECT proname, prosecdef, proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' ORDER BY prosecdef DESC, proname;"
```

Expected: nenhuma função `SECURITY DEFINER` com `proconfig` nulo. As funções `has_role`, `get_user_role`, `has_permission` e `rls_auto_enable` não aparecem mais.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260824120600_security_definer_cleanup.sql src/test/rls/funcoes.test.ts
git commit -m "fix(security): tranca funções SECURITY DEFINER e adiciona get_fluxo_caixa"
```

---

## Task 9: Trilha de auditoria

**Files:**
- Create: `supabase/migrations/20260824120700_audit_log.sql`

**Interfaces:**
- Consumes: `can_access` da Task 4.
- Produces: tabela `audit_log(id, tenant_id, user_id, tabela, operacao, registro_id, antes, depois, created_at)`.

- [ ] **Step 1: Escrever a migration**

Crie `supabase/migrations/20260824120700_audit_log.sql`:

```sql
CREATE TABLE public.audit_log (
  id          bigserial PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     uuid,
  tabela      text NOT NULL,
  operacao    text NOT NULL,
  registro_id uuid,
  antes       jsonb,
  depois      jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_tenant_data ON public.audit_log(tenant_id, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_select ON public.audit_log FOR SELECT TO authenticated
  USING (public.can_access(tenant_id, 'usuarios'));

-- Sem policy de INSERT: só o trigger (SECURITY DEFINER) escreve aqui.
-- Uma trilha que o próprio usuário pode forjar não é trilha.

CREATE OR REPLACE FUNCTION public.audit_lancamentos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (tenant_id, user_id, tabela, operacao, registro_id, antes)
    VALUES (OLD.tenant_id, auth.uid(), TG_TABLE_NAME, TG_OP, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (tenant_id, user_id, tabela, operacao, registro_id, antes, depois)
    VALUES (NEW.tenant_id, auth.uid(), TG_TABLE_NAME, TG_OP, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    INSERT INTO public.audit_log (tenant_id, user_id, tabela, operacao, registro_id, depois)
    VALUES (NEW.tenant_id, auth.uid(), TG_TABLE_NAME, TG_OP, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.audit_lancamentos() FROM anon, public;

DROP TRIGGER IF EXISTS trg_audit_lancamentos ON public.lancamentos;
CREATE TRIGGER trg_audit_lancamentos
  AFTER INSERT OR UPDATE OR DELETE ON public.lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.audit_lancamentos();

DROP TRIGGER IF EXISTS trg_audit_bancos ON public.bancos;
CREATE TRIGGER trg_audit_bancos
  AFTER INSERT OR UPDATE OR DELETE ON public.bancos
  FOR EACH ROW EXECUTE FUNCTION public.audit_lancamentos();
```

- [ ] **Step 2: Aplicar**

```bash
npx supabase db push --linked
```

Expected: `done.`

- [ ] **Step 3: Adicionar teste de auditoria**

Acrescente a `src/test/rls/funcoes.test.ts`, como novo `describe` no final do arquivo:

```ts
describe("trilha de auditoria", () => {
  const admin = createAdminClient();
  let tenantId: string;
  let cliente: SupabaseClient;
  let userIds: string[] = [];

  beforeAll(async () => {
    tenantId = (await seedTenant(admin, "Audit")).tenantId;
    const email = uniqueEmail("audit");
    const m = await createMember(admin, tenantId, email, "master");
    userIds = [m.userId];
    cliente = await createUserClient(email, m.password);
  });

  afterAll(async () => {
    await admin.from("audit_log").delete().eq("tenant_id", tenantId);
    await cleanup(admin, userIds, [tenantId]);
  });

  it("registra a criação de um lançamento", async () => {
    const { data: lanc } = await cliente
      .from("lancamentos")
      .insert({
        tipo: "despesa",
        status: "a_pagar",
        cliente_credor: "Auditado",
        valor: 77,
        data_vencimento: "2026-10-01",
      })
      .select("id")
      .single();

    const { data: log } = await cliente
      .from("audit_log")
      .select("operacao, tabela, registro_id")
      .eq("registro_id", lanc!.id);

    expect(log).toHaveLength(1);
    expect(log![0].operacao).toBe("INSERT");
    expect(log![0].tabela).toBe("lancamentos");
  });

  it("não permite que o usuário escreva na trilha", async () => {
    const { error } = await cliente.from("audit_log").insert({
      tenant_id: tenantId,
      tabela: "lancamentos",
      operacao: "FORJADO",
    });

    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 4: Rodar**

```bash
npm run test:rls
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx supabase gen types typescript --linked > src/integrations/supabase/types.ts
git add supabase/migrations/20260824120700_audit_log.sql src/test/rls/funcoes.test.ts src/integrations/supabase/types.ts
git commit -m "feat(db): trilha de auditoria em lancamentos e bancos"
```

---

## Task 10: RPC me() e refatoração do AuthContext

**Files:**
- Create: `supabase/migrations/20260824120800_rpc_me.sql`
- Modify: `src/contexts/AuthContext.tsx`

**Interfaces:**
- Consumes: `tenant_members`, `profiles`.
- Produces: RPC `me()` retornando `jsonb` no formato `{ user_id, nome, email, tenants: [{ id, nome, slug, role }], permissions: [{ tenant_id, module_key, allowed }] }`. Consumido pelo `AuthContext` e pelo `TenantContext` da Task 11.

- [ ] **Step 1: Escrever a migration**

Crie `supabase/migrations/20260824120800_rpc_me.sql`:

```sql
-- Uma chamada devolve tudo que o app precisa saber sobre a sessão, substituindo
-- as duas queries sequenciais que o AuthContext dispara a cada login.

CREATE OR REPLACE FUNCTION public.me()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'user_id', auth.uid(),
    'nome',    (SELECT p.nome  FROM public.profiles p WHERE p.user_id = auth.uid()),
    'email',   (SELECT p.email FROM public.profiles p WHERE p.user_id = auth.uid()),
    'tenants', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id, 'nome', t.nome, 'slug', t.slug, 'role', tm.role
      ) ORDER BY t.nome)
      FROM public.tenant_members tm
      JOIN public.tenants t ON t.id = tm.tenant_id
      WHERE tm.user_id = auth.uid() AND t.ativo
    ), '[]'::jsonb),
    'permissions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'tenant_id', up.tenant_id, 'module_key', up.module_key, 'allowed', up.allowed
      ))
      FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
    ), '[]'::jsonb)
  )
$$;

REVOKE EXECUTE ON FUNCTION public.me() FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.me() TO authenticated;
```

- [ ] **Step 2: Aplicar e testar manualmente**

```bash
npx supabase db push --linked
```

Expected: `done.`

- [ ] **Step 3: Reescrever o AuthContext**

Substitua o conteúdo de `src/contexts/AuthContext.tsx`:

```tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'master' | 'admin' | 'user';

export interface TenantSummary {
  id: string;
  nome: string;
  slug: string;
  role: AppRole;
}

export interface PermissionRow {
  tenant_id: string;
  module_key: string;
  allowed: boolean;
}

export interface MePayload {
  user_id: string;
  nome: string | null;
  email: string | null;
  tenants: TenantSummary[];
  permissions: PermissionRow[];
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  me: MePayload | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  userName: string | null;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<MePayload | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = async () => {
    const { data, error } = await supabase.rpc('me');
    if (error) {
      setMe(null);
      return;
    }
    setMe(data as unknown as MePayload);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        if (nextSession?.user) {
          // Chamadas ao Supabase dentro do callback precisam ser adiadas.
          setTimeout(() => {
            fetchMe().finally(() => setLoading(false));
          }, 0);
        } else {
          setMe(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setMe(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        me,
        loading,
        signIn,
        signOut,
        userName: me?.nome ?? me?.email?.split('@')[0] ?? null,
        refreshMe: fetchMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

> Atenção: `role` deixa de existir no `useAuth()`. Quem precisava dele passa a usar `useTenant().role`, criado na Task 11. O `App.tsx` e o `AppSidebar.tsx` quebram neste momento e são corrigidos na próxima tarefa — não tente compilar entre as duas.

- [ ] **Step 4: Commit**

```bash
npx supabase gen types typescript --linked > src/integrations/supabase/types.ts
git add supabase/migrations/20260824120800_rpc_me.sql src/contexts/AuthContext.tsx src/integrations/supabase/types.ts
git commit -m "feat(auth): RPC me() e AuthContext com uma única chamada de sessão"
```

---

## Task 11: TenantContext e seletor de tenant

**Files:**
- Create: `src/contexts/TenantContext.tsx`
- Create: `src/contexts/TenantContext.test.tsx`
- Create: `src/components/TenantSwitcher.tsx`
- Modify: `src/App.tsx`
- Modify: `src/hooks/useUserPermissions.ts`
- Modify: `src/components/AppSidebar.tsx`

**Interfaces:**
- Consumes: `useAuth()` com `me` da Task 10.
- Produces: `useTenant()` retornando `{ tenants, activeTenant, setActiveTenant, role, permissions, hasModule }`. Todos os hooks da Task 12 consomem `activeTenant.id`.

- [ ] **Step 1: Escrever o teste do contexto**

Crie `src/contexts/TenantContext.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TenantProvider, useTenant } from './TenantContext';
import type { MePayload } from './AuthContext';

const mePayload: MePayload = {
  user_id: 'u1',
  nome: 'Fabio',
  email: 'fabio@example.com',
  tenants: [
    { id: 't1', nome: 'Alpha', slug: 'alpha', role: 'master' },
    { id: 't2', nome: 'Beta', slug: 'beta', role: 'user' },
  ],
  permissions: [{ tenant_id: 't2', module_key: 'receitas', allowed: true }],
};

vi.mock('./AuthContext', async () => {
  const actual = await vi.importActual<typeof import('./AuthContext')>('./AuthContext');
  return { ...actual, useAuth: () => ({ me: mePayload, loading: false }) };
});

function Sonda() {
  const { activeTenant, role, hasModule, setActiveTenant } = useTenant();
  return (
    <div>
      <span data-testid="tenant">{activeTenant?.nome}</span>
      <span data-testid="role">{role}</span>
      <span data-testid="receitas">{String(hasModule('receitas'))}</span>
      <span data-testid="usuarios">{String(hasModule('usuarios'))}</span>
      <button onClick={() => setActiveTenant('t2')}>trocar</button>
    </div>
  );
}

describe('TenantContext', () => {
  beforeEach(() => localStorage.clear());

  it('seleciona o primeiro tenant por padrão', async () => {
    render(<TenantProvider><Sonda /></TenantProvider>);
    await waitFor(() => expect(screen.getByTestId('tenant')).toHaveTextContent('Alpha'));
    expect(screen.getByTestId('role')).toHaveTextContent('master');
  });

  it('master enxerga todos os módulos', async () => {
    render(<TenantProvider><Sonda /></TenantProvider>);
    await waitFor(() => expect(screen.getByTestId('usuarios')).toHaveTextContent('true'));
  });

  it('user só enxerga os módulos concedidos naquele tenant', async () => {
    render(<TenantProvider><Sonda /></TenantProvider>);
    await userEvent.click(screen.getByText('trocar'));

    await waitFor(() => expect(screen.getByTestId('tenant')).toHaveTextContent('Beta'));
    expect(screen.getByTestId('role')).toHaveTextContent('user');
    expect(screen.getByTestId('receitas')).toHaveTextContent('true');
    expect(screen.getByTestId('usuarios')).toHaveTextContent('false');
  });

  it('persiste a escolha e a restaura', async () => {
    localStorage.setItem('finance-flow:tenant', 't2');
    render(<TenantProvider><Sonda /></TenantProvider>);
    await waitFor(() => expect(screen.getByTestId('tenant')).toHaveTextContent('Beta'));
  });

  it('ignora tenant persistido que não pertence mais ao usuário', async () => {
    localStorage.setItem('finance-flow:tenant', 't-inexistente');
    render(<TenantProvider><Sonda /></TenantProvider>);
    await waitFor(() => expect(screen.getByTestId('tenant')).toHaveTextContent('Alpha'));
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npm run test:unit -- TenantContext
```

Expected: FAIL com `Failed to resolve import "./TenantContext"`.

- [ ] **Step 3: Implementar o contexto**

Crie `src/contexts/TenantContext.tsx`:

```tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth, type AppRole, type TenantSummary } from './AuthContext';

const STORAGE_KEY = 'finance-flow:tenant';

interface TenantContextType {
  tenants: TenantSummary[];
  activeTenant: TenantSummary | null;
  setActiveTenant: (tenantId: string) => void;
  role: AppRole | null;
  hasModule: (moduleKey: string) => boolean;
  loading: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(null);

  const tenants = useMemo(() => me?.tenants ?? [], [me]);

  // Resolve o tenant ativo sempre validando contra a lista vinda do servidor:
  // um id persistido pode ter perdido validade desde a última sessão.
  useEffect(() => {
    if (tenants.length === 0) {
      setActiveId(null);
      return;
    }
    const persisted = localStorage.getItem(STORAGE_KEY);
    const valido = persisted && tenants.some((t) => t.id === persisted);
    setActiveId(valido ? persisted : tenants[0].id);
  }, [tenants]);

  const setActiveTenant = (tenantId: string) => {
    if (!tenants.some((t) => t.id === tenantId)) return;
    localStorage.setItem(STORAGE_KEY, tenantId);
    setActiveId(tenantId);
  };

  const activeTenant = tenants.find((t) => t.id === activeId) ?? null;
  const role = activeTenant?.role ?? null;

  const hasModule = (moduleKey: string) => {
    if (!activeTenant) return false;
    if (role === 'master' || role === 'admin') return true;
    return (me?.permissions ?? []).some(
      (p) => p.tenant_id === activeTenant.id && p.module_key === moduleKey && p.allowed
    );
  };

  return (
    <TenantContext.Provider
      value={{ tenants, activeTenant, setActiveTenant, role, hasModule, loading }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npm run test:unit -- TenantContext
```

Expected: PASS nos cinco testes.

- [ ] **Step 5: Atualizar o App.tsx**

Em `src/App.tsx`, troque a importação de permissões e os guardas de rota.

Substitua a linha 10-11:

```tsx
import { useTenant } from "@/contexts/TenantContext";
import { TenantProvider } from "@/contexts/TenantContext";
```

Substitua as funções `MasterRoute` e `PermissionRoute`:

```tsx
function MasterRoute({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  const { role } = useTenant();

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (role !== 'master') {
    return <Navigate to="/insights" replace />;
  }

  return <>{children}</>;
}

function PermissionRoute({ moduleKey, children }: { moduleKey: string; children: React.ReactNode }) {
  const { loading } = useAuth();
  const { hasModule, activeTenant } = useTenant();

  if (loading || !activeTenant) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasModule(moduleKey)) {
    return <Navigate to="/insights" replace />;
  }

  return <>{children}</>;
}
```

E envolva as rotas com o provider, substituindo o corpo de `App`:

```tsx
const App = () => {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 2,
        gcTime: 1000 * 60 * 10,
        refetchOnWindowFocus: false,
      },
    },
  }));
  return (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TenantProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </TenantProvider>
    </AuthProvider>
  </QueryClientProvider>
  );
};
```

Remova a importação agora não usada de `useMyPermissions`, `hasModuleAccess`, `ROUTE_TO_MODULE` e `ModuleKey` da linha 10-11 original.

- [ ] **Step 6: Criar o seletor de tenant**

Crie `src/components/TenantSwitcher.tsx`:

```tsx
import { Building2, Check, ChevronsUpDown } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function TenantSwitcher() {
  const { tenants, activeTenant, setActiveTenant } = useTenant();

  // Com um único tenant não há o que escolher: mostra o nome, sem controle.
  if (tenants.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-sidebar-foreground">
        <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{activeTenant?.nome ?? '—'}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between px-2 cursor-pointer"
          aria-label="Trocar de organização"
        >
          <span className="flex items-center gap-2 min-w-0">
            <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{activeTenant?.nome ?? 'Selecione'}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {tenants.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onSelect={() => setActiveTenant(t.id)}
            className="cursor-pointer"
          >
            <Check
              className={`mr-2 h-4 w-4 ${t.id === activeTenant?.id ? 'opacity-100' : 'opacity-0'}`}
              aria-hidden="true"
            />
            <span className="truncate">{t.nome}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 7: Ligar o seletor na sidebar**

Em `src/components/AppSidebar.tsx`, importe o componente e o contexto:

```tsx
import { TenantSwitcher } from '@/components/TenantSwitcher';
import { useTenant } from '@/contexts/TenantContext';
```

Troque toda leitura de `role` vinda de `useAuth()` por `useTenant()`, e toda checagem de permissão por `hasModule(...)`. Renderize `<TenantSwitcher />` no topo do conteúdo da sidebar, acima da lista de navegação.

- [ ] **Step 8: Rodar tudo e verificar o build**

```bash
npm run test:unit && npm run lint && npm run build
```

Expected: testes PASS, lint sem erros, build concluído. Se o build acusar `Property 'role' does not exist`, é um consumidor de `useAuth().role` que ficou para trás — troque por `useTenant().role`.

- [ ] **Step 9: Commit**

```bash
git add src/contexts/TenantContext.tsx src/contexts/TenantContext.test.tsx src/components/TenantSwitcher.tsx src/App.tsx src/components/AppSidebar.tsx
git commit -m "feat(tenant): TenantContext, seletor de organização e guardas de rota por tenant"
```

---

## Task 12: Hooks com escopo de tenant

**Files:**
- Modify: `src/hooks/useUserPermissions.ts`
- Modify: `src/hooks/useLancamentos.ts`
- Modify: `src/hooks/useBancos.ts`
- Modify: `src/hooks/useCategorias.ts`
- Modify: `src/hooks/useApiKeys.ts`
- Modify: `src/hooks/useAISettings.ts`
- Modify: `src/hooks/useTelegram.ts`
- Modify: `src/hooks/useChatMessages.ts`
- Modify: `src/hooks/useUsuarios.ts`
- Modify: `src/pages/FluxoCaixa.tsx`

**Interfaces:**
- Consumes: `useTenant()` da Task 11.
- Produces: hooks cujo cache é invalidado ao trocar de tenant.

- [ ] **Step 1: Ajustar o padrão em useBancos.ts**

Este é o padrão a repetir em todos os hooks. Em `src/hooks/useBancos.ts`, adicione a importação e altere `useBancos` e `useCreateBanco`:

```ts
import { useTenant } from '@/contexts/TenantContext';
```

```ts
export function useBancos() {
  const { activeTenant } = useTenant();

  return useQuery({
    queryKey: ['bancos', activeTenant?.id],
    enabled: !!activeTenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bancos')
        .select('*')
        .order('nome', { ascending: true });
      if (error) throw error;
      return data as Banco[];
    },
    staleTime: 1000 * 60 * 5,
  });
}
```

```ts
export function useCreateBanco() {
  const queryClient = useQueryClient();
  const { activeTenant } = useTenant();

  return useMutation({
    mutationFn: async (nome: string) => {
      if (!activeTenant) throw new Error('Nenhuma organização ativa');
      const { data, error } = await supabase
        .from('bancos')
        .insert({ nome, tenant_id: activeTenant.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bancos'] });
      queryClient.invalidateQueries({ queryKey: ['bancosComSaldos'] });
    },
  });
}
```

E em `useBancosComSaldos`, inclua o tenant na chave:

```ts
export function useBancosComSaldos(startDate?: Date, endDate?: Date) {
  const { activeTenant } = useTenant();
  const queryKey = ['bancosComSaldos', activeTenant?.id, startDate, endDate];

  return useQuery({
    queryKey,
    enabled: !!activeTenant,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_bancos_com_saldos', {
        data_inicio: startDate ? toISODateLocal(startDate) : undefined,
        data_fim: endDate ? toISODateLocal(endDate) : undefined,
      });
      if (error) throw error;
      return (data as BancoComSaldoRPC[]).map((item) => ({
        id: item.banco_id,
        nome: item.banco_nome,
        created_at: '',
        total_entradas: item.total_entradas ?? 0,
        total_saidas: item.total_saidas ?? 0,
        saldo: item.saldo ?? 0,
        entradas_recebidas: item.entradas_recebidas ?? 0,
        entradas_a_receber: item.entradas_a_receber ?? 0,
        saidas_pagas: item.saidas_pagas ?? 0,
        saidas_a_pagar: item.saidas_a_pagar ?? 0,
      })) as BancoComSaldo[];
    },
  });
}
```

- [ ] **Step 2: Aplicar o mesmo padrão nos demais hooks**

Para cada hook da lista de arquivos, aplique as três mudanças:

1. `const { activeTenant } = useTenant();` no topo do hook.
2. `activeTenant?.id` como segundo elemento da `queryKey`, e `enabled: !!activeTenant` na query.
3. `tenant_id: activeTenant.id` em todo `.insert(...)`, com o guarda `if (!activeTenant) throw new Error('Nenhuma organização ativa');` antes.

Mutações que só fazem `.update()` ou `.delete()` por `id` não precisam de `tenant_id`: a policy já impede alcançar linha de outro tenant, e o trigger `freeze_tenant_id` impede mover linha entre tenants.

- [ ] **Step 3: Reescrever useUserPermissions.ts para o modelo por tenant**

Substitua as funções de query em `src/hooks/useUserPermissions.ts`, mantendo `ALL_MODULES` e `ROUTE_TO_MODULE` como estão:

```ts
import { useTenant } from '@/contexts/TenantContext';

export function useAllPermissions() {
  const { activeTenant } = useTenant();

  return useQuery({
    queryKey: ['user_permissions_all', activeTenant?.id],
    enabled: !!activeTenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('tenant_id', activeTenant!.id);
      if (error) throw error;
      return data as Permission[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useTogglePermission() {
  const queryClient = useQueryClient();
  const { activeTenant } = useTenant();

  return useMutation({
    mutationFn: async ({ userId, moduleKey, allowed }: { userId: string; moduleKey: string; allowed: boolean }) => {
      if (!activeTenant) throw new Error('Nenhuma organização ativa');
      const { data, error } = await supabase
        .from('user_permissions')
        .upsert(
          { tenant_id: activeTenant.id, user_id: userId, module_key: moduleKey, allowed },
          { onConflict: 'tenant_id,user_id,module_key' }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_permissions_all'] });
    },
  });
}
```

Remova `useMyPermissions` e `hasModuleAccess`: sua função agora é do `useTenant().hasModule`. Atualize `Permission` para incluir `tenant_id: string`.

- [ ] **Step 4: Migrar a página de Fluxo de Caixa para a RPC agregada**

Em `src/pages/FluxoCaixa.tsx`, a leitura direta de `lancamentos` é substituída pela RPC criada na Task 8, para que quem tem apenas o módulo `fluxo-caixa` continue vendo a tela. Adicione ao hook de dados da página:

```ts
const { activeTenant } = useTenant();

const { data: fluxo } = useQuery({
  queryKey: ['fluxoCaixa', activeTenant?.id, startDate, endDate],
  enabled: !!activeTenant,
  queryFn: async () => {
    const { data, error } = await supabase.rpc('get_fluxo_caixa', {
      _tenant: activeTenant!.id,
      _data_inicio: startDate ? toISODateLocal(startDate) : undefined,
      _data_fim: endDate ? toISODateLocal(endDate) : undefined,
    });
    if (error) throw error;
    return data as { mes: string; entradas: number; saidas: number; saldo: number }[];
  },
});
```

- [ ] **Step 5: Verificar**

```bash
npm run test:unit && npm run lint && npm run build
```

Expected: PASS, sem erros de lint, build concluído.

- [ ] **Step 6: Testar o app manualmente contra a branch**

Aponte `.env` para a branch de teste e rode:

```bash
npm run dev
```

Expected: login funciona, a sidebar mostra "Principal", e as telas de Receitas, Despesas, Bancos, Categorias e Fluxo de Caixa carregam com os dados do tenant. Volte o `.env` para produção ao terminar.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/ src/pages/FluxoCaixa.tsx
git commit -m "feat(tenant): escopo de organização em todos os hooks de dados"
```

---

## Task 13: Hardening das edge functions

**Files:**
- Delete: `supabase/functions/setup-master/`
- Modify: `supabase/config.toml`
- Modify: `supabase/functions/create-user/index.ts`
- Modify: `supabase/functions/delete-user/index.ts`
- Create: `supabase/functions/_shared/cors.ts`

**Interfaces:**
- Consumes: `tenant_members` da Task 2.
- Produces: `corsHeaders(origin: string | null): Record<string, string>` exportado de `_shared/cors.ts`, usado por todas as functions.

- [ ] **Step 1: Remover a função setup-master**

```bash
git rm -r supabase/functions/setup-master
npx supabase functions delete setup-master --project-ref <ref-da-branch>
```

Expected: a função some da listagem em `npx supabase functions list`.

- [ ] **Step 2: Criar o helper de CORS com allowlist**

Crie `supabase/functions/_shared/cors.ts`:

```ts
// Allowlist vem do ambiente. Sem ela, nenhuma origem é liberada — falhar fechado
// é preferível a herdar o "*" que estava aqui antes.
const permitidas = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export function corsHeaders(origin: string | null): Record<string, string> {
  const liberada = origin && permitidas.includes(origin) ? origin : permitidas[0] ?? "";
  return {
    "Access-Control-Allow-Origin": liberada,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-api-key",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Vary": "Origin",
  };
}
```

Configure o segredo na branch e depois em produção:

```bash
npx supabase secrets set ALLOWED_ORIGINS="https://seu-dominio.vercel.app,http://localhost:8080"
```

- [ ] **Step 3: Atualizar create-user para o modelo de tenant**

Em `supabase/functions/create-user/index.ts`, troque o bloco de CORS e a checagem de papel.

Substitua o objeto `corsHeaders` estático pela importação:

```ts
import { corsHeaders } from "../_shared/cors.ts";
```

E, dentro do handler, resolva os headers pela origem da requisição:

```ts
  const cors = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
```

Troque toda ocorrência de `...corsHeaders` por `...cors`.

Substitua a checagem de papel global pela checagem dentro do tenant:

```ts
    const { email, password, nome, role, tenantId } = await req.json();

    if (!email || !password || !nome || !role || !tenantId) {
      return new Response(
        JSON.stringify({ error: 'Dados incompletos' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const { data: membership } = await supabaseAdmin
      .from('tenant_members')
      .select('role')
      .eq('user_id', requestingUser.id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (membership?.role !== 'master') {
      return new Response(
        JSON.stringify({ error: 'Apenas o master da organização pode criar usuários' }),
        { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }
```

E o vínculo do novo usuário passa a ser em `tenant_members`:

```ts
    const { error: memberError } = await supabaseAdmin
      .from('tenant_members')
      .insert({ tenant_id: tenantId, user_id: newUser.user.id, role });

    if (memberError) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return new Response(
        JSON.stringify({ error: 'Erro ao vincular o usuário à organização' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }
```

- [ ] **Step 4: Atualizar delete-user pelo mesmo padrão**

Em `supabase/functions/delete-user/index.ts`: mesma troca de CORS, mesma checagem de `tenant_members` para o solicitante, e a proteção do alvo passa a ser "não é possível remover o master da organização", consultando `tenant_members` em vez de `user_roles`. Se o usuário removido pertencer a outros tenants, remova apenas o vínculo com o tenant informado e só apague a conta quando `tenant_members` não tiver mais nenhuma linha para ele.

- [ ] **Step 5: Religar o verify_jwt**

Substitua o conteúdo de `supabase/config.toml`:

```toml
project_id = "ngjoyxtmrfmnepwwontd"

# Autentica por x-api-key, não por JWT de usuário.
[functions.api]
verify_jwt = false

# Webhook do Telegram: protegido pelo secret token do próprio Telegram.
[functions.telegram-poll]
verify_jwt = false

[functions.chat]
verify_jwt = true

[functions.create-user]
verify_jwt = true

[functions.delete-user]
verify_jwt = true

[functions.ai-router]
verify_jwt = true

[functions.telegram-pair]
verify_jwt = true

[functions.agent]
verify_jwt = true
```

- [ ] **Step 6: Publicar e testar**

```bash
npx supabase functions deploy create-user delete-user --project-ref <ref-da-branch>
```

Teste que a função rejeita quem não é master do tenant:

```bash
curl -i -X POST "https://<ref-da-branch>.supabase.co/functions/v1/create-user" \
  -H "Content-Type: application/json" \
  -d '{"email":"x@y.z","password":"Aa123456","nome":"X","role":"user","tenantId":"<id>"}'
```

Expected: `HTTP/2 401` — sem `Authorization`, o `verify_jwt = true` barra antes mesmo do código rodar.

- [ ] **Step 7: Commit**

```bash
git add supabase/config.toml supabase/functions/
git commit -m "fix(security): remove setup-master, restaura verify_jwt e aplica allowlist de CORS"
```

---

## Task 14: Hash e limite de uso das API keys

**Files:**
- Create: `supabase/migrations/20260824120900_api_keys_hash.sql`
- Modify: `supabase/functions/api/index.ts`
- Modify: `src/hooks/useApiKeys.ts`
- Modify: `src/pages/ApiKeys.tsx`

**Interfaces:**
- Consumes: `tenant_id` em `api_keys` da Task 3.
- Produces: colunas `api_keys.hash` e `api_keys.prefixo`; a coluna `chave` deixa de existir.

- [ ] **Step 1: Escrever a migration**

Crie `supabase/migrations/20260824120900_api_keys_hash.sql`:

```sql
-- Chave em texto puro no banco significa que um dump vira acesso à API.
-- Passamos a guardar só o hash; o prefixo existe apenas para o usuário
-- reconhecer qual chave é qual na tela.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.api_keys ADD COLUMN hash    text;
ALTER TABLE public.api_keys ADD COLUMN prefixo text;

-- Converte as chaves existentes sem invalidá-las.
UPDATE public.api_keys
SET hash    = encode(extensions.digest(chave, 'sha256'), 'hex'),
    prefixo = left(chave, 11)
WHERE hash IS NULL;

ALTER TABLE public.api_keys ALTER COLUMN hash    SET NOT NULL;
ALTER TABLE public.api_keys ALTER COLUMN prefixo SET NOT NULL;
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_hash_unico UNIQUE (hash);
ALTER TABLE public.api_keys DROP COLUMN chave;

CREATE INDEX idx_api_access_logs_janela
  ON public.api_access_logs (api_key_id, created_at DESC);
```

- [ ] **Step 2: Aplicar**

```bash
npx supabase db push --linked
npx supabase db execute --linked "SELECT prefixo, length(hash) FROM api_keys;"
```

Expected: `length` igual a 64 em todas as linhas (sha256 em hex).

- [ ] **Step 3: Atualizar a autenticação da edge function**

Em `supabase/functions/api/index.ts`, substitua o bloco de autenticação por chave (linhas 60-72 do arquivo atual):

```ts
    // ============ Auth via API key ============
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return json({ error: "API key is required. Add X-API-Key header." }, 401);
    }

    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(apiKey)
    );
    const apiKeyHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { data: keyData, error: keyError } = await supabase
      .from("api_keys")
      .select("id, ativa, tenant_id")
      .eq("hash", apiKeyHash)
      .single();

    if (keyError || !keyData) return json({ error: "Invalid API key" }, 401);
    if (!keyData.ativa) return json({ error: "API key is inactive" }, 403);

    // ============ Rate limit: 100 req/min por chave ============
    const umMinutoAtras = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supabase
      .from("api_access_logs")
      .select("id", { count: "exact", head: true })
      .eq("api_key_id", keyData.id)
      .gte("created_at", umMinutoAtras);

    if ((count ?? 0) >= 100) {
      return json(
        { error: "Rate limit exceeded. Max 100 requests per minute." },
        429
      );
    }

    const tenantId = keyData.tenant_id;
```

Em seguida, toda query desta function que toque `lancamentos`, `bancos` ou `categorias` ganha `.eq("tenant_id", tenantId)` na leitura e `tenant_id: tenantId` na escrita. A function usa service role e portanto **ignora RLS** — este filtro é a única barreira de tenant nesse caminho.

- [ ] **Step 4: Atualizar a criação de chave no frontend**

Em `src/hooks/useApiKeys.ts`, a chave passa a ser gerada e devolvida uma única vez, e só o hash vai ao banco:

```ts
export function useCreateApiKey() {
  const queryClient = useQueryClient();
  const { activeTenant } = useTenant();

  return useMutation({
    mutationFn: async (nome: string) => {
      if (!activeTenant) throw new Error('Nenhuma organização ativa');

      const chave = `mk_${crypto.randomUUID().replace(/-/g, '')}`;
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(chave)
      );
      const hash = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const { data, error } = await supabase
        .from('api_keys')
        .insert({
          nome,
          hash,
          prefixo: chave.slice(0, 11),
          tenant_id: activeTenant.id,
        })
        .select()
        .single();
      if (error) throw error;

      // A chave em claro existe só aqui. Depois desta tela, nunca mais.
      return { ...data, chaveEmClaro: chave };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api_keys'] });
    },
  });
}
```

Atualize a interface `ApiKey` removendo `chave: string` e adicionando `hash: string; prefixo: string; tenant_id: string;`.

- [ ] **Step 5: Atualizar a tela de API Keys**

Em `src/pages/ApiKeys.tsx`, a listagem passa a mostrar `prefixo` seguido de reticências em vez da chave inteira. Após criar uma chave, exiba a `chaveEmClaro` num diálogo com botão de copiar e o aviso de que ela não será mostrada novamente.

- [ ] **Step 6: Verificar**

```bash
npm run test:unit && npm run lint && npm run build
```

Expected: PASS, sem erros, build concluído.

Teste o rate limit contra a branch:

```bash
for i in $(seq 1 105); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    "https://<ref-da-branch>.supabase.co/functions/v1/api/lancamentos" \
    -H "x-api-key: <chave-de-teste>"
done | sort | uniq -c
```

Expected: aproximadamente 100 respostas `200` e o restante `429`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260824120900_api_keys_hash.sql supabase/functions/api/index.ts src/hooks/useApiKeys.ts src/pages/ApiKeys.tsx
git commit -m "fix(security): hash sha256 das API keys, escopo de tenant e rate limit"
```

---

## Task 15: Índices, limpeza final e promoção para produção

**Files:**
- Create: `supabase/migrations/20260824121000_indices_e_limpeza.sql`
- Modify: `finance-flow/CLAUDE.md`

**Interfaces:**
- Consumes: tudo das tarefas anteriores.
- Produces: schema final, sem `user_roles`.

- [ ] **Step 1: Escrever a migration**

Crie `supabase/migrations/20260824121000_indices_e_limpeza.sql`:

```sql
-- Índice composto para a query principal do app: lançamentos de um tenant,
-- por tipo e status, ordenados por vencimento.
CREATE INDEX IF NOT EXISTS idx_lancamentos_tenant_tipo_status_venc
  ON public.lancamentos (tenant_id, tipo, status, data_vencimento);

CREATE INDEX IF NOT EXISTS idx_bancos_tenant     ON public.bancos (tenant_id);
CREATE INDEX IF NOT EXISTS idx_categorias_tenant ON public.categorias (tenant_id);

-- user_roles foi substituída por tenant_members. Só cai agora, depois que
-- nenhuma policy, função ou linha de código a referencia.
DROP TABLE IF EXISTS public.user_roles;
```

- [ ] **Step 2: Aplicar e conferir o plano da query principal**

```bash
npx supabase db push --linked
npx supabase db execute --linked "EXPLAIN ANALYZE SELECT * FROM lancamentos WHERE tipo='despesa' AND status='a_pagar' ORDER BY data_vencimento LIMIT 50;"
```

Expected: o plano usa `Index Scan` sobre `idx_lancamentos_tenant_tipo_status_venc`, não `Seq Scan`.

- [ ] **Step 3: Rodar a suíte completa**

```bash
npm run test:rls && npm run test:unit && npm run lint && npm run build
```

Expected: PASS em tudo.

- [ ] **Step 4: Conferir o advisor de segurança na branch**

Rode o advisor de segurança do Supabase apontando para a branch.

Expected: nenhum item `ERROR`. Os `WARN` remanescentes aceitáveis são apenas `extension_in_public` (resolvido manualmente) e `auth_leaked_password_protection` (resolvido no painel).

- [ ] **Step 5: Atualizar a documentação do projeto**

Em `finance-flow/CLAUDE.md`, atualize:

- A tabela de banco de dados: `user_roles` sai, entram `tenants`, `tenant_members`, `platform_operators`, `audit_log`.
- A seção de autenticação: os papéis passam a valer por tenant, via `tenant_members.role`, e a autorização é aplicada no banco por `can_access`.
- A seção de migrations: passa a valer a regra de que toda alteração vai por arquivo em `supabase/migrations/`, nunca pelo painel.
- Acrescente a instrução de rodar `npm run test:rls` antes de qualquer merge que toque em policies.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260824121000_indices_e_limpeza.sql CLAUDE.md
git commit -m "chore(db): índices por tenant, remoção de user_roles e documentação atualizada"
```

- [ ] **Step 7: Promover para produção**

Este passo é irreversível e derruba o app por alguns segundos na troca de policies. Execute em janela combinada com o dono do sistema.

```bash
# 1. Backup antes de tudo
npx supabase db dump --linked -f backup-pre-multitenant.sql

# 2. Apontar o CLI para produção
npx supabase link --project-ref ngjoyxtmrfmnepwwontd

# 3. Conferir o que será aplicado
npx supabase db push --linked --dry-run

# 4. Aplicar
npx supabase db push --linked

# 5. Publicar as edge functions
npx supabase functions deploy api create-user delete-user
```

Expected: as onze migrations aplicam em ordem. Confira imediatamente:

```bash
npx supabase db execute --linked "SELECT count(*) FROM lancamentos WHERE tenant_id IS NULL;"
```

Expected: `0`.

- [ ] **Step 8: Executar as ações manuais no painel**

Conforme a seção final da spec:

1. Desabilitar signup público em Authentication → Providers → Email.
2. Ativar leaked password protection.
3. Mover `pg_net` do schema `public` para `extensions`.
4. `git rm --cached .env` e commit.
5. Rotacionar as chaves do projeto.

- [ ] **Step 9: Verificação final em produção**

Abra o app em produção e confirme: login funciona, a sidebar mostra "Principal", os 1.296 lançamentos aparecem, e um usuário `user` sem permissões não consegue ler `lancamentos` pelo console do navegador.

```js
// No console do navegador, logado como usuário sem permissões:
const { data } = await supabase.from('lancamentos').select('id');
console.log(data); // deve ser []
```

---

## Self-Review

**Cobertura da spec:**

| Requisito da spec | Task |
|---|---|
| Achado 1 — RLS `USING(true)` | 6 |
| Achado 2 — permissões só no cliente | 4, 6 |
| Achado 3 — signup público | 15 (ação manual) |
| Achado 4 — `.env` versionado | 15 (ação manual) |
| Achado 5 — `setup-master` | 13 |
| Achado 6 — API keys em texto puro + rate limit | 14 |
| Achado 7 — `ai_settings.api_key` | 13 (segredo de ambiente) |
| Achado 8 — CORS `*` | 13 |
| Achado 9 — `verify_jwt` | 13 |
| Achado 10 — `SECURITY DEFINER` e `search_path` | 8 |
| Achado 11 — senha vazada | 15 (ação manual) |
| Achado 12 — divergência banco/migrations | 15 (documentação) |
| Modelo de dados de tenant | 2, 3 |
| Isolamento do operador | 2, 7 |
| Motor `can_access` | 4 |
| Mapa módulo por tabela | 6, 7 |
| Preenchimento automático de tenant | 5 |
| Migração em 7 fases | 2, 3, 4, 5, 6, 12, 15 |
| Auditoria | 9 |
| RPC `me()` | 10 |
| `TenantContext` | 11 |
| Hooks com escopo | 12 |
| Testes de RLS | 1, 4, 7, 8, 9 |

**Lacuna conhecida:** a migração da sessão de `localStorage` para cookie `HttpOnly`, marcada como fase opcional na spec, não tem tarefa neste plano. Fica registrada para um plano futuro — não bloqueia produção e mexer em armazenamento de sessão junto com uma reescrita de RLS aumentaria o risco da janela de corte sem necessidade.
