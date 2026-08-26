# Feasibility Analyst — Independent Review
**Score: 5/10**
**Recommendation: REVISE**

Raciocínio **backward**: parto do resultado desejado — *"agentes de IA operam com
segurança sobre dados financeiros multi-tenant em produção"* — e volto até o que
precisa ser verdade. Cinco condições precisam valer simultaneamente:

1. **Isolamento**: toda leitura/escrita alcançável por agente é escopada por tenant,
   e o escopo é imposto por algo que o agente não controla.
2. **Atribuição**: toda escrita registra *quem* a fez.
3. **Contenção**: nenhuma chamada única causa perda ou inundação de dados.
4. **Repetibilidade**: retry de agente não duplica efeito financeiro (idempotência).
5. **Verificabilidade**: existe teste que exercita exatamente o caminho exposto.

A proposta endereça (1) por intenção, (2) via P6, (3) parcialmente, (4) por
declaração sem base, e (5) não endereça. As duas primeiras — as mais caras —
apoiam-se em premissas sobre o código atual que **não se sustentam na leitura**.

---

## Findings

### F1 — [P1] [EXISTING_DEFECT] A "fronteira de segurança no banco" é inerte para todo chamador via API key
**Evidence:**
`supabase/migrations/20260826000500_fix_get_bancos_com_saldos_transferencia.sql:29`
```sql
WHERE b.tenant_id = _tenant AND public.can_access(_tenant, 'bancos')
```
`supabase/migrations/20260825000300_rls_engine.sql:22-26`
```sql
SELECT EXISTS (
  SELECT 1 FROM public.tenant_members tm
  WHERE tm.user_id = auth.uid()
    AND tm.tenant_id = _tenant
```
`supabase/functions/api/index.ts:67-69`
```ts
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
```
`supabase/functions/api/index.ts:449-456` chama esse RPC nesse cliente.

**Why it matters:** o cliente é criado com service role e **sem JWT de usuário**.
`auth.uid()` é NULL, `tm.user_id = NULL` nunca casa, `can_access` retorna FALSE, e o
RPC — que é `SECURITY DEFINER`, portanto passa por cima de RLS mas **não** por cima
do próprio predicado — retorna **zero linhas**. `GET /bancos?com_saldos=true`
devolve `[]` a todo consumidor de API key. Um agente lê "saldo zero" e trata como
fato financeiro.

O impacto arquitetural é maior que o bug: a proposta §3 afirma *"fronteira de
segurança **no banco**, não no agente"*. O mecanismo de banco existente
(`can_access` / RLS) é chaveado em `auth.uid()`, que o caminho de API key **nunca
possui**. Hoje a única fronteira real é o `.eq("tenant_id", …)` escrito em
TypeScript em cada branch da edge function — exatamente a fronteira "no
aplicativo" que a proposta diz não estar adotando. Para a Fase 1 entregar o que
promete é preciso *ou* emitir um JWT de usuário por API key, *ou* introduzir um
contexto de tenant no banco (`set_config('app.tenant_id', …)` + policies novas).
Nenhuma das duas está em nenhuma fase. Isso é trabalho de migração + revisão de
RLS — e o `CLAUDE.md` exige validação com o usuário antes de mexer em RLS.

**Falsification test:** uma chamada read-only:
`curl -H "X-API-Key: <chave real>" "<url>/api/bancos?com_saldos=true"`.
Se retornar bancos com saldos, F1 está errado. Barato (um comando), **ninguém
executou** — por isso está limitado a P1 e não a P0. Alternativa igualmente
barata: `select public.can_access('<tenant>','bancos');` numa sessão service_role.
**Confidence:** High (código), Medium (comportamento em produção — `[STATIC-INFERENCE]`).

---

### F2 — [P1] [EXISTING_DEFECT] `GET /lancamentos` filtra por uma coluna que a view não tem
**Evidence:** `supabase/functions/api/index.ts:284`
```ts
let query = supabase.from("lancamentos_bi").select("*").eq("tenant_id", keyData.tenant_id);
```
`supabase/migrations/20260824231544_remote_schema.sql:509-527` — a view
`lancamentos_bi` seleciona `id, data_vencimento, cliente_credor, valor, valor_pago,
banco, status, tipo, categoria, categoria_pai, parcela_atual, total_parcelas,
observacao, data_pagamento, created_at`. **Não há `tenant_id`.**
Confirmado por duas fontes independentes do schema vivo:
- `backups/prod_backup_schema_20260826.sql:509-527` (mesma definição, backup de ontem)
- `src/integrations/supabase/types.ts:541-558` (tipos gerados; `Row` sem `tenant_id`)

Nenhuma migração posterior redefine a view (`grep lancamentos_bi supabase/migrations/`
só acerta `20260824231544`).

**Why it matters:** PostgREST responde `42703 column lancamentos_bi.tenant_id does
not exist`; o `throw` cai no catch interno (`api/index.ts:508-510`) e vira **500**.
Ou seja: o endpoint de listagem — a leitura mais usada e a base direta de
`consultar_entidade` na Fase 1 — não está truncando silenciosamente em 1000 linhas;
está **quebrado**. Isso corrige o P1 da proposta: o defeito de paginação é real como
princípio (não há `.range()` em lugar nenhum da function — o único `.limit()` é o
`:155`, de recorrência), mas o modo de falha descrito ("agente recebe 1000 linhas e
trata como completo") não é o que acontece.

Corolário mais grave: `lancamentos_bi` é `security_invoker='true'`
(`20260824231544_remote_schema.sql:509`). Para `authenticated` isso aplica a RLS de
`lancamentos`; para **service_role**, RLS é ignorada e a view **não tem coluna
alguma de tenant**. É uma superfície de leitura cross-tenant estruturalmente
não-escopável. `mcp/src/index.ts:517-521` (`consultar_lancamentos_bi`) lê essa view
com service role e sem filtro — não por descuido, mas porque **é impossível
filtrar**. Qualquer plano que "reaproveite" essa ferramenta vaza todos os tenants.

**Falsification test:** `curl -H "X-API-Key: <chave>" "<url>/api/lancamentos"`.
Se retornar 200 com linhas, F2 está errado (implicaria view redefinida à mão em
produção, fora das migrações). Barato, ninguém executou → P1, não P0.
**Confidence:** High.

---

### F3 — [P1] [EXISTING_DEFECT] O servidor MCP inteiro é código morto — a linha de base da proposta está errada
**Evidence:** `mcp/src/index.ts:846-855`
```ts
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const a = args as Record<string, unknown>;

  // O MCP não recebe uma sessão de usuário/tenant confiável no transporte
  // stdio. Bloqueia operações privilegiadas até a próxima task introduzir
  // autenticação por API key e escopo obrigatório em todas as ferramentas.
  return errorResult(`MCP indisponível sem contexto de tenant para a ferramenta: ${name}`);

  switch (name) {
```
O `return` precede o `switch` incondicionalmente. As linhas 855-878 são
**inalcançáveis**. As 20 ferramentas são listadas (`:844`) e nenhuma é executável.

Além disso, mesmo removendo essa guarda, 9 das 20 já nascem quebradas:
- 7 relatórios chamam `executeReadOnlyDisabled` (`:23-25`, usado em `:533, :555,
  :581, :605, :715, :767, :814`), que sempre retorna `error`;
- `executar_sql` sempre erra (`:499`);
- `consultar_saldo` (`:477-480`) chama `get_bancos_com_saldos` **sem `_tenant`** e
  com `data_inicio`/`data_fim` — a assinatura exige `_tenant` (sem default) e usa
  `_data_inicio`/`_data_fim`. Não resolve overload.
- `listar_auditoria` (`:698`) lê `lancamentos_audit`, tabela que a migração
  `20260825000800_audit_log.sql:10` aposentou (o trigger foi reapontado para
  `audit_log`) e que nunca ganhou `tenant_id`
  (`20260825000200_tenant_id_columns.sql:14-21` não a inclui).

**Why it matters:** o P8 da proposta diz que `handleListarBancos` (`:502-505`)
*"retorna bancos de todos os tenants"* e que *"só é seguro hoje porque roda local,
num processo de confiança"*. A razão está errada — é seguro porque o dispatcher
curto-circuita — e a severidade também. Mais importante para o cronograma: a
proposta trata as ferramentas MCP como **ativo existente a ser reutilizado**
("ferramentas de escrita existentes com `idempotency_key`", Fase 1). Não são ativo:
nenhuma roda, nenhuma tem filtro de tenant (`:412`, `:423`, `:445`, `:460-470` usam
só `.eq("id", …)`), e metade depende de um executor de SQL permanentemente
desligado. A Fase 1 não é *wiring*; é **implementação do zero** de ~11 ferramentas
com um backend novo.

**Falsification test:** abrir `mcp/src/index.ts:853` e verificar se há alguma
condição antes do `return`. Não há. Observação de código puro, sem estado vivo.
**Confidence:** High.

---

### F4 — [P1] [PLAN_RISK] "Wrapper HTTP fino sobre a `api` function" não é fino: metade da superfície não tem endpoint
**Evidence:** os recursos da edge function estão enumerados no próprio código —
`supabase/functions/api/index.ts:505`:
```ts
available_endpoints: ["lancamentos", "transferencias", "categorias", "bancos", "resumo"]
```
As 20 ferramentas declaradas (`mcp/src/index.ts:55-304`) mapeiam assim:

| Com endpoint correspondente | Sem endpoint algum |
|---|---|
| listar/criar/atualizar/excluir/baixar_lancamento, transferir_entre_contas, listar_bancos, listar_categorias, consultar_saldo, consultar_lancamentos_bi | `relatorio_fluxo_caixa`, `relatorio_por_categoria`, `relatorio_inadimplencia`, `relatorio_kpi`, `projetar_fluxo_caixa`, `comparar_periodos`, `top_clientes_credores`, `listar_auditoria`, `sugerir_categoria`, `executar_sql` |

**Why it matters:** 10 de 20 não têm backend na `api` function. Sete delas eram SQL
bruto contra um executor desligado — reimplementá-las exige **RPCs novos em
plpgsql/sql, escopados por tenant, com migração e testes de RLS** (o `CLAUDE.md`
exige teste por feature). Isso é trabalho de banco, ou seja, categoria Fase 0, que
a Fase 1 precisa e não declara. O wrapper só é "fino" se a Fase 1 aceitar entregar
metade da capacidade hoje anunciada. A proposta precisa escolher explicitamente
entre: (a) Fase 1 com regressão declarada de capacidade, ou (b) Fase 0 ampliada
com ~7 RPCs analíticos. Hoje o documento não escolhe — e é essa ambiguidade que
faz o cronograma parecer viável.

**Falsification test:** apontar um endpoint existente que sirva
`relatorio_inadimplencia` ou `relatorio_kpi`. `grep -n 'resource ===' supabase/functions/api/index.ts`
retorna apenas os cinco. Observação de código.
**Confidence:** High.

---

### F5 — [P1] [PLAN_RISK] A Fase 1 depende de trabalho de banco não escopado em nenhuma fase
**Evidence:** Fase 1 (§4) promete *"ferramentas de escrita existentes com
`idempotency_key`"*. Busca em todas as 17 migrações:
```
grep -rn 'idempot|expected_version|versao|anexo|webhook' supabase/migrations/  →  0 resultados
```
Não há tabela de chaves de idempotência, índice único, nem coluna de versão.

**Why it matters:** idempotência de escrita financeira não é um parâmetro; é um
objeto de banco (tabela `idempotency_keys` com unique em `(tenant_id, key)`,
armazenamento da resposta canônica, janela de retenção, semântica de replay sob
concorrência) mais um caminho de resposta determinístico. Somado a F1 (contexto de
tenant no banco) e F4 (RPCs analíticos), a "Fase 0" real é substancialmente maior
que "corrigir P1–P4, P6, P7".

Isso responde à **pergunta 2 do painel** ("Fase 0 é pré-requisito ou dá para
paralelizar?"): **não dá**. Fase 0 e Fase 1 tocam os mesmos artefatos — a mesma
edge function, as mesmas migrações de tenant/RLS, o mesmo trigger de auditoria.
Paralelizar significa dois autores editando `api/index.ts` e o motor de RLS ao
mesmo tempo, sob uma regra do `CLAUDE.md` que exige validação humana para cada
alteração de RLS. É serialização por construção.

**Falsification test:** apresentar a migração que cria a tabela de idempotência.
Não existe no repositório. Observação de código.
**Confidence:** High.

---

### F6 — [P1] [PLAN_RISK] A Fase 0 exclui exatamente os defeitos que a Fase 1 torna perigosos
**Evidence:** §4: *"Fase 0: corrigir P1–P4, P6, P7"*. Ficam de fora P5 (escopo de
chave), P8 (MCP sem tenant), P9 (CORS) e **P10 (DELETE destrutivo em cascata)**.
P10 está confirmado em `supabase/functions/api/index.ts:204-216`:
```ts
const deleteAll = url.searchParams.get("recorrencia") === "true";
...
.from("lancamentos").delete().eq("recorrencia_id", lanc.recorrencia_id).eq("tenant_id", tenantId);
```
Hard delete de série inteira, sem `dry_run`, sem confirmação.

**Why it matters:** a Fase 1 abre "ferramentas de escrita" a um agente. Deixar P10
para depois enquanto se abre escrita é internamente inconsistente com o resultado
desejado (condição 3 do meu raciocínio backward: contenção). O mesmo vale para P5:
a **pergunta 3 do painel** ("escopo por chave entra na Fase 1 ou espera?") — pela
definição do resultado, escopo read-only **é** o mecanismo de contenção mais barato
disponível e deve entrar antes da escrita, não depois. Uma chave read-only torna a
Fase 1 de leitura entregável mesmo com P10 pendente; sem ela, Fase 1 e risco de
perda de dados chegam juntos.

**Falsification test:** mostrar onde a Fase 0 cobre P10 ou onde a Fase 1 introduz
soft delete / confirmação. §4 lista "P1–P4, P6, P7" e nada mais. Observação de documento.
**Confidence:** High.

---

### F7 — [P1] [PLAN_RISK] "31/31 testes de RLS" não cobrem o caminho que a Fase 1 expõe
**Evidence:** `src/test/rls/funcoes.test.ts:2` — o único teste do RPC de saldos usa
clientes **de usuário autenticado**:
```ts
ca=await createUserClient(...); cb=await createUserClient(...);
it('RPC invoker respeita tenant', async()=>{const x=await ca.rpc('get_bancos_com_saldos',{_tenant:a}); ...
```
Não há teste que faça uma requisição HTTP à edge function `api` com `X-API-Key`,
nem teste que exercite um cliente service_role contra `can_access`.

**Why it matters:** é precisamente por isso que F1 e F2 passaram despercebidos: a
suíte verde valida o caminho do frontend (`authenticated` + RLS), não o caminho do
agente (`service_role` + filtro em TypeScript). Um plano que se apoia em "31/31 RLS"
como sinal de solidez da base está lendo o sinal errado. Antes da Fase 1, a Fase 0
precisa de uma suíte de contrato da `api` function por API key — dois tenants, uma
chave cada, asserção de isolamento em cada endpoint. Sem isso, a condição 5 do
resultado desejado não vale, e o `CLAUDE.md` ("não entregar feature sem testes")
não é satisfeito.

**Falsification test:** `grep -rn 'X-API-Key' src/test/` — sem resultados de teste.
Observação de código.
**Confidence:** High.

---

### F8 — [P2] [EXISTING_DEFECT] `qtd_parcelas` sem limite superior: uma chamada insere N linhas arbitrárias
**Evidence:** `supabase/functions/api/index.ts:235-254`
```ts
const isInfinite = !qtd_parcelas || qtd_parcelas === 0;
const qtd = isInfinite ? 12 : Number(qtd_parcelas);
...
const parcelas = calcularRecorrencia(new Date(rest.data_vencimento), frequencia, qtd);
const rows = parcelas.map((p) => ({ ... }));
const { data, error } = await supabase.from("lancamentos").insert(rows).select();
```
Nenhum teto. `valor` também não é validado como positivo (`:228` só checa
falsy, então `valor: -1000` passa).

**Why it matters:** não está em P1–P10. Um agente com alucinação de parâmetro
(`qtd_parcelas: 100000`) cria 100 mil lançamentos e 100 mil linhas de `audit_log`
(trigger em `20260825000800_audit_log.sql:23`) numa chamada, dentro do orçamento de
100 req/min. É a mesma classe de risco do P10 — dano desproporcional por chamada
única — e a Fase 1 abre essa ferramenta.
**Falsification test:** apontar validação de teto em `api/index.ts`. Não há.
**Confidence:** High.

---

### F9 — [P2] [PLAN_RISK] `dry_run` e "workflows transacionais atômicos" não são implementáveis na stack atual
**Evidence:** toda a `api` function opera via supabase-js/PostgREST
(`api/index.ts:69`); não há `BEGIN`/`COMMIT`, nem RPC transacional, em lugar
nenhum. A única escrita multi-linha atômica hoje é a transferência, e só porque é
**um** `insert` de array (`api/index.ts:313-335`). O equivalente no MCP faz dois
inserts separados (`mcp/src/index.ts:467` e `:470`), com `return` de erro entre os
dois — meia transferência é um estado alcançável.

**Why it matters:** a Camada 3 (§3) pede *"operações multi-passo atômicas"*.
PostgREST não expõe transações multi-requisição. A única forma é escrever cada
workflow como função plpgsql — de novo, trabalho de banco não escopado (ver F5).
Sobre a **pergunta 5 do painel**: sim, `dry_run` dá falsa confiança, e a razão é
estrutural, não filosófica — sem transação, o dry-run e a execução real são duas
requisições independentes sem nada que garanta que o estado lido na primeira ainda
vale na segunda. Só um `expected_version` (que não existe — `grep versao` = 0) ou
um dry-run/commit dentro da mesma função plpgsql fecha essa janela.
**Falsification test:** apontar uso de transação ou RPC transacional no repositório. Não há.
**Confidence:** High.

---

### F10 — [P2] [PLAN_RISK] As fronteiras entre fases não têm nenhuma evidência de uso
**Evidence:** o documento **não contém** nenhuma alegação de cobertura — não há
"80%" nem qualquer outro percentual em `docs/proposta-mcp-fases.md`. Não há
referência a `api_access_logs`, que existe e registra `endpoint` a cada chamada
(`supabase/functions/api/index.ts:514-520`).

**Why it matters:** a ausência é o achado. Se alguém defender em debate que "Fase 1
cobre 80% do uso real", não há base para isso no documento nem no repositório: o
context brief registra que não se sabe quantas API keys existem nem quem as
consome. E há uma fonte barata e não consultada — `select endpoint, count(*) from
api_access_logs group by 1 order by 2 desc` — que diria em um comando quais
endpoints realmente importam. A Fase 1 deveria ser desenhada a partir desse
resultado, não antes dele. Enquanto isso não for feito, "o que fica na Fase 1" é
preferência, não priorização.
**Falsification test:** `grep -n '80' docs/proposta-mcp-fases.md` → só acerta
"20260825000800". Observação de documento.
**Confidence:** High.

---

### F11 — [P2] [EXISTING_DEFECT] Mensagens de erro do Postgres vazam para o chamador
**Evidence:** `supabase/functions/api/index.ts:508-511`
```ts
} catch (err: any) {
  console.error("Handler error:", err);
  await logAndReturn({ error: err?.message || "Internal server error" }, 500);
}
```
Todo `if (error) throw error` do arquivo (ex.: `:198`, `:255`, `:294`, `:455`) leva
a mensagem crua do PostgREST/Postgres ao corpo da resposta. Mesmo padrão no MCP
(`errorResult(error.message)`, ex.: `:360`, `:392`, `:413`).

**Why it matters:** nomes de coluna, constraints e detalhes de schema chegam ao
agente e daí ao contexto do LLM e a qualquer log de conversa. Em superfície de
agente isso não é só divulgação de informação — é material de reconhecimento para
sondagem do schema. Não está em P1–P10.
**Falsification test:** apontar sanitização de erro. Não há.
**Confidence:** High.

---

### F12 — [P3] [EXISTING_DEFECT] P7 está certo no diagnóstico e errado no modo de falha
**Evidence:** `supabase/functions/api/index.ts:450-454`
```ts
supabase.rpc("get_bancos_com_saldos", { _tenant: tenantId, data_inicio: ..., data_fim: ... })
```
Assinatura real: `20260826000500_…:10-11` → `(_tenant uuid, _data_inicio date
DEFAULT NULL, _data_fim date DEFAULT NULL)`. O frontend usa os nomes certos:
`src/hooks/useBancos.ts:70-74` (`_data_inicio`, `_data_fim`).

**Why it matters:** correção de precisão. A proposta diz que *"não filtra como
esperado"*, sugerindo falha silenciosa. Na prática: sem os query params, supabase-js
descarta os `undefined` no JSON e o RPC resolve com defaults; **com**
`?data_inicio=…`, PostgREST não encontra overload e retorna erro → 500 via F11.
Falha ruidosa, não silenciosa. Isso importa para o plano: um teste de contrato pega
esse caso na primeira execução — mais um argumento para F7.
**Confidence:** High.

---

### F13 — [P3] [PLAN_RISK] Fase 2 audita banco mas não categoria
**Evidence:** `supabase/migrations/20260825000800_audit_log.sql:23-26` cria trigger
de auditoria em `lancamentos` e `bancos`. **Não** em `categorias`.
**Why it matters:** a Fase 2 entrega *"arquivar/reativar em banco/categoria"* junto
com `listar_eventos_auditoria`. Metade das operações que a Fase 2 introduz não
aparecerá na trilha que a mesma fase está expondo. Correção barata (um trigger),
mas precisa estar na lista.
**Falsification test:** `grep -n 'audit_trigger' supabase/migrations/` — só
lancamentos e bancos. Observação de código.
**Confidence:** High.

---

## What the proposal got RIGHT

Crédito onde é devido — a maior parte da seção 2 é trabalho de leitura honesto e
citado corretamente:

- **P2 verificado** — `api/index.ts:470` faz `.select("*").eq("tenant_id", tenantId)`
  sem filtro de data e agrega em JS (`:472-486`). Exatamente como descrito.
- **P3 verificado** — contador lido em `:86-87`, log inserido em `:514`, depois da
  resposta. A conclusão ("é uma estatística, não um rate limit") está correta.
- **P4 verificado** — `:197` `.update(semTenantDoPayload(body))`. E o problema é
  ainda **mais amplo** do que a proposta diz: o mesmo padrão está em `PUT /bancos`
  (`:432`) e `PUT /categorias` (`:377`).
- **P6 verificado** — `20260825000800_audit_log.sql:17` grava `auth.uid()`; com
  service role isso é NULL. A conclusão (escrita de agente = autor desconhecido)
  está certa e é, na minha leitura backward, uma condição **obrigatória** do
  resultado desejado, não um item de higiene.
- **P9 verificado** — `json()` usa `corsHeaders(null)` (`:9`) enquanto o preflight
  usa `corsHeaders(req.headers.get("origin"))` (`:61-63`).
- **P10 verificado** — `:201-221`.
- **`executar_sql` desativado verificado** — `mcp/src/index.ts:499`. A decisão de
  mantê-lo fechado está correta.
- **"Módulo do zero" está CERTO** — conciliação, anexos/OCR, webhooks e
  `expected_version`: zero migrações, zero storage, zero coluna de versão. A
  avaliação da §1.2 se sustenta integralmente. Se algo, a proposta **subestima**:
  não é só que a conciliação seja greenfield — ela também dependeria da mesma
  infraestrutura de idempotência e atomicidade que a Fase 1 já assume sem ter (F5, F9).
- **Duas decisões de arquitetura estão certas e devem ser preservadas**: nada de SQL
  livre, e `tenant_id` injetado pelo servidor e nunca aceito do payload — padrão que
  já existe e funciona (`api/index.ts:30-33`, `:34-43`, `:329-331`). Recusar geração
  dinâmica de ferramenta também está certo.
- **Estrutura da `audit_log` verificada** — `id bigserial`, `antes`/`depois` jsonb,
  índice `(tenant_id, created_at DESC)` (`20260825000800_audit_log.sql:1-6`).
  Cursor é de fato barato ali.

---

## Verdict (one line)
O faseamento é razoável no formato e insustentável no conteúdo: a Fase 1 pressupõe
uma base autenticada por tenant (F1), um endpoint de listagem funcional (F2) e um
conjunto de ferramentas reutilizáveis (F3, F4) que a leitura do código mostra não
existirem — a Fase 0 real inclui contexto de tenant no banco, idempotência, ~7 RPCs
analíticos e uma suíte de contrato por API key, e por tocar os mesmos artefatos não
é paralelizável com a Fase 1.
