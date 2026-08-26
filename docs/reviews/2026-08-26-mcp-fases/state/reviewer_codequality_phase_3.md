# Code Quality Auditor — Independent Review
**Score: 4/10**
**Recommendation: REVISE**

> **Nota de nomenclatura:** a proposta usa `P1..P10` como *identificadores* de defeito.
> Nesta revisão, severidade é `P0` (crítico) > `P1` > `P2`. Sempre que escrevo "P7" sem
> qualificador, é o identificador da proposta; severidade vem escrita como `[P0]`, `[P1]`, `[P2]`.

Método: leitura integral de `supabase/functions/api/index.ts` (530 ln), `mcp/src/index.ts`
(885 ln), `mcp/src/agents/*` (365 ln — **não mencionados na proposta**), as duas migrações
indicadas, o DDL base (`20260824231544_remote_schema.sql`), os tipos gerados do banco
(`src/integrations/supabase/types.ts`) e a suíte de testes. Dois comportamentos numéricos e
de data foram **executados** em Node para não depender de memória.

---

## Part A — Verification of the proposal's P1–P10 claims

| Claim | Verdict | Evidence (file:line) | Notes |
|---|---|---|---|
| **P1** Paginação ausente / truncamento silencioso | **CORRECTED** | `api/index.ts:284`, `:358-361`, `:408-415`, `:458-459`, `:470`; único `.limit(` do arquivo está em `:155`; nenhum `.range(` | Falta de teto: confirmada. Mas (a) o endpoint citado lê `lancamentos_bi`, não `lancamentos`, e hoje **falha com 500** (ver M1) — o cenário "recebe 1000 e acha que é tudo" não acontece nele; (b) o teto de 1000 é a config `Max rows` do projeto Supabase, ausente do repo (`supabase/config.toml` não tem `[api]`) → `[STATIC-INFERENCE]`, cap P1; (c) "sem sinalizar" erra o mecanismo: PostgREST **sinaliza** via `Content-Range`; quem descarta o sinal é este código, que nunca pede `count`. Severidade real: **[P1]**, e vale para `/transferencias` e `/resumo`. |
| **P2** `/resumo` carrega a tabela inteira | **CONFIRMED (subestimado)** | `api/index.ts:470` — `.from("lancamentos").select("*").eq("tenant_id", tenantId)` | Literal, sem filtro de data e sem teto. Mas a proposta só acusa custo + truncamento: os números do `/resumo` estão **errados por construção**, independentemente do volume (ver M8). |
| **P3** Rate limit não atômico | **CONFIRMED (+1 lacuna)** | `api/index.ts:86-87` (contagem) vs `:514-520` (insert do log) | Read-then-act sem atomicidade: confirmado. Faltou: chaves **inválidas** retornam em `:83` **antes** de qualquer log → tentativa de autenticação falha não é contada nem registrada; não existe limite algum sobre autenticação. E `logAndReturn` (`:108-111`) **não loga nada** — o nome mente, só guarda `responseStatus`/`responseData`. |
| **P4** `PUT /lancamentos/:id` aceita qualquer coluna | **CONFIRMED (subestimado)** | `api/index.ts:196-197` — `.update(semTenantDoPayload(body))` | Além dos campos citados, aceita **`id`** (troca de PK), `data_pagamento`, `created_at`. Pior: viola um invariante que o próprio app **documenta e implementa** — `src/hooks/useUpdateLancamento.ts:19,32-43`: editar `valor` de um lançamento quitado precisa atualizar `valor_pago` junto, senão o Fluxo de Caixa e o saldo do banco continuam no valor antigo. O endpoint não faz isso. Mesmo padrão de mass-assignment em bancos (`:431-432`) e categorias (`:377`). |
| **P5** API key tudo-ou-nada | **CONFIRMED** | DDL `20260824231544_remote_schema.sql:412-421` + `20260825001000_api_keys_hash.sql:2-8` + `20260825000200_tenant_id_columns.sql:17` | Colunas reais: `id, nome, ativa, created_at, updated_at, ultimo_acesso, tenant_id, hash, prefixo`. Sem `escopo`, sem `expires_at`, sem limite por ferramenta. `chave` em texto plano foi corretamente removida (`:8`). |
| **P6** Auditoria não atribui autor | **CONFIRMED (+2 lacunas)** | `20260825000800_audit_log.sql:17` — `VALUES (COALESCE(NEW.tenant_id,OLD.tenant_id),auth.uid(),...)` | Linha exata confere. Faltou: (a) o trigger só existe em `lancamentos` e `bancos` (`:23-26`) — categorias, api_keys e usuarios **não são auditados**; (b) `audit_log` não tem coluna de `api_key_id`, então nem "qual chave" é recuperável — não é "autor desconhecido", é **autor irrecuperável**. |
| **P7** RPC com nomes de parâmetro errados | **CORRECTED** | Assinatura: `20260826000500_...sql:10-11` `(_tenant uuid, _data_inicio date DEFAULT NULL, _data_fim date DEFAULT NULL)`. Call site: `api/index.ts:450-454` `{ _tenant, data_inicio, data_fim }` | Mismatch: **real**. Efeito descrito: **errado**. `url.searchParams.get(...) \|\| undefined` + `JSON.stringify` → chaves `undefined` **somem do corpo**; sem os query params a chamada vira `{_tenant}` e resolve pelos DEFAULT. **Com** `data_inicio`, o PostgREST não acha a sobrecarga → `PGRST202` → `throw error` (`:455`) → **500 com mensagem crua**. Não é "não filtra como esperado" (silencioso), é falha determinística e barulhenta. Bônus não visto: `mcp/src/index.ts:477-480` chama a mesma RPC **sem `_tenant`** (que não tem default) → falharia sempre. |
| **P8** MCP stdio não tem tenant | **REFUTED na premissa factual / conclusão mantida** | `mcp/src/index.ts:853` — `return errorResult(...)` **incondicional**, antes do `switch` em `:855` | "`handleListarBancos` (linha 503) … retornam bancos de todos os tenants" é **falso hoje**: nenhuma das 20 ferramentas executa; `handleListarBancos` (`:502-506`) é código inalcançável. O que continua verdadeiro: os handlers realmente não filtram tenant (`:502-506`, `:517-521`, `:333-336`, `:697-704`) e o processo usa service role (`:13-21`) — remover a linha 853 abre vazamento total e imediato. A conclusão ("não é promovível a HTTP como está") **fica de pé**; a premissa não. E isso importa: o risco atual não é vazamento, é que `ListTools` (`:844`) **ainda anuncia as 20 ferramentas** (inclusive `executar_sql`, com descrição dizendo que SELECT é permitido) enquanto todas retornam erro — e `CLAUDE.md:3,129,131` afirma que o MCP está "Ativo … autenticado por API key", o que é falso nas duas metades. |
| **P9** CORS inconsistente | **CONFIRMED (impacto corrigido)** | `api/index.ts:6-10` (`corsHeaders(null)`) vs `:61-63` (`corsHeaders(origin)`); `supabase/functions/_shared/cors.ts:2` | Com `origin=null` o helper devolve `allowed[0] ?? ''`. Não é falha de segurança (nunca ecoa origem fora da allowlist, nunca usa `*`) — é **falha funcional**: só a *primeira* origem de `ALLOWED_ORIGINS` consegue ler respostas no browser; as demais passam o preflight e quebram na resposta real. Com `ALLOWED_ORIGINS` vazio, sai `Access-Control-Allow-Origin: ''`. Severidade **[P2]** e irrelevante para MCP server-to-server. |
| **P10** DELETE destrutivo e em cascata | **CONFIRMED (subestimado)** | `api/index.ts:201-221` | Confere. Faltou: (a) `:218` apaga **uma perna de transferência** deixando a contraparte órfã → saldo do banco corrompido, sem cascata nenhuma; (b) **sucesso mentiroso**: 0 linhas afetadas devolve `{success:true}` — nunca 404; (c) `?recorrencia=true` num lançamento sem `recorrencia_id` cai no delete simples e responde `deleted:"single"` mesmo sem apagar nada; (d) ver M15 — há dúvida legítima se DELETE sequer funciona hoje por causa do trigger de auditoria. |

**Placar da seção 2 da proposta:** 4 confirmadas como escritas (P2 parcial, P3, P5, P6), 3 confirmadas mas
materialmente subestimadas (P2, P4, P10), 2 corrigidas no mecanismo (P1, P7, P9), 1 refutada na premissa (P8).
E **três defeitos classe P0 não foram vistos** — justamente os que corrompem dinheiro. Para um documento cuja
tese é "expor mais superfície sobre uma base com estes defeitos multiplica o risco", errar quais são os defeitos
é a falha central desta revisão.

---

## Part B — Defects the proposal MISSED

### M1 — [P0] [EXISTING_DEFECT] `GET /lancamentos` filtra por uma coluna que não existe na view

**Evidence:**
`supabase/functions/api/index.ts:284`
```ts
let query = supabase.from("lancamentos_bi").select("*").eq("tenant_id", keyData.tenant_id);
```
`supabase/migrations/20260824231544_remote_schema.sql:509-529` — a view `lancamentos_bi` projeta
`id, data_vencimento, cliente_credor, valor, valor_pago, banco, status, tipo, categoria, categoria_pai,
parcela_atual, total_parcelas, observacao, data_pagamento, created_at`. **Não há `tenant_id`.**
Nenhuma migração posterior redefine a view (`grep "CREATE OR REPLACE VIEW"` em `2026082500*`/`2026082600*`: zero).
Corroboração independente pelos tipos gerados **a partir do banco**: `src/integrations/supabase/types.ts:541-558`
lista as mesmas 15 colunas, sem `tenant_id`.

**Failure scenario:** `GET /api/lancamentos` com chave válida → PostgREST `42703 column
lancamentos_bi.tenant_id does not exist` → `if (error) throw error` (`:294`) → catch (`:508-511`) →
**HTTP 500 com o nome da view e da coluna no corpo**. O endpoint principal de leitura está quebrado.
E o corolário é pior que o bug: **essa view não tem nenhuma coluna de tenant**, então não existe forma de
consultá-la com isolamento por tenant sob service role. O "conserto" óbvio e errado — remover o `.eq()` —
transforma o endpoint num vazamento cross-tenant completo. A mesma armadilha está armada em
`mcp/src/index.ts:517-521` (`consultar_lancamentos_bi`, sem filtro algum).
Isso derruba a premissa da Fase 1 da proposta: `consultar_entidade` sobre `lancamentos_bi` **não é** "barato expor".

**Falsification test:** `select tenant_id from public.lancamentos_bi limit 1;` — se retornar, refutado.
Ou `curl -H "X-API-Key: <chave>" .../api/lancamentos`: 200 refuta, 500 confirma.
**Confidence:** High (duas fontes independentes: migração + tipos gerados do banco).

---

### M2 — [P0] [EXISTING_DEFECT] Dinheiro atravessa a fronteira como float; baixa parcial pode travar em `parcial` para sempre

**Evidence:**
`supabase/functions/api/index.ts:134-142`
```ts
const valorTotal = Number(lanc.valor);
const valorAtual = Number(lanc.valor_pago) || 0;
const novoValorPago = valorAtual + valorPago;
let novoStatus: string;
if (novoValorPago >= valorTotal) { novoStatus = lanc.tipo === "receita" ? "recebido" : "pago"; }
else { novoStatus = "parcial"; }
```
A coluna é `numeric(15,2)` (`20260824231544_remote_schema.sql:468-469`), mas o PostgREST serializa `numeric`
como número JSON → `JSON.parse` → IEEE-754 double. E a view de BI **converte no próprio banco**:
`remote_schema.sql:512-513` — `("l"."valor")::double precision AS "valor"`.

**Failure scenario (executado em Node, não deduzido):** lançamento de **R$ 100,01**.
Baixa 1 = 50,01 → `parcial`, grava `valor_pago = 50.01`. Baixa 2 = 50,00 →
`50.01 + 50 = 100.00999999999999`, que é `< 100.01` → status permanece **`parcial`**, enquanto
`valor_pago` gravado arredonda para `100.01` em `numeric(15,2)`. Resultado persistente e irreversível
pela própria API: linha com `valor_pago == valor` e `status = 'parcial'`.
Impacto em dinheiro real: `get_bancos_com_saldos` só soma `valor_pago` quando
`status IN ('recebido','transferencia')` / `('pago','transferencia')`
(`20260826000500_...sql:21,23`) → os R$ 100,01 **somem do saldo do banco**; `/resumo` (`:477-480`) idem.
Outros pares que sofrem o mesmo: 33,01+67,03 para 100,04; 30,05+70,10 para 100,15.
`Math.round`/`toFixed` não aparecem em nenhum ponto do caminho de baixa.

**Falsification test:** criar lançamento de 100,01; `POST :id/baixa {valor_pago:50.01}`;
`POST :id/baixa {valor_pago:50.00}`; ler `status`. Se vier `recebido`, refutado.
**Confidence:** High (aritmética verificada por execução; caminho de dados verificado por leitura).

---

### M3 — [P0] [EXISTING_DEFECT] `baixa` não é idempotente, não tem trava e gera parcelas sem limite

**Evidence:** `supabase/functions/api/index.ts:122-182`. Quatro defeitos compostos no mesmo bloco:

(a) **Sem checagem de status.** `:136` soma cegamente. Chamar baixa duas vezes no mesmo lançamento já
quitado faz `valor_pago = 2 × valor`, status continua `pago` — e a RPC de saldo soma `valor_pago`
(`20260826000500_...sql:21,23`), então **o saldo do banco infla pelo valor duplicado**.

(b) **Sem teto.** `valorPago` só é validado como `> 0` (`:126`); nada o compara ao saldo devedor.

(c) **Race condition read-modify-write.** SELECT em `:129-130`, UPDATE em `:143-146`, sem `expected_version`,
sem `FOR UPDATE`, sem update condicional. Duas baixas concorrentes de R$ 50 num título de R$ 100 leem
`valor_pago = 0` e ambas gravam 50 — **um pagamento desaparece** e o status vira `parcial`.

(d) **Recorrência infinita amplifica.** `:150-181`: toda baixa que resulta em `pago`/`recebido` num lançamento
com `total_parcelas === 0` cria mais uma parcela. Como (a) permite rebaixar indefinidamente, **cada retry de
um agente cria uma linha nova** — crescimento ilimitado de `lancamentos` e de `audit_log` em cascata.
E o insert dessa nova parcela (`:165-179`) **não checa erro nenhum**: falha silenciosa quebra a série sem sinal.

**Failure scenario:** agente com timeout de rede reenvia `POST /lancamentos/:id/baixa` (comportamento normal
de cliente HTTP). Título de R$ 5.000 vira R$ 10.000 pagos, saldo do banco sobe R$ 5.000 que não existem,
e uma parcela futura fantasma é criada.

**Falsification test:** `POST :id/baixa {valor_pago: X}` duas vezes seguidas com o mesmo corpo e ler
`valor_pago`. Se a segunda for rejeitada ou for no-op, refutado.
**Confidence:** High.

---

### M4 — [P1] [EXISTING_DEFECT] `POST /lancamentos/:id/<qualquer-coisa>` cria um lançamento novo em vez de 404

**Evidence:** `api/index.ts:122` só reconhece `action === "baixa"`; a cadeia `else if` chega em `:222`
```ts
} else if (method === "POST") {
  // POST /lancamentos  → cria lançamento (suporta recorrência)
```
sem jamais checar que `id` está vazio.

**Failure scenario:** agente chama `/lancamentos/<uuid>/baixar` (ou `/pagar`, ou `/baixa` com `PUT`
seguido de retry como `POST`). Em vez de 404, se o corpo tiver `tipo`, `cliente_credor`, `valor` e
`data_vencimento` — que é exatamente o que um agente costuma ter em contexto — o sistema **cria um
lançamento duplicado** e devolve 201. O `id` da URL é silenciosamente ignorado. Mesmo padrão em
categorias (`:391`) e bancos (`:439`).

**Falsification test:** `POST /api/lancamentos/<uuid-existente>/baixar` com corpo de criação válido.
201 confirma; 404/405 refuta.
**Confidence:** High.

---

### M5 — [P1] [EXISTING_DEFECT] Recorrência: sem teto de parcelas, frequência não validada, entrada não-numérica vira no-op com 201

**Evidence:** `api/index.ts:234-256` + `:45-58`.
```ts
const isInfinite = !qtd_parcelas || qtd_parcelas === 0;
const qtd = isInfinite ? 12 : Number(qtd_parcelas);
```
(a) **Sem cap.** `qtd_parcelas: 500000` → um único insert de 500 mil linhas (+ 500 mil linhas de `audit_log`
pelo trigger em `20260825000800_...sql:23`). Uma chamada, sem confirmação.
(b) **`frequencia` não validada.** `:234` só testa truthiness e o `switch` em `:50-55` **não tem `default`** →
`frequencia: "anual"` (ou "diario", ou qualquer string) não avança `dataAtual`: gera N parcelas **todas na mesma data**.
(c) **`Number("doze") = NaN`** → `for (i=1; i<=NaN)` nunca executa → `insert([])` → **201 com
`{recorrencia_id: <uuid>, lancamentos: []}`**: sucesso reportado, nada criado, e um `recorrencia_id`
que não existe entregue ao chamador.

**Failure scenario:** `POST /lancamentos {recorrente:true, frequencia:"anual", qtd_parcelas:5, ...}` →
5 lançamentos idênticos no mesmo dia, todos com `frequencia:"anual"` gravado.
**Falsification test:** a chamada acima; datas distintas refutam (b).
**Confidence:** High.

---

### M6 — [P1] [EXISTING_DEFECT] O `addMonths` da edge function diverge da implementação canônica — que tem teste fixando o comportamento contrário

**Evidence:**
`api/index.ts:18-22`
```ts
function addMonths(date: Date, months: number): Date {
  const d = new Date(date); d.setMonth(d.getMonth() + months); return d;
}
```
vs. `src/lib/recurrence.ts:1,46` — `import { addMonths } from 'date-fns'`, que **clampa** para o último dia do mês.
E o comportamento canônico está travado por teste: `src/lib/recorrencia.test.ts:58-63`
(`31/01/2026 mensal → '2026-02-28'`) e `:65-70` (bissexto → `'2028-02-29'`).

**Failure scenario (executado):** série mensal iniciando em `2026-01-31` pela API →
`2026-01-31 | 2026-03-03 | 2026-04-03 | 2026-05-03`. O canônico do app produz
`31/01, 28/02, 31/03, 30/04`. Fevereiro é **pulado inteiro** e a série fica permanentemente deslocada
em 3 dias. Um aluguel vencendo dia 31 passa a vencer dia 3.
É código duplicado divergente: a mesma função existe em dois lugares, um com testes e outro sem.

**Falsification test:** `POST /lancamentos {recorrente:true, frequencia:"mensal", qtd_parcelas:3,
data_vencimento:"2026-01-31"}` e ler as datas. `2026-02-28` refuta.
**Confidence:** High.

---

### M7 — [P1] [EXISTING_DEFECT] `toISODate` usa UTC — a data padrão erra o dia entre 21h e meia-noite BRT

**Evidence:** `api/index.ts:23-26`
```ts
function toISODate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().split("T")[0];
}
```
O repositório **documenta esse exato anti-padrão como bug conhecido**: `src/lib/date.ts:3-9` —
*"Evita o bug clássico de '+/- 1 dia' quando se usa toISOString() (UTC)"* — e o próprio MCP faz certo
(`mcp/src/index.ts:30-32`, `todayBRT()` com `timeZone: "America/Sao_Paulo"`). Só a edge function regrediu.

**Failure scenario (executado):** 26/08 às 23:30 BRT → `toISODate` devolve `2026-08-27`.
Edge functions rodam em UTC, então **toda requisição entre 21:00 e 23:59 BRT** grava a data do dia seguinte.
Afeta `data_pagamento` default na baixa (`:125`) e em `lancar_como_pago` (`:274`). No dia 31 às 22h,
o pagamento cai no **mês seguinte** — fechamento contábil errado.

**Falsification test:** chamar a baixa sem `data_pagamento` às 22h BRT e ler o campo gravado.
**Confidence:** High.

---

### M8 — [P1] [EXISTING_DEFECT] `/resumo` conta transferência duas vezes e ignora `parcial` — os números estão errados, não só lentos

**Evidence:** `api/index.ts:470-486`, cruzado com `:313-327` (transferência = 1 despesa + 1 receita).
```ts
total_receitas: receitas.reduce((s,l) => s + (Number(l.valor)||0), 0),
total_recebido: receitas.filter(l => l.status === "recebido").reduce(...valor_pago...),
a_receber: receitas.filter(l => ["a_receber","vencida"].includes(l.status)).reduce(...),
```
(a) `total_receitas`/`total_despesas` não excluem `status = 'transferencia'` → uma transferência de
R$ 10.000 entre contas do próprio tenant **infla receita E despesa em R$ 10.000 cada**.
(b) `total_recebido` só aceita `'recebido'` → exclui `'parcial'` (dinheiro que entrou) e `'transferencia'`,
**enquanto a RPC de saldos passou a incluir `'transferencia'`** (`20260826000500_...sql:21,23`) e o app trata
`'transferencia'` como quitado (`useUpdateLancamento.ts:19`). São **duas definições concorrentes de "recebido"
no mesmo sistema**: a tela de Bancos e o `/resumo` não fecham, e nada no código sinaliza qual é a certa.
(c) `a_receber` usa `['a_receber','vencida']` e `a_pagar` usa `['a_pagar','atrasado']` — uma receita com
status `'atrasado'` ou uma despesa com `'vencida'` (ambos permitidos pelo enum) **não entram em lugar nenhum**.

**Failure scenario:** tenant com 1 transferência de R$ 10.000 e 1 receita de R$ 100 baixada parcialmente
em R$ 60: `/resumo` reporta `total_receitas = 10.100`, `total_recebido = 0`.
**Confidence:** High.

---

### M9 — [P1] [EXISTING_DEFECT] Toda resposta 500 vaza internals do banco

**Evidence:** `api/index.ts:508-511` e `:526-529` — `await logAndReturn({ error: err?.message || "Internal server error" }, 500)`.
Mensagens de PostgREST/Postgres vão cruas para o cliente: nomes de coluna, view e constraint,
`invalid input syntax for type uuid: "..."`. Não há validação de UUID em nenhum `id` de rota, então
extrair essas mensagens é trivial. Combina com M1 e com P7, que produzem 500 em fluxos normais.
**Confidence:** High.

---

### M10 — [P1] [EXISTING_DEFECT] Efeito colateral já commitado + resposta 500; e perda silenciosa da trilha de acesso

**Evidence:** `api/index.ts:514-525` está **dentro** do `try` externo, cujo catch (`:526-529`) devolve 500.
```ts
await supabase.from("api_access_logs").insert({ ... });
await supabase.from("api_keys").update({ ultimo_acesso: ... }).eq("id", keyData.id);
return json(responseData, responseStatus);
```
(a) O log e o `ultimo_acesso` acontecem **depois** da escrita já commitada. Uma falha de rede nesses dois
`await` faz o cliente receber **500 para uma operação que teve sucesso** → o agente repete → duplicata.
Sem `idempotency_key`, é impossível distinguir. Este é o caso concreto que justifica o item 4 da seção 5 da proposta.
(b) Erros retornados pelo PostgREST nesses inserts **não são checados** (não há destructuring de `error`) →
perda silenciosa da trilha de acesso, que é justamente a fonte de dados do rate limit (`:86`).
(c) Mesma classe em `:165-179` (parcela de recorrência infinita, sem checagem de erro).
**Confidence:** High.

---

### M11 — [P1] [EXISTING_DEFECT] O servidor MCP está inteiramente desativado, mas anuncia 20 ferramentas e a documentação afirma o contrário

**Evidence:** `mcp/src/index.ts:846-855`
```ts
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const a = args as Record<string, unknown>;
  // ...
  return errorResult(`MCP indisponível sem contexto de tenant para a ferramenta: ${name}`);

  switch (name) {
```
O `switch` (`:855-879`) e os 20 handlers (`:331-834`) são **inalcançáveis**; `tsconfig.json` do MCP não liga
`allowUnreachableCode: false`, então o build passa sem aviso. Enquanto isso `:844` continua devolvendo
`TOOLS` inteiro no `ListTools`.
Contradição documental: `CLAUDE.md:3` e `:129,131` afirmam que o MCP é "o único caminho de acesso de IA a
dados financeiros", **"Ativo"** e **"autenticado por API key"** — nenhuma das duas é verdade
(`mcp/src/index.ts:13-21` usa `SUPABASE_SERVICE_ROLE_KEY` direto, sem API key).
**Consequência para a proposta:** a seção 1.1/1.2 trata essa superfície como existente e "barata de expor".
Os 20 handlers **nunca rodaram** nesta forma, não têm um único teste, e três deles já contêm defeitos
verificáveis (`:477-480` RPC sem `_tenant`; `:697-704` tabela legada; `:517-521` sem tenant).
"Wiring de MCP" é otimista: é reescrita com revisão.
**Confidence:** High.

---

### M12 — [P2] [EXISTING_DEFECT] `listar_auditoria` lê a tabela legada, hoje congelada e sem tenant

**Evidence:** `mcp/src/index.ts:697-704` — `.from("lancamentos_audit")`.
Mas `20260825000800_audit_log.sql:13-21` fez `CREATE OR REPLACE FUNCTION public.audit_lancamentos()`
apontando para a tabela nova `audit_log`: **`lancamentos_audit` parou de receber escritas**. Ela não tem
`tenant_id` (`remote_schema.sql:494-503`) e ficou sem policies (`20260825000800:11-12`) — o que o teste
`src/test/rls/tenant_insert_audit.test.ts:29-30` confirma (`expect(legacy.data).toEqual([])`).
Como o MCP usa service role, RLS não se aplica: essa ferramenta devolveria o **histórico legado de todos
os tenants**. A Fase 2 da proposta ("`listar_eventos_auditoria` com cursor") precisa dizer explicitamente
que a fonte é `audit_log`, não a legada — e a proposta não diz.
**Confidence:** High.

---

### M13 — [P2] [PLAN_RISK] O mapa de risco falha **aberto** e classifica SQL arbitrário como "baixo"

**Evidence:** `mcp/src/agents/risk-map.ts:13`
```ts
{ tool: "executar_sql", risk: "baixo", reason: "Apenas SELECT permitido", requires_confirmation: false },
```
e `:33-42`
```ts
export function getRisk(toolName: string): ToolRiskEntry {
  return (TOOL_RISK_MAP.find((e) => e.tool === toolName) ?? {
    tool: toolName, risk: "medio", reason: "Tool sem mapeamento de risco", requires_confirmation: false });
}
```
Ferramenta desconhecida → **sem confirmação**. A proposta introduz `consultar_entidade` (Camada 2) e
workflows em lote (Camada 3): pelo mapa atual, ambas nascem sem exigir confirmação. Se a Fase 1 pretende
usar esse mapa como gate, o default precisa ser `requires_confirmation: true`.
Nota adicional: a proposta descreve o MCP como "885 linhas / 20 ferramentas" e **ignora
`mcp/src/agents/*` (365 linhas: planner, memory, risk-map e 5 configs de agente)** — superfície não inventariada.
**Confidence:** High.

---

### M14 — [P2] [EXISTING_DEFECT] Deriva de schema: `agent_memory` existe fora do controle de migrações

**Evidence:** `mcp/src/agents/memory.ts:36-49` — a migração da tabela vive numa **string**
(`MEMORY_MIGRATION`) com o comentário *"Execute no painel do Supabase"*. A tabela aparece no dump de produção
(`backups/prod_backup_schema_20260826.sql:370-379`) e é documentada em `CLAUDE.md:99`, mas **não existe em
`supabase/migrations/`**. Um rebuild a partir das migrações não a cria. Ela não tem `tenant_id`, e
`memory.ts:3-6` abre um **segundo** cliente service role no processo.
`[STATIC-INFERENCE]` quanto ao estado vivo (a evidência é um dump versionado, não o banco) → cap P1; fico em P2.
**Confidence:** Medium-High.

---

### M15 — [P2] [EXISTING_DEFECT] [UNVERIFIED-RUNTIME] `NEW.tenant_id` num trigger de DELETE

**Evidence:** `20260825000800_audit_log.sql:17`
```sql
VALUES (COALESCE(NEW.tenant_id,OLD.tenant_id),auth.uid(),TG_TABLE_NAME,TG_OP,
  COALESCE(NEW.id,OLD.id), ...)
```
num trigger `AFTER INSERT OR UPDATE OR DELETE ... FOR EACH ROW` (`:23-26`). Em PL/pgSQL, `NEW` não é
atribuído em DELETE de linha, e acessar campo de record não atribuído levanta
`record "new" is not assigned yet`. Se for o caso, **todo DELETE em `lancamentos` e `bancos` falha** — o que
inverteria o P10 da proposta: o endpoint não seria uma ferramenta de perda de dados, seria um endpoint que
sempre dá 500.
Não consigo executar SQL e **os testes não cobrem**: `src/test/rls/helpers.ts:89-96` só faz `console.warn`
em erro de limpeza, e `src/test/rls/isolamento.test.ts:85` testa um DELETE que o RLS bloqueia (0 linhas →
o trigger nem dispara). Ou seja: nenhum DELETE bem-sucedido em `lancamentos` é exercitado pela suíte.
**Falsification test:** `delete from public.lancamentos where id = '<id descartável>';` num tenant de teste.
**Confidence:** Medium (semântica do PL/pgSQL de alta confiança; aplicação ao deploy atual, não observável).

---

### M16 — [P2] [EXISTING_DEFECT] Valor sem validação: negativos e strings passam

**Evidence:** `api/index.ts:228` — `else if (!rest.cliente_credor || !rest.valor || !rest.data_vencimento)`
rejeita `0` e ausência, mas **`valor: -500` é truthy** e cria uma despesa negativa. Nenhum `Number()` no POST
(só a baixa converte, `:124`), então `valor: "1.000,00"` chega ao Postgres e vira 500 com mensagem crua (M9).
Transferências têm o mesmo buraco (`:306`): `valor` negativo inverte o sentido da transferência.
**Confidence:** High.

---

### M17 — [P2] [PLAN_RISK] Zero testes para as 530 linhas que a proposta escolheu como fundação

**Evidence:** `src/test/` contém apenas `rls/` e `setup.ts`; não há nenhum teste tocando
`supabase/functions/api/`. `CLAUDE.md:153`: *"Não entregar uma feature sem escrever os testes correspondentes"*.
A proposta decide (seção 3, "Decisão de transporte") fazer o MCP HTTP como **wrapper fino sobre a `api`
function** — escolhendo como base a **única** parte do sistema sem cobertura, enquanto a RLS tem 31 testes
verdes. Os defeitos M2, M3, M5, M6, M7 e M8 são todos do tipo que um teste unitário de meia hora pegaria.
**Confidence:** High.

---

### M18 — [P2] [PLAN_RISK] "Fronteira de segurança no banco, não no agente" não descreve o transporte escolhido

**Evidence:** `api/index.ts:67-69`
```ts
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
```
Service role **bypassa RLS inteiramente**. O isolamento multi-tenant desta função é 100% manual.
Auditei todas as consultas do arquivo e **todas** carregam o filtro — `:36, :40, :130, :146, :153, :189,
:197, :206, :209, :213, :218, :254, :277, :284, :330, :335, :349, :354, :360, :373, :383, :388, :403,
:408, :427, :432, :436, :443, :451, :459, :470`. Hoje está correto, e isso merece ser dito: **não encontrei
vazamento cross-tenant na edge function**.
Mas é um invariante mantido por revisão humana, sem teste e sem lint. Uma consulta nova sem `.eq("tenant_id")`
vaza tudo — e M1 mostra que já existe uma superfície (`lancamentos_bi`) onde o filtro **nem é possível**.
A proposta promete fronteira no banco (seção 3) e entrega fronteira na aplicação. Se a fronteira fosse mesmo
no banco, o wrapper emitiria um JWT por tenant e deixaria a RLS — já testada, 31/31 — fazer o trabalho.
Isso responde diretamente à pergunta 1 da seção 5: **há vazamento estrutural em potencial**, não no
código atual, mas no modelo (um `.eq` esquecido = vazamento total, sem rede de proteção).
**Confidence:** High.

---

## Resposta direta às perguntas da seção 5

1. **Suficiente?** Não como está. `tenant` injetado pela API key + allowlist de campos são necessários,
   mas a fronteira continua sendo código de aplicação sob service role (M18), e existe pelo menos uma
   entidade sem coluna de tenant (M1). Antes de expor, ou a view ganha `tenant_id` ou sai do allowlist.
2. **Fase 0 é pré-requisito?** Sim, e está **incompleta**: falta M1, M2 e M3 — os três que corrompem dinheiro.
   Paralelizar Fase 1 com uma Fase 0 que não inclui idempotência de baixa é expor um bug de duplicação a
   um cliente que faz retry automático.
3. **Escopo por API key na Fase 1?** Sim. Com M3 e P10 no lugar, uma chave de leitura comprometida é
   incidente; uma chave total é perda de dados.
4. **Idempotência.** A evidência de M10 responde: a chave tem de vir do cliente, porque o modo de falha real
   é "efeito aplicado, resposta 500". Chave do servidor não cobre esse caso.
5. **`dry_run`.** A preocupação é legítima e M3(c) a agrava: sem versão/lock, o intervalo entre dry-run e
   execução não é apenas teórico — duas escritas concorrentes já se sobrescrevem hoje.
6. **Wrapper HTTP é a escolha certa?** A direção sim (um caminho autenticado, não dois), mas não sobre
   "10 defeitos conhecidos" — são **mais de 25**, incluindo o endpoint principal de leitura quebrado (M1),
   e a base escolhida é a única sem testes (M17).

---

## Verdict (one line)
A arquitetura em camadas está certa, mas o diagnóstico em que ela se apoia erra o alvo — 3 das 10 alegações
precisam de correção, 1 está factualmente refutada (P8: o MCP inteiro está desativado, `mcp/src/index.ts:853`)
e os três defeitos P0 que realmente corrompem dinheiro (view sem `tenant_id`, float na baixa, baixa não
idempotente) não foram vistos: **REVISE** — refazer a seção 2 e reescopar a Fase 0 antes de qualquer exposição.
