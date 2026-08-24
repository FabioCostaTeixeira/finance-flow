# Segurança + Fundação Multitenant — Design

**Data:** 2026-08-24
**Sub-projeto:** A (de A/B/C/D)
**Status:** aprovado, aguardando plano de implementação

---

## Contexto

O Finance Flow vai para produção. Uma auditoria do código e do banco em produção
(`ngjoyxtmrfmnepwwontd`) encontrou uma falha crítica de autorização: qualquer usuário
autenticado lê e escreve **todos** os dados financeiros, independentemente do papel ou
das permissões configuradas na interface.

A base tem hoje 1.296 lançamentos, 116 categorias, 13 bancos e 2 usuários.

Este sub-projeto corrige a falha e, no mesmo movimento, introduz multitenancy. As duas
coisas são a mesma obra: ambas exigem reescrever todas as policies de RLS. Fazer
separado significaria reescrevê-las duas vezes.

### Achados que este design corrige

| # | Severidade | Achado |
|---|---|---|
| 1 | CRÍTICO | `lancamentos`, `bancos` e `categorias` têm policy `USING (true)` para todo `authenticated`. Confirmado ao vivo em `pg_policies`. Não existe coluna de dono nessas tabelas |
| 2 | CRÍTICO | `user_permissions` só é aplicado no cliente (`PermissionRoute`, `hasModuleAccess`). Um usuário sem permissão alguma lê e apaga tudo via API REST |
| 3 | CRÍTICO | Signup público precisa ser verificado. Se estiver ligado, qualquer pessoa se cadastra e cai no cenário dos itens 1 e 2 |
| 4 | ALTO | `.env` versionado no git, apesar do `.gitignore` |
| 5 | ALTO | `setup-master` é edge function sem autenticação que cria um usuário master |
| 6 | ALTO | API keys em texto puro, comparadas por igualdade, sem rate limiting |
| 7 | ALTO | `ai_settings.api_key` em texto puro na tabela |
| 8 | ALTO | `Access-Control-Allow-Origin: *` em funções que usam service role key |
| 9 | ALTO | `verify_jwt = false` em todas as edge functions |
| 10 | MÉDIO | Oito funções `SECURITY DEFINER` executáveis por `anon` via `/rest/v1/rpc/`. Destas, `audit_lancamentos` também está sem `search_path` (advisor do Supabase) |
| 11 | MÉDIO | Proteção contra senha vazada desativada |
| 12 | MÉDIO | Banco divergiu das migrations: `audit_lancamentos` e `rls_auto_enable` existem em produção mas não no repo |

### Decisões tomadas

- **Modelo de tenant:** organização compartilhada. Vários usuários por tenant, dados
  comuns dentro dele. Roles passam a valer dentro do tenant.
- **Dados atuais:** migrados para um tenant único chamado "Principal". Nada se perde.
- **Console de operador:** app separado no mesmo repo (sub-projeto B).
- **Permissões:** aplicação rigorosa. Permissão negada no banco significa dado invisível.

---

## Arquitetura

### Modelo de dados

```
tenants            (id uuid pk, nome text, slug text unique, plano text,
                    ativo boolean, created_at timestamptz)

tenant_members     (tenant_id uuid fk, user_id uuid fk, role app_role,
                    created_at timestamptz, pk (tenant_id, user_id))

platform_operators (user_id uuid pk fk, created_at timestamptz)
```

`tenant_id uuid NOT NULL` é adicionado em: `lancamentos`, `bancos`, `categorias`,
`api_keys`, `ai_settings`, `messaging_channels`, `chat_messages`.

`user_permissions` ganha `tenant_id`, e sua chave única passa a ser
`(tenant_id, user_id, module_key)`.

**`user_roles` é descontinuada.** O papel deixa de ser global e passa a ser
`tenant_members.role`. O mesmo usuário pode ser `admin` num tenant e `user` em outro.
A tabela antiga é mantida durante a migração e removida ao final.

**`ai_settings` deixa de ser linha única.** O `CHECK (id = 1)` sai; a tabela passa a ter
uma linha por tenant, com `tenant_id` como chave.

### Isolamento do operador de plataforma

`platform_operators` é deliberadamente uma tabela separada, não um valor de
`tenant_members.role`. As policies dos dados financeiros perguntam "este usuário é membro
deste tenant?". O operador não é membro de tenant nenhum, então a resposta é sempre não.
O isolamento é estrutural, não uma regra que alguém possa esquecer de escrever.

### Motor do RLS

Duas funções `SECURITY DEFINER STABLE`. `SECURITY DEFINER` evita recursão infinita
(a policy de `tenant_members` consultaria `tenant_members`); `STABLE` permite ao planner
reaproveitar o resultado dentro da mesma query.

```sql
CREATE FUNCTION public.my_tenant_ids() RETURNS SETOF uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() $$;

CREATE FUNCTION public.can_access(_tenant uuid, _module text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.tenant_id = _tenant
      AND (
        tm.role IN ('master','admin')
        OR EXISTS (
          SELECT 1 FROM user_permissions up
          WHERE up.user_id = auth.uid()
            AND up.tenant_id = _tenant
            AND up.module_key = _module
            AND up.allowed
        )
      )
  )
$$;
```

Toda função `SECURITY DEFINER` do projeto recebe `SET search_path = public` e
`REVOKE EXECUTE ... FROM anon, public`. Isso inclui as já existentes: `has_role`,
`get_user_role`, `has_permission`, `handle_new_user`, `set_chat_message_user_id`,
`audit_lancamentos`, `rls_auto_enable`.

### Mapa de módulo por tabela

`can_access` recebe o módulo correspondente à operação:

| Tabela | Módulo |
|---|---|
| `lancamentos` com `tipo = 'receita'` | `receitas` |
| `lancamentos` com `tipo = 'despesa'` | `despesas` |
| `bancos` | `bancos` |
| `categorias` | `categorias` |
| `api_keys` | `api` |
| `ai_settings` | `ai-settings` |
| `messaging_channels` | `telegram` |
| `chat_messages` | `insights` |

Em `lancamentos`, a policy usa o `tipo` da própria linha:

```sql
CREATE POLICY lancamentos_select ON lancamentos FOR SELECT TO authenticated
  USING (can_access(tenant_id,
    CASE WHEN tipo = 'receita' THEN 'receitas' ELSE 'despesas' END));
```

Transferências (`status = 'transferencia'`) exigem os dois módulos: a policy de INSERT e
UPDATE checa `can_access(tenant_id,'receitas') AND can_access(tenant_id,'despesas')`
quando o status for `transferencia`.

O módulo `fluxo-caixa` é somente-leitura e derivado: quem tem `fluxo-caixa` mas não tem
`receitas`/`despesas` não lê `lancamentos` diretamente. A tela de Fluxo de Caixa passa a
consumir a RPC `get_fluxo_caixa(tenant, periodo)`, que é `SECURITY DEFINER` e checa
`can_access(_tenant, 'fluxo-caixa')` internamente, devolvendo apenas agregados.

### Funções que contornam o RLS

Uma função `SECURITY DEFINER` roda com os privilégios de quem a criou e **ignora as
policies** das tabelas que lê. Uma função esquecida anula todo o trabalho de RLS, então o
inventário abaixo é exaustivo e foi levantado direto do catálogo (`pg_proc.prosecdef`):

| Função | `SECURITY DEFINER` | `search_path` | Ação |
|---|---|---|---|
| `audit_lancamentos` | sim | **ausente** | Reescrita para gravar em `audit_log`, com `SET search_path` |
| `execute_readonly_query` | sim | ok | Timeout, `LIMIT` forçado, escopo de tenant |
| `get_user_role` | sim | ok | Removida junto com `user_roles` |
| `has_role` | sim | ok | Removida; substituída por `can_access` |
| `has_permission` | sim | ok | Removida; substituída por `can_access` |
| `handle_new_user` | sim | ok | Mantida; `REVOKE` de `anon`/`authenticated` |
| `set_chat_message_user_id` | sim | ok | Mantida; `REVOKE` de `anon`/`authenticated` |
| `rls_auto_enable` | sim | ok | Avaliar remoção — não consta nas migrations |
| `get_bancos_com_saldos` | **não** (INVOKER) | ok | Nenhuma mudança de segurança necessária |
| `update_updated_at_column` | não | ok | Nenhuma |

`get_bancos_com_saldos` é `SECURITY INVOKER`: ela executa com os privilégios de quem
chama e portanto **respeita as policies** de `bancos` e `lancamentos`. Assim que as
policies de tenant entrarem, ela passa a ser filtrada automaticamente, sem precisar de
parâmetro de tenant. A suíte de testes de RLS confirma isso explicitamente, chamando a
RPC como usuário de outro tenant e afirmando resultado vazio.

`get_fluxo_caixa`, a função nova para o módulo `fluxo-caixa`, é criada como
`SECURITY DEFINER` justamente para permitir agregados a quem não pode ler as linhas — e
por isso checa `can_access(_tenant, 'fluxo-caixa')` na primeira instrução, levantando
exceção se falhar.

Todas as funções `SECURITY DEFINER` sobreviventes recebem
`REVOKE EXECUTE ... FROM anon, public`, fechando os WARN do advisor.

### Preenchimento automático do tenant

Trigger `BEFORE INSERT` em cada tabela com `tenant_id`: se o valor vier nulo, preenche com
o tenant ativo do usuário. O tenant ativo é resolvido por `my_tenant_ids()` quando o
usuário pertence a exatamente um tenant; havendo mais de um, o `tenant_id` passa a ser
obrigatório no payload e o trigger levanta exceção se vier nulo. Isso evita depender de
custom claims no JWT nesta fase.

---

## Migração

Executada primeiro numa branch do Supabase, nunca direto em produção.

| Fase | Ação | App |
|---|---|---|
| 1 | Cria `tenants` e insere "Principal". Cria `tenant_members` a partir de `user_roles`. Cria `platform_operators` vazia | no ar |
| 2 | Adiciona `tenant_id` **nullable** nas 7 tabelas e faz backfill com o tenant Principal | no ar |
| 3 | `SET NOT NULL`, FK com `ON DELETE RESTRICT`, triggers de preenchimento | no ar |
| 4 | Backfill de `user_permissions.tenant_id`. Concede todos os módulos ao usuário `master` | no ar |
| 5 | Deploy do frontend com `TenantContext` | no ar |
| 6 | Substitui as policies `USING(true)` pelas novas. Corrige `search_path` e `REVOKE` das funções | corte curto |
| 7 | Cria índice `(tenant_id, tipo, status, data_vencimento)`. Remove `user_roles` | no ar |

A fase 6 é o único ponto de indisponibilidade e deve rodar em janela combinada. Se algo
der errado, o rollback é recriar as policies `USING(true)` — o schema novo é aditivo até a
fase 7 e não impede o app antigo de funcionar.

---

## Hardening das edge functions

| Item | Correção |
|---|---|
| `setup-master` | Deletada. Já existe master em produção; a função só serve de porta dos fundos |
| `api_keys` | Passa a guardar `hash` (sha256) e `prefixo` (8 primeiros caracteres, para exibição). A chave completa é mostrada uma única vez, na criação. Ganha `tenant_id` obrigatório |
| Rate limiting | `api_access_logs` passa a ser consultada por janela: 100 requisições por minuto por chave, respondendo 429 ao estourar |
| `ai_settings.api_key` | Sai da tabela. Vai para Supabase Vault, lida apenas pela edge function |
| CORS | `*` substituído por allowlist de origens vinda de variável de ambiente |
| `verify_jwt` | Volta a `true` em `create-user`, `delete-user`, `ai-router`, `chat`, `telegram-pair`. Permanece `false` apenas em `api` (autentica por `x-api-key`) e `telegram-poll` (webhook, protegido por secret token do Telegram) |
| `execute_readonly_query` | Mantém acesso só a `service_role`, e ganha `statement_timeout` de 5s, `LIMIT` forçado e filtro obrigatório por `tenant_id` |

### Auditoria

Tabela `audit_log (id, tenant_id, user_id, tabela, operacao, registro_id, antes jsonb,
depois jsonb, created_at)`, alimentada por trigger em `lancamentos` e `bancos`. Leitura
restrita a `master` do próprio tenant. A função `audit_lancamentos` já existente em
produção é reescrita para gravar aqui.

---

## Frontend

### `TenantContext`

Envolve o `AuthContext`. Expõe `tenants`, `activeTenant`, `setActiveTenant`, `role`
(do tenant ativo) e `permissions` (do tenant ativo). Persiste a escolha do tenant ativo em
`localStorage`, validando contra a lista vinda do servidor a cada carga.

### RPC `me()`

Substitui as duas queries sequenciais que o `AuthContext` dispara hoje a cada login
(`fetchUserRole` + `fetchUserProfile`). Uma chamada devolve perfil, tenants e permissões.

### Hooks

Todos os hooks de dados passam a incluir `activeTenant.id` na `queryKey`, para que trocar
de tenant invalide o cache. O `tenant_id` não precisa ser enviado no payload de INSERT
quando o usuário tem um único tenant (o trigger preenche), mas os hooks o enviam
explicitamente de qualquer forma — deixa o comportamento previsível e prepara o caso de
múltiplos tenants.

### Fase opcional: sessão

Migrar a sessão de `localStorage` para memória, com refresh token em cookie `HttpOnly`,
mitiga roubo de sessão por XSS. Fica como última tarefa do sub-projeto e pode ser adiada
sem bloquear o resto.

---

## Testes

Vitest já está configurado no projeto (`vitest`, `@testing-library/react`, `jsdom`).

**Testes de RLS** são a entrega mais importante. Uma suíte que:

1. Cria dois tenants e três usuários (master do tenant A, user sem permissões do tenant A,
   master do tenant B).
2. Autentica como cada um usando um cliente Supabase real apontado para a branch.
3. Afirma vazamento zero: o master do tenant B não lê nada do tenant A; o usuário sem
   permissões não lê `lancamentos` nem por SELECT direto nem por RPC.
4. Afirma que operações de escrita cruzando tenants falham.

Este é o teste que impede a regressão que originou este trabalho.

Além disso: testes unitários de `can_access` via SQL, testes de componente para
`TenantContext` e o seletor de tenant, e testes das edge functions para hash de API key e
rate limiting.

---

## Fora de escopo

- Console de operador (sub-projeto B)
- Redesign visual (sub-projeto C)
- Otimização de performance, exceto o índice da fase 7 (sub-projeto D)
- Billing, planos e limites de uso por plano
- Convite de usuários por e-mail — nesta fase o master cria usuários direto, como hoje

---

## Ações manuais no painel do Supabase

Não são código e precisam ser executadas pelo dono do projeto:

1. Desabilitar signup público (Authentication → Providers → Email), se estiver ligado.
2. Ativar leaked password protection.
3. Mover a extensão `pg_net` do schema `public` para `extensions`.
4. `git rm --cached .env` e commit, para parar de versionar o arquivo. O `.gitignore` já
   o cobre; ele entrou no repo antes da regra existir.
5. Após a fase 7, rotacionar as chaves do projeto, já que o `.env` esteve versionado.
   A `VITE_SUPABASE_PUBLISHABLE_KEY` é pública por design e sozinha não é um vazamento —
   o problema era o RLS aberto atrás dela. Ainda assim, rotacionar é a higiene correta
   depois de uma exposição em histórico de git.
