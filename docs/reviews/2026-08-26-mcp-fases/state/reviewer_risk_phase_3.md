# Risk Assessor — Independent Review
**Score: 5/10**
**Recommendation: REVISE**

A proposta tem os instintos certos (fronteira no banco, sem SQL livre, sem geração
dinâmica de ferramenta, Fase 0 antes de expor superfície). Mas ela erra na direção
mais perigosa possível para um sistema financeiro: **subestima o que já está quebrado
e promete uma garantia — atomicidade na Camada 3 — que o transporte escolhido
(HTTP → PostgREST) não consegue entregar.**

Achei quatro defeitos que produzem **número errado, silenciosamente, hoje, em
qualquer volume de dados** — nenhum deles está na lista P1–P10. E dois dos dez
achados listados (P1, P2) descrevem o sintoma errado do problema certo.

---

## Scalability assessment (resposta direta à pergunta do usuário)

### A pergunta errada e a pergunta certa

O usuário perguntou "em que tamanho de tenant o `/resumo` quebra". A resposta
honesta é: **`/resumo` já está errado com 10 lançamentos.** Escala é o segundo
problema, não o primeiro.

`supabase/functions/api/index.ts:472-486` agrega em JS sem filtrar `status`:

- **Transferências entre contas próprias entram como receita E despesa.**
  `transferencias` POST grava dois lançamentos (`api/index.ts:313-327`) com
  `tipo: "despesa"` e `tipo: "receita"`, `status: "transferencia"`. `/resumo`
  soma `total_receitas` sobre *todas* as receitas (linha 475). Mover R$ 100k
  entre duas contas do próprio tenant infla receita **e** despesa em R$ 100k.
- **Pagamentos parciais somem.** `total_recebido` filtra `status === "recebido"`
  (linha 477). O próprio endpoint de baixa cria `status: "parcial"`
  (`api/index.ts:141`). Um recebimento parcial não aparece em `total_recebido`
  nem em `a_receber` (linha 481 só aceita `a_receber|vencida`). O dinheiro
  recebido some do relatório.
- **`atrasado` em receita e `vencida` em despesa somem.** Não há constraint
  ligando `status` a `tipo`; `a_receber` aceita `vencida` e `a_pagar` aceita
  `atrasado` (linhas 481-484). A combinação cruzada cai fora dos dois baldes.

O sistema já *sabe* disso em outro lugar: a migração
`20260826000500_fix_get_bancos_com_saldos_transferencia.sql` foi escrita
exatamente para corrigir o espelho desse bug no RPC de saldos. Corrigiram o RPC
e não corrigiram `/resumo`.

### A curva de crescimento (a pergunta original)

O teto de 1000 linhas que a proposta trata como fato é a configuração
`db-max-rows` do painel Supabase — **não é observável a partir do repositório**.
`[STATIC-INFERENCE]`. Os dois ramos são ruins, de formas diferentes:

| Lançamentos/tenant | Ramo A: `db-max-rows = 1000` (default do painel) | Ramo B: `db-max-rows` ilimitado |
|---|---|---|
| < 1.000 | Errado pela lógica (transferência/parcial) | Errado pela lógica |
| 1.000 – 50.000 | **Errado + truncado. HTTP 200. Silencioso.** | Correto-ish, latência crescente |
| ~50.000 | idem | ~20 MB de JSON, ~1s de CPU só no parse |
| ~100.000–200.000 | idem — o número congela e nunca mais muda | **OOM / WORKER_LIMIT.** Alto |
| > 200.000 | idem | 546 / 502 consistente |

Estimativa do Ramo B: uma linha de `lancamentos` (19 colunas, 4 UUIDs) serializa
em ~350-450 B; o heap V8 após `JSON.parse` fica em 3-5× isso. 100k linhas ≈ 40 MB
de JSON ≈ 150-200 MB de heap, contra o limite documentado de 256 MB por invocação
de Edge Function. O gargalo é memória, não CPU — a agregação em si são 12
travessias do array, barato. `[STATIC-INFERENCE]` sobre os limites da plataforma.

**Onde isso dói:** 1.000 lançamentos é ~3 meses de operação a 10/dia. O Ramo A
(o provável) não quebra alto nunca — o `/resumo` simplesmente para de mudar,
retorna 200, e um agente de IA reporta o número congelado com confiança.
Em sistema financeiro, esse é o pior modo de falha que existe.

### A dupla-RPC / cursor proposta aguenta 100k?

Sim, mas não como está escrita, por dois motivos concretos:

1. **A agregação já existe no banco e a proposta não a usa.**
   `get_fluxo_caixa(_tenant, _data_inicio, _data_fim)` existe
   (`supabase/migrations/20260825000700_security_definer_cleanup.sql:21-34`,
   confirmado em `src/integrations/supabase/types.ts:581-588`). `/resumo` deveria
   ser um RPC de agregação, não paginação de linhas. Paginação para somar é a
   solução errada para o problema certo.
2. **Cursor sobre `data_vencimento` é cursor sobre chave não-única.**
   `data_vencimento` é `date` (`20260824231544_remote_schema.sql:466`) e dezenas
   de lançamentos compartilham a mesma data. Keyset sem desempate por `id`
   **repete ou pula linhas na fronteira da página, silenciosamente.** E não existe
   índice `(tenant_id, data_vencimento)`: os índices existentes são
   `(tenant_id,tipo,status,data_vencimento)` e `(tenant_id,banco_id)`
   (`20260825001100:1`, `20260826000300:8`). Cada página vai ordenar do zero.
   Exigência mínima: cursor `(data_vencimento, id)` + índice
   `(tenant_id, data_vencimento DESC, id DESC)`.

### Camada 3 (lote) sob os limites da Edge Function

Um lote de 500 baixas via wrapper HTTP = 500 round-trips PostgREST sequenciais
dentro de uma única invocação. A 30-60 ms cada, são 15-30 s de wall-clock com o
processo segurando estado na memória. Se estourar o limite no meio: **250 baixas
aplicadas, 250 não, nenhum log de acesso gravado** (o insert em
`api_access_logs` está na linha 514, *depois* do handler — morre junto), e nenhum
registro de onde o lote parou. O cliente recebe timeout e não tem como saber o
ponto de corte. Sem idempotência, a retentativa refaz as 250 primeiras — ver R4.

---

## Failure mode table

| # | Modo de falha | Gatilho | Silencioso ou alto? | Raio de impacto | Severidade |
|---|---|---|---|---|---|
| 1 | `/resumo` conta transferência como receita+despesa | Qualquer transferência entre contas | **Silencioso** (200) | Todo número de topo do tenant | P0 |
| 2 | `/resumo` descarta `parcial`/`atrasado` cruzado | Qualquer baixa parcial | **Silencioso** | Recebido e a receber | P0 |
| 3 | `/resumo` truncado em 1000 linhas | Tenant > 1000 lançamentos | **Silencioso** | Todos os totais congelam | P0 |
| 4 | `bancos?com_saldos=true` retorna `[]` | Toda chamada via API key | **Silencioso** (200 `[]`) | Saldos de todas as contas | P0 |
| 5 | `GET /lancamentos` filtra coluna inexistente na view | Toda chamada de listagem | Alto (500) | Endpoint de leitura principal morto | P0 |
| 6 | Baixa reexecutada soma o valor de novo | Timeout + retry do agente | **Silencioso** (200 nas duas) | Pagamento duplicado + parcela futura duplicada | P0 |
| 7 | Camada 3 "atômica" não é atômica | Falha no meio do workflow | Parcialmente alto | Estado financeiro meio-aplicado | P0 |
| 8 | `qtd_parcelas` sem teto | Um POST com número grande | Alto no fim (OOM), dados já criados | Explosão de linhas do tenant | P1 |
| 9 | `qtd_parcelas` NaN → insert de array vazio | `qtd_parcelas: "doze"` | **Silencioso** (201, `lancamentos: []`) | Recorrência que o usuário acha que criou | P1 |
| 10 | `valor` negativo aceito (sem CHECK no banco) | `valor: -5000` | **Silencioso** | Inverte o sinal do fluxo | P1 |
| 11 | DELETE banco/categoria → `ON DELETE SET NULL` | Agente "limpando" cadastro | **Silencioso** | Todos os lançamentos ligados perdem o vínculo | P1 |
| 12 | Transferência via MCP: 2 inserts separados | Falha no segundo insert | Alto no retorno, dado inconsistente fica | Débito sem crédito | P1 |
| 13 | Chave inválida não é logada nem rate-limitada | Ataque sem credencial | **Silencioso** (invisível) | Custo de invocação + brute force livre | P1 |
| 14 | Sobrecarga → log não gravado → limiter cego | Pico de tráfego | **Silencioso** | Realimentação positiva de retentativas | P1 |
| 15 | Cursor sobre chave não-única | Paginação em datas repetidas | **Silencioso** | Linhas puladas/duplicadas | P1 |
| 16 | Auditoria sem autor (`auth.uid()` NULL) | Toda escrita de agente | **Silencioso** | Resposta a incidente inviável | P1 |
| 17 | `listar_auditoria` lê tabela morta | Fase 2, se reaproveitar o handler | **Silencioso** | Auditoria mostra dados congelados | P1 |
| 18 | `lancamentos_bi` converte `numeric` → `double` | Toda leitura BI | **Silencioso** | Centavos em agregações grandes | P2 |
| 19 | `agent_memory` não existe; upsert sem checagem | Uso da memória de agente | **Silencioso** (no-op) | Memória de agente sempre vazia | P2 |
| 20 | Sem retenção em `audit_log`/`api_access_logs` | Passagem do tempo | Silencioso | LGPD: IP/UA/nome sem prazo | P2 |

---

## Findings

### R1 — P0 [EXISTING_DEFECT] `/resumo` retorna número errado em qualquer volume: transferência conta como receita e despesa, parcial some

**Evidence:**
- `supabase/functions/api/index.ts:470-486` — agrega sobre `select("*")` sem
  filtrar `status`.
- Linha 475: `total_receitas` soma **todas** as receitas, incluindo
  `status = 'transferencia'`.
- `api/index.ts:316,323` — a transferência grava uma linha `tipo: "despesa"` e
  outra `tipo: "receita"`, ambas `status: "transferencia"`.
- Linha 477: `total_recebido` filtra `status === "recebido"`, excluindo
  `"parcial"` — que é exatamente o status que a própria baixa gera
  (`api/index.ts:141`).
- Linhas 481-484: `a_receber` = `[a_receber, vencida]`, `a_pagar` =
  `[a_pagar, atrasado]`. Receita `atrasado` e despesa `vencida` não caem em
  balde nenhum. O enum permite as quatro combinações.
- Precedente no próprio repo:
  `supabase/migrations/20260826000500_fix_get_bancos_com_saldos_transferencia.sql:1-9`
  corrigiu esse mesmo erro de classificação no RPC de saldos. `/resumo` ficou para trás.

**Failure scenario:** tenant move R$ 200k entre duas contas próprias no mês e
recebe R$ 30k de uma duplicata de R$ 50k. O agente de IA chama `/resumo`,
lê `total_receitas` inflado em R$ 200k, `total_recebido` sem os R$ 30k e
`a_receber` sem os R$ 20k restantes, e apresenta ao usuário como fechamento do
mês. HTTP 200 nas duas pontas. Ninguém percebe até a conciliação com o extrato —
que, pela seção 1.2 da proposta, não existe.

**Falsification test:** com um tenant limpo, crie 1 receita de R$ 100 e
1 transferência de R$ 1.000 entre duas contas; depois dê baixa de R$ 40 na
receita. `GET /resumo` deve retornar `total_receitas: 100` e
`total_recebido: 40`. Se retornar `total_receitas: 1100` e `total_recebido: 0`,
o achado está confirmado. Uma chamada, dois minutos.

**Confidence:** High

---

### R2 — P0 [EXISTING_DEFECT] `bancos?com_saldos=true` retorna lista vazia para toda chamada via API key — `can_access` dentro do `WHERE`

**Evidence:**
- `supabase/migrations/20260826000500_...sql:29` — a função tem
  `WHERE b.tenant_id = _tenant AND public.can_access(_tenant, 'bancos')`.
- `supabase/migrations/20260825000300_rls_engine.sql:22-38` — `can_access`
  resolve `tm.user_id = auth.uid()`.
- `supabase/functions/api/index.ts:69` — o cliente é criado com
  `SUPABASE_SERVICE_ROLE_KEY`, sem JWT de usuário. O JWT de service role não
  carrega `sub`, então `auth.uid()` é NULL → `can_access` = `false`.
- `can_access` no `WHERE` não levanta erro: **filtra tudo**. Resultado: `[]`,
  HTTP 200 (`api/index.ts:450-456`).
- Contraste que prova a intenção: `get_fluxo_caixa`
  (`20260825000700_security_definer_cleanup.sql:25`) faz a mesma autorização com
  `IF NOT public.can_access(...) THEN RAISE EXCEPTION`. **Mesma regra, duas
  formas de falhar — e a versão silenciosa é justamente a que a API usa.**
- A migração `20260826000500` faz `GRANT EXECUTE ... TO service_role`, ou seja,
  a intenção explícita era que o service role chamasse essa função.

**Failure scenario:** o agente pergunta "quanto tem em cada conta?". A resposta
é uma lista vazia, que o LLM traduz como "você não tem contas cadastradas" ou
"saldo zero". O usuário acredita. O caminho do frontend (JWT de usuário
autenticado) funciona perfeitamente, então a divergência só aparece para quem
usa a API — exatamente a superfície que a proposta quer expandir.

**Falsification test:** no SQL editor:
`SET LOCAL ROLE service_role; SELECT count(*) FROM public.get_bancos_com_saldos('<tenant_uuid>');`
Se retornar 0 enquanto `SELECT count(*) FROM bancos WHERE tenant_id='<tenant_uuid>'`
retorna > 0, confirmado. Alternativa por HTTP: comparar `GET /bancos` com
`GET /bancos?com_saldos=true` com a mesma API key.

**Confidence:** High

---

### R3 — P0 [EXISTING_DEFECT] `GET /lancamentos` filtra `tenant_id` numa view que não tem essa coluna

**Evidence:**
- `supabase/functions/api/index.ts:284` —
  `supabase.from("lancamentos_bi").select("*").eq("tenant_id", keyData.tenant_id)`.
- `supabase/migrations/20260824231544_remote_schema.sql:509-527` — a view
  `lancamentos_bi` tem lista de colunas explícita e **não inclui `tenant_id`**.
- `supabase/migrations/20260825000200_tenant_id_columns.sql:14` adiciona
  `tenant_id` à tabela `lancamentos` e **nunca recria a view**. Nenhuma migração
  posterior a recria (`grep -rn "lancamentos_bi" supabase/migrations/`).
- Confirmação independente pelos tipos gerados do banco de produção:
  `src/integrations/supabase/types.ts:541-559` lista as colunas de
  `lancamentos_bi` — sem `tenant_id`. O mesmo arquivo já contém `can_access` e
  `get_bancos_com_saldos(_tenant, _data_inicio, _data_fim)`, ou seja, foi gerado
  **depois** da multi-tenancy.
- PostgREST responde 400 (`42703`) para filtro em coluna inexistente;
  `api/index.ts:294` faz `if (error) throw error` → o catch da linha 508 devolve
  500.

**Failure scenario:** dois desfechos, e o segundo é pior que o primeiro.
(a) Hoje: o endpoint de listagem — o mais usado por qualquer agente — está morto
com 500. Falha alta, mas o P1 da proposta ("recebe 1000 linhas e trata como
completo") **não pode estar acontecendo**, porque a query nunca chega a retornar
linha nenhuma. A proposta descreve um sintoma que o código não produz.
(b) O conserto óbvio e errado: alguém remove o `.eq("tenant_id", ...)` para
"fazer funcionar". A view é `security_invoker = true`, mas o invoker é
`service_role`, que tem BYPASSRLS. Resultado: **listagem cross-tenant completa**.
O conserto certo é recriar a view com `tenant_id` e manter o filtro.

**Falsification test:** `GET /lancamentos` com uma API key válida. Se voltar 500
com mensagem contendo `tenant_id`/`42703`, confirmado. Ou, em SQL:
`SELECT * FROM information_schema.columns WHERE table_name='lancamentos_bi' AND column_name='tenant_id';`
— zero linhas confirma.

**Confidence:** High (evidência estática convergente: migração + dump + tipos gerados)

---

### R4 — P0 [EXISTING_DEFECT + PLAN_RISK] Sem idempotência, uma retentativa de baixa duplica o pagamento e a parcela futura

**Evidence:**
- `supabase/functions/api/index.ts:136` —
  `const novoValorPago = valorAtual + valorPago;`. A baixa é **acumulativa, não
  declarativa**. Rodar duas vezes soma duas vezes.
- Não há constraint impedindo `valor_pago > valor`
  (`20260824231544_remote_schema.sql:468-469`, `numeric(15,2)`, sem CHECK).
- `api/index.ts:150-181` — se a baixa fecha uma recorrência infinita, insere a
  próxima parcela. Na retentativa, `novoStatus` continua `recebido`/`pago` e o
  bloco roda de novo: **segunda parcela futura duplicada**.
- Zero infraestrutura de idempotência no repo:
  `grep -rni "idempot" --include=*.ts --include=*.sql` retorna apenas a própria
  proposta e relatórios de tarefa. Nenhuma tabela, nenhuma coluna, nenhum código.
- A proposta pergunta pela janela de retenção (seção 5, item 4) mas não define
  onde a chave é armazenada, qual é o escopo (por tenant? por ferramenta?), nem
  o comportamento no replay **depois** da janela.

**Failure scenario:** o `/resumo` de um tenant grande estoura o tempo (ver
seção de escalabilidade) ou a Edge Function tem cold start lento. O cliente MCP
faz retry com backoff — comportamento padrão, e um agente LLM que não recebe
resposta tende a "tentar de novo" mesmo sem retry automático. A baixa de
R$ 10.000 vira `valor_pago = 20.000` e nasce uma duplicata futura. As duas
chamadas retornaram 200. O `audit_log` registra dois UPDATEs, ambos com
`user_id` NULL (R11), a segundos de distância — indistinguíveis de dois
pagamentos parciais legítimos.

**Sobre a janela de retenção, que a proposta deixa em aberto:** com janela curta
(24 h), um replay tardio — fila travada, agente reiniciado, operador repetindo
uma ação de ontem — passa direto e duplica. Com janela longa (90 d), a tabela de
chaves vira o maior objeto de escrita do sistema e precisa de particionamento.
A resposta correta não é uma janela: é tornar a baixa **declarativa**
(`valor_pago_total` como alvo absoluto, não incremento), o que a torna
naturalmente idempotente sem tabela nenhuma. A idempotency key vira defesa em
profundidade, não o único controle.

**Falsification test:** chame `POST /lancamentos/<id>/baixa` com
`{valor_pago: 100}` duas vezes no mesmo lançamento de R$ 100. Se a segunda
retornar 200 com `valor_pago: 200`, confirmado.

**Confidence:** High

---

### R5 — P0 [PLAN_RISK] "Workflows transacionais atômicos" (Camada 3) sobre HTTP + PostgREST é tecnicamente inatingível como descrito

**Evidence:**
- Proposta, seção 3, Camada 3: "Operações multi-passo atômicas".
- Proposta, seção 3, Decisão de transporte: "MCP em modo HTTP, como wrapper fino
  sobre a `api` edge function".
- PostgREST abre uma transação **por requisição HTTP**. N passos = N requisições
  = N transações independentes. Não existe `BEGIN` que atravesse chamadas —
  a Edge Function não tem sessão de banco, ela fala HTTP com o PostgREST.
- O código já demonstra a diferença. O caminho **atômico** existe:
  `api/index.ts:334-335` insere as duas pernas da transferência em **um único**
  `.insert(rows)` com array — uma instrução, uma transação, tudo ou nada.
  O caminho **não-atômico** também existe: `mcp/src/index.ts:467-471` faz dois
  inserts separados, e o segundo pode falhar deixando o débito órfão.
- E o sistema já documentou que aceita esse risco:
  `mcp/src/agents/treasurer.config.ts:22-24` — *"Atomicidade em transferências:
  ... Em caso de erro parcial, reportar imediatamente para correção manual."*
  Um prompt de LLM não é um controle transacional.

**Failure scenario:** "Fechar o mês": 40 baixas + 3 transferências + 1 ajuste de
categoria. O passo 31 falha (constraint, timeout, limite de CPU). Os 30
anteriores estão **commitados e visíveis**. O wrapper não tem como desfazer:
teria que emitir 30 operações compensatórias que são elas próprias
não-transacionais e podem falhar no meio. E `mcp/src/agents/planner.ts:41-54`
— o planner que já existe — em `markStep(..., "failed")` apenas anota o status;
`getNextStep` (linha 28-39) continua entregando qualquer passo cujas dependências
estejam satisfeitas. **Não há compensação, não há parada, não há rollback.**
Se a Camada 3 for construída sobre esse planner, um lote parcialmente falho
continua executando os passos independentes sobre um estado inconsistente.

**O que é atingível — e a proposta deveria dizer isso explicitamente:**
1. Atomicidade real exige que o passo múltiplo vire **uma função no banco**
   (`SECURITY DEFINER`, `plpgsql`), chamada por um único RPC. Aí sim há uma
   transação. O padrão já está no repo (`get_fluxo_caixa`,
   `get_bancos_com_saldos`).
2. Se o lote for grande demais para uma transação, a garantia honesta é
   **"reexecutável com segurança"** (cada passo idempotente + status persistido
   por passo), não "atômico". Chamar isso de atômico é um erro de contrato que
   vai virar uma decisão errada de operação no primeiro incidente.

**Falsification test:** peça a quem escreveu a proposta o `BEGIN` que envolveria
dois `INSERT`s emitidos como duas requisições PostgREST distintas a partir de
uma Edge Function. Não existe. Alternativamente, `pg_stat_activity` /
`pg_stat_statements` durante um lote mostrará N transações distintas, não uma.

**Confidence:** High

---

### R6 — P1 [EXISTING_DEFECT] `qtd_parcelas` sem teto: uma chamada cria linhas ilimitadas; um NaN cria zero e reporta 201

**Evidence:**
- `api/index.ts:236` — `const qtd = isInfinite ? 12 : Number(qtd_parcelas);`
  sem `Math.min`, sem validação de inteiro, sem limite superior.
- `api/index.ts:45-58` — `calcularRecorrencia` faz `for (let i = 1; i <= qtd; i++)`
  construindo um objeto `Date` por iteração; depois `rows` é materializado inteiro
  em memória (linha 239) e inserido de uma vez (linha 254).
- `Number("doze")` = `NaN`; `i <= NaN` é `false` → `parcelas = []` → `rows = []`
  → insert de array vazio → **HTTP 201 com `lancamentos: []`**.

**Failure scenario:** um agente com alucinação de argumento envia
`qtd_parcelas: 100000`. Uma requisição, dentro do rate limit, gera 100 mil
lançamentos (ou derruba o worker no meio da construção do array, depois de já
ter escrito nada — ou tudo, se o insert começou). O cenário do usuário
("agente cria 200 lançamentos errados") é a versão branda. A versão NaN é pior
por ser silenciosa: o usuário é informado de que a recorrência foi criada e ela
não existe.

**Falsification test:** `POST /lancamentos` com
`{recorrente: true, frequencia: "mensal", qtd_parcelas: "doze", ...}`.
Se responder 201 com `lancamentos: []`, confirmado.

**Confidence:** High

---

### R7 — P1 [EXISTING_DEFECT] `valor` negativo ou não-numérico é aceito pela API e pelo banco

**Evidence:**
- `api/index.ts:228` — a validação é `!rest.valor`, que rejeita `0` e `undefined`
  e **aceita `-5000`** e a string `"1000"`.
- `api/index.ts:306` — a transferência valida do mesmo jeito: `!valor`. Uma
  transferência de valor negativo inverte a direção do dinheiro sem que nada no
  payload diga isso.
- Só a baixa valida sinal: `api/index.ts:126` (`valorPago <= 0`).
- Não há CHECK no banco: `20260824231544_remote_schema.sql:468` é
  `"valor" numeric(15,2) NOT NULL`, sem constraint
  (`grep -n "CHECK" ... | grep valor` → nada).

**Failure scenario:** o agente interpreta "estorno de R$ 500" como
`valor: -500`. O lançamento entra, o saldo do banco muda na direção certa por
acidente, e `/resumo` soma um negativo em `total_despesas` — que agora é menor
que a soma das despesas reais. Nenhum erro em lugar nenhum.

**Falsification test:** `POST /lancamentos` com `valor: -100`. Se retornar 201,
confirmado. A defesa correta é um CHECK no banco (`valor > 0`), não validação na
Edge Function — a Edge Function não é o único escritor.

**Confidence:** High

---

### R8 — P1 [EXISTING_DEFECT] DELETE de banco/categoria desconecta lançamentos silenciosamente; categorias nem sequer são auditadas

**Evidence:**
- `20260824231544_remote_schema.sql:847` —
  `lancamentos_banco_id_fkey ... ON DELETE SET NULL`.
- Linha 852 — `lancamentos_categoria_id_fkey ... ON DELETE SET NULL`.
- `api/index.ts:436` e `api/index.ts:388` expõem `DELETE /bancos/:id` e
  `DELETE /categorias/:id` à API key, sem checagem de uso, sem `dry_run`, sem
  arquivamento.
- `20260825000800_audit_log.sql:23-26` — há trigger de auditoria em `lancamentos`
  e em `bancos`. **Não há em `categorias`.**

**Failure scenario:** o agente "organiza o plano de contas" e apaga uma categoria
duplicada. Todos os lançamentos históricos daquela categoria passam a
`categoria_id = NULL`. Nenhum lançamento foi apagado, nenhum trigger disparou
em `lancamentos` (o UPDATE é feito pelo FK cascade — vale verificar se o trigger
`AFTER UPDATE` dispara nesse caminho; se não disparar, não existe nem o `antes`
para reconstruir). Todo relatório por categoria muda retroativamente e não há
`antes` de `categorias` em lugar nenhum. Irreversível.

**Falsification test:** apague uma categoria de teste que tenha lançamentos e
verifique (a) se os lançamentos ficaram com `categoria_id` NULL e (b) se
`audit_log` recebeu linhas para essa operação. Se (a) sim e (b) não, confirmado.

**Confidence:** High para o SET NULL e a ausência de trigger em `categorias`;
Medium para o disparo do trigger de `lancamentos` sob cascade.

---

### R9 — P1 [EXISTING_DEFECT] O rate limit não protege o que precisa ser protegido, e degrada exatamente sob carga

Além do que a proposta já diz em P3 (não é atômico), há três agravantes:

**Evidence:**
- `api/index.ts:86-87` — o contador filtra por `api_key_id`. **Uma chave inválida
  nunca chega lá**: o fluxo retorna 401 na linha 83. Requisição sem credencial
  válida é ilimitada.
- `api/index.ts:514-520` — o insert em `api_access_logs` só roda no fim.
  Os `return json(...)` de 401/403/429 (linhas 74, 83, 84, 87) saem **antes**.
  Tentativas de chave inválida não são logadas: brute force é invisível.
- O contador conta apenas requisições **concluídas e logadas**. Se a função
  estoura tempo/memória, o log nunca é escrito.

**Failure scenario (laço de realimentação):** carga sobe → `/resumo` fica lento →
requisições estouram o limite do worker → nenhum log é gravado → o contador de
rate limit cai → o limitador passa a permitir *mais* tráfego → mais carga.
O mecanismo de proteção afrouxa proporcionalmente à gravidade do incidente.
Some a isso um agente LLM em laço de retentativa e o sistema não tem freio
nenhum: nem no cliente, nem no servidor.

**Falsification test:** dispare 200 requisições paralelas com uma chave válida e
conte quantas retornam 429. Se for ~0, confirmado (P3). Para o agravante:
dispare 1.000 requisições com `X-API-Key: invalida` e verifique que
`api_access_logs` não cresceu.

**Confidence:** High

---

### R10 — P1 [Correção do briefing] A transferência via `api` **é** atômica; a via MCP não é

**Evidence:**
- `api/index.ts:313-335` — as duas linhas são montadas em um array e inseridas
  com **um** `.insert(rows)`. PostgREST executa isso como uma instrução em uma
  transação. Não existe estado "metade da transferência" por esse caminho.
- `mcp/src/index.ts:467-471` — dois `.insert()` sequenciais. Se `e2` falhar,
  a função retorna erro **e deixa o débito órfão no banco**. Sem delete
  compensatório.
- `mcp/src/agents/treasurer.config.ts:22-24` documenta o buraco e delega ao
  humano.

**Failure scenario:** só é alcançável se a implementação da Camada 1 reaproveitar
os handlers do `mcp/src/index.ts` em vez de chamar a `api` function. A proposta
diz "wrapper fino sobre a `api` function" — se isso for seguido à risca, o risco
não se materializa. É exatamente por isso que precisa estar escrito como
requisito verificável, e não como preferência de arquitetura.

**Nota de correção importante para o painel:** o P8 da proposta afirma que
`handleListarBancos` "retorna bancos de todos os tenants". O handler faria isso,
mas ele é **inalcançável**: `mcp/src/index.ts:853` tem um
`return errorResult(...)` incondicional **antes** do `switch` da linha 855.
As 20 ferramentas MCP estão todas mortas hoje. O código depois da linha 853 é
inatingível. Isso muda o risco atual (não há vazamento vivo) e **aumenta** o
risco de plano: ninguém está exercitando esse código, então ele não tem sinal
de qualidade nenhum, e é o código que a Fase 1 pretende promover.

**Falsification test:** `git log -S "MCP indisponível sem contexto de tenant"`
mostra quando o kill switch entrou; qualquer chamada de ferramenta pelo cliente
MCP retorna a mesma mensagem, provando que o switch está ativo.

**Confidence:** High

---

### R11 — P1 [EXISTING_DEFECT] Resposta a incidente: sem autor, a única pista é a janela de tempo

**Evidence:**
- `20260825000800_audit_log.sql:17` — o trigger grava `auth.uid()`, NULL para
  service role (confirma P6).
- `api_access_logs` (`20260824231544_remote_schema.sql:398-407`) grava
  `endpoint`, `ip_address`, `user_agent`, `response_status` — **não grava o corpo
  da requisição nem os ids das linhas afetadas**.
- Não existe soft delete: nenhuma coluna `deleted_at` em `lancamentos`
  (linhas 464-484).

**Failure scenario:** "o agente criou 200 lançamentos errados, desfaz". O que
existe para trabalhar:
1. `audit_log` tem `antes`/`depois` por linha para `lancamentos` e `bancos`, com
   índice `(tenant_id, created_at DESC)`. Materialmente, o rollback é possível.
2. Mas não há como separar o que o agente fez do que o humano fez: `user_id` é
   NULL nos dois casos (o app usa JWT? sim — então o humano *tem* `user_id`;
   o agente é o único com NULL. Isso ajuda, mas não distingue **qual** agente,
   **qual** API key, **qual** requisição).
3. Correlacionar com `api_access_logs` exige casar timestamps entre duas tabelas
   — aproximação frágil e ambígua sob concorrência.
4. Não existe ferramenta de undo em lote. É SQL manual com service role, num
   sistema em produção, sob pressão de incidente.
5. Para `categorias`, não há nem `antes` (R8).

**Mitigação mínima antes de qualquer escrita de agente:** `audit_log` precisa de
`api_key_id` e de um `request_id` propagado da Edge Function, populados
explicitamente (não via `auth.uid()`), e `lancamentos` precisa de soft delete ou
de um procedimento de restauração testado a partir de `audit_log.antes`.
"Testado" quer dizer com teste automatizado, não com um SQL guardado num doc.

**Falsification test:** escolha qualquer linha de `audit_log` gerada por escrita
da API e tente responder, só com o banco: qual API key, qual requisição HTTP e
qual chamada de ferramenta a produziu. Não é respondível.

**Confidence:** High

---

### R12 — P1 [PLAN_RISK] `dry_run` sem lock dá falsa confiança — e a proposta não define o que ele garante

**Evidence:** proposta, seção 3 Camada 1 ("`dry_run` opcional") e seção 5 item 5.
Nenhuma menção a lock, snapshot, versão ou token de validade.

**Failure scenario:** o agente roda `dry_run` de "baixar 40 títulos", apresenta
ao usuário, o usuário aprova, o agente executa. Entre o dry-run e a execução:
um humano deu baixa em 3 desses títulos pelo app; um `valor` mudou; um título
foi excluído. O dry-run disse "40 baixas, R$ 180k". A execução faz 37 baixas,
3 duplicações de valor (R4) e 1 erro — e o usuário aprovou o número antigo.
**O `dry_run` transformou uma incerteza visível em uma confiança injustificada.**

Sem `expected_version` — que a própria proposta reconhece não existir
(seção 1.2: "`lancamentos` não tem coluna de versão") — o dry-run é uma previsão
sem contrato. As duas saídas honestas:
1. `dry_run` retorna, junto do resumo, o `id` + um hash/`updated_at` de cada
   linha afetada; a execução real exige esses valores e **falha alto** se algum
   divergir. Isso é versionamento otimista com outro nome, e barato:
   `lancamentos.updated_at` já existe (`remote_schema.sql:478`).
2. Ou o `dry_run` é rotulado como estimativa não-vinculante, e a UI nunca o
   apresenta como "vai acontecer isso".

Entregar `dry_run` na Fase 1 sem uma das duas é entregar o risco sem o controle.

**Falsification test:** não aplicável (é risco de desenho, não defeito de código).
O teste de aceitação seria: dry-run, alterar uma linha por fora, executar —
o sistema deve recusar, não executar em cima do estado novo.

**Confidence:** High

---

### R13 — P1 [PLAN_RISK] Paginação por cursor sobre chave não-única, sem índice de suporte

**Evidence:** proposta, seção 3 Camada 2 ("Paginação por cursor obrigatória"),
sem definição da chave. `data_vencimento` é `date`
(`20260824231544_remote_schema.sql:466`), com repetição massiva. Os índices
existentes são `(tenant_id,tipo,status,data_vencimento)`
(`20260825001100_indices_e_limpeza.sql:1`) e `(tenant_id,banco_id)`
(`20260826000300_indices_otimizacao.sql:8`). Nenhum serve a um keyset por data.

**Failure scenario:** 60 lançamentos com `data_vencimento = 2026-08-05`, páginas
de 50. Keyset `WHERE data_vencimento < cursor` pula 10; keyset `<=` repete.
Nas duas variantes o agente soma o conjunto errado e reporta um total errado
sem nenhum sinal. É o mesmo modo de falha do P1 (truncamento silencioso), só que
introduzido pela **correção** do P1.

**Falsification test:** criar 60 lançamentos na mesma data, paginar de 50 em 50 e
comparar o conjunto de `id`s obtido com `SELECT id FROM lancamentos WHERE ...`.
Diferença de conjunto confirma.

**Confidence:** High

---

### R14 — P2 [EXISTING_DEFECT] `lancamentos_bi` converte `numeric(15,2)` em `double precision`

**Evidence:** `20260824231544_remote_schema.sql:512-513` —
`("l"."valor")::double precision AS "valor"` e o mesmo para `valor_pago`.
A coluna base é `numeric(15,2)` (linha 468). Confirmado nos tipos gerados
(`types.ts:557-558`: `valor: number | null`).

**Failure scenario:** `consultar_lancamentos_bi` e `GET /lancamentos` entregam
floats binários ao agente, que soma milhares deles em JS. O erro acumulado é de
centavos — pequeno o bastante para não disparar alarme e grande o bastante para
não bater com a contabilidade. Em sistema financeiro, dinheiro não passa por
`double`.

**Falsification test:** `SELECT valor FROM lancamentos_bi WHERE id = '<id de um lançamento de 0.07>';`
e comparar a representação com `SELECT valor FROM lancamentos WHERE id = ...`.

**Confidence:** High (o cast é explícito no DDL)

---

### R15 — P1 [PLAN_RISK] A Fase 2 pretende expor auditoria — o handler existente lê a tabela errada

**Evidence:**
- `mcp/src/index.ts:698` — `handleListarAuditoria` lê `lancamentos_audit`.
- `20260825000800_audit_log.sql:13-24` — `audit_lancamentos()` foi substituída
  (`CREATE OR REPLACE`) e agora escreve em `audit_log`, não em
  `lancamentos_audit`. A tabela antiga continua existindo, congelada no estado
  pré-migração.

**Failure scenario:** a Fase 2 ("`listar_eventos_auditoria` com cursor")
reaproveita o handler. A ferramenta responde com sucesso, com dados reais, de
antes da migração — e nenhuma escrita recente aparece. Um auditor conclui que
não houve atividade. Falha silenciosa numa ferramenta cuja única função é ser
confiável.

**Falsification test:** `SELECT max(realizado_em) FROM lancamentos_audit;`
comparado com `SELECT max(created_at) FROM audit_log;`. Se o primeiro estiver
congelado antes de 2026-08-25, confirmado.

**Confidence:** High

---

### R16 — P2 [EXISTING_DEFECT] Memória de agente: tabela inexistente, erro engolido, sem tenant

**Evidence:**
- `mcp/src/agents/memory.ts:15-20` — `saveMemory` faz `await ... .upsert(...)`
  e **não verifica `error`**.
- `agent_memory` não aparece em `src/integrations/supabase/types.ts` (gerado do
  banco) nem em nenhuma migração; `memory.ts:36-48` define a DDL como uma
  **string para colar no painel**. Schema fora do controle de migração.
- A policy proposta é `USING (auth.role() = 'service_role')` — **sem
  `tenant_id`**. Se a tabela for criada assim, memória de agente é global entre
  tenants.

**Failure scenario:** hoje: `saveMemory` é um no-op silencioso, `getMemory`
sempre volta vazio, o agente parece amnésico sem nenhum erro. Amanhã, se alguém
criar a tabela como está na string: contexto financeiro de um tenant vaza no
prompt do agente de outro.

**Falsification test:** `SELECT to_regclass('public.agent_memory');` → NULL
confirma o no-op.

**Confidence:** High

---

## Respostas diretas às 6 perguntas da seção 5

1. **A fronteira é suficiente?** O desenho é correto; a base não. Os vazamentos
   estruturais não estão na fronteira proposta — estão em `service_role` +
   `can_access(auth.uid())`, que juntos produzem R2 (autorização vira filtro
   vazio) e R3(b) (BYPASSRLS num filtro que depende de uma coluna inexistente).
   Enquanto o caminho de API não tiver identidade no banco, RLS não é uma
   fronteira para ele — é decoração.
2. **Fase 0 é pré-requisito?** Sim, e é maior do que a proposta admite. Precisa
   incluir R1, R2, R3, R6, R7 além de P1–P4/P6/P7. Paralelizar Fase 0 com Fase 1
   significa construir o wrapper sobre endpoints que retornam números errados.
3. **Escopo por API key na Fase 1?** Sim, e não é a parte cara. `read-only` é uma
   coluna e um `if`. Sem isso, R6/R8 ficam a uma alucinação de distância de
   qualquer agente de consulta.
4. **Idempotência: chave no cliente ou no servidor?** A pergunta está mal posta.
   Torne a baixa **declarativa** (`valor_pago_total` absoluto) e o problema
   central desaparece sem janela de retenção nenhuma. Chave de idempotência com
   janela é defesa em profundidade para o resto — proposta: 7 dias, escopo
   `(tenant_id, ferramenta, chave)`, e **replay fora da janela deve ser recusado
   por padrão**, não executado.
5. **`dry_run` dá falsa confiança?** Sim — ver R12. Só é seguro com verificação
   de versão na execução (`updated_at` já existe). Sem isso, não entregue.
6. **Wrapper HTTP é dívida técnica?** É a escolha certa **de destino** e errada
   **de ordem**. Um wrapper fino sobre uma base com R1, R2 e R3 propaga número
   errado com autoridade de ferramenta. Ordem correta: agregações viram RPC no
   banco (o padrão já existe), depois o wrapper.

---

## Verdict (one line)

REVISE — a direção arquitetural está certa, mas a Fase 0 está subdimensionada
(faltam quatro defeitos que produzem número errado em silêncio, hoje, em qualquer
volume) e a promessa central da Camada 3 — atomicidade sobre HTTP/PostgREST — é
inatingível como escrita e precisa virar ou RPC no banco ou uma garantia mais
honesta.
