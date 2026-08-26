# Proposta: expor o Finance Flow a agentes de IA via MCP (faseada)

**Status:** proposta para revisão — não implementada
**Contexto:** o usuário trouxe uma especificação de ~11 seções (ferramentas de leitura/escrita, cadastros, comprovantes/OCR, conciliação bancária, auditoria, operações em lote, SQL genérico, idempotência, versionamento otimista, dry-run, webhooks). Esta proposta responde: **o que é viável, em que ordem, e o que fica de fora.**
**Pergunta central para o painel:** esta arquitetura é segura e escalável para produção financeira multi-tenant?

---

## 1. Estado atual verificado (evidência, não memória)

### 1.1 O que existe hoje

| Componente | Local | Tamanho | Auth |
|---|---|---|---|
| Edge function HTTP `api` | `supabase/functions/api/index.ts` | 530 linhas | API key (`X-API-Key`, SHA-256) → `tenant_id` |
| Servidor MCP stdio | `mcp/src/index.ts` | 885 linhas | **Nenhuma** — service role key direto no processo |
| Trilha de auditoria | `audit_log` + trigger | migração `20260825000800` | RLS por `can_access(tenant_id,'usuarios')` |

**Endpoints da `api` function:** `lancamentos` (GET/POST/PUT/DELETE/`:id/baixa`), `transferencias`, `categorias`, `bancos` (`?com_saldos=true`), `resumo`.

**20 ferramentas MCP declaradas:** `listar_lancamentos`, `criar_lancamento`, `atualizar_lancamento`, `excluir_lancamento`, `baixar_lancamento`, `transferir_entre_contas`, `consultar_saldo`, `executar_sql`, `listar_bancos`, `listar_categorias`, `consultar_lancamentos_bi`, `relatorio_fluxo_caixa`, `relatorio_por_categoria`, `relatorio_inadimplencia`, `relatorio_kpi`, `sugerir_categoria`, `listar_auditoria`, `projetar_fluxo_caixa`, `comparar_periodos`, `top_clientes_credores`.

### 1.2 Divisão do escopo pedido

**Já existe / barato expor:**
- Ferramentas específicas de leitura/escrita — a maioria já está na `api` function
- Auditoria com cursor — `audit_log` já tem `id bigserial`, `antes`/`depois` jsonb, índice `(tenant_id, created_at DESC)`
- Consulta declarativa genérica (`consultar_entidade`)
- `idempotency_key` e `dry_run` nos endpoints existentes
- Arquivar/reativar em banco/categoria

**Não existe — é feature nova, não "wiring de MCP":**
- **Conciliação bancária** (importar OFX/CSV, Open Finance, matching por pontuação) — não há tabela de transação bancária importada nem motor de correspondência. Módulo do zero.
- **Anexos/comprovantes com OCR** — não há storage de anexo, hash nem extração. Módulo do zero.
- **Webhooks** — não existe infraestrutura nenhuma.
- **Versionamento otimista (`expected_version`)** — `lancamentos` não tem coluna de versão.

---

## 2. Problemas encontrados no código atual

Estes são achados de leitura direta do código. A proposta de fases precisa endereçá-los, porque **expor mais superfície sobre uma base com estes defeitos multiplica o risco.**

### P1 — Paginação ausente: truncamento silencioso
`GET /lancamentos` (linha ~284) faz `.select("*")` sem `.range()`. PostgREST corta em 1000 linhas por padrão **sem sinalizar**. Um agente que peça "todos os lançamentos de 2026" recebe 1000 linhas e trata como completo. Erro silencioso de dados financeiros.

### P2 — `/resumo` carrega a tabela inteira em memória
Linha 470: `.select("*").eq("tenant_id", tenantId)` sem filtro de data, e agrega em JavaScript. Além do teto de 1000 (que torna o resumo **errado**, não só lento), o custo cresce linearmente com o histórico do tenant.

### P3 — Rate limit não funciona sob concorrência
Linhas 86-87: conta linhas em `api_access_logs` do último minuto e bloqueia em ≥100. Mas o log só é inserido **depois** da resposta (linha 514). N requisições paralelas leem o mesmo contador e passam todas. Não é atômico e não é rate limit — é uma estatística.

### P4 — `PUT /lancamentos/:id` aceita qualquer coluna
Linha 197: `.update(semTenantDoPayload(body))` — só remove `tenant_id`. O chamador pode gravar `status`, `valor_pago`, `transferencia_vinculo_id`, `recorrencia_id`, `parcela_atual` diretamente, furando toda a lógica de negócio (ex.: marcar como `recebido` sem baixa, quebrar o par de uma transferência). Não há allowlist de campos editáveis.

### P5 — API key é tudo-ou-nada
A chave dá acesso completo de leitura **e escrita** ao tenant, com service role. Não há escopo (read-only vs write), não há `expires_at`, não há limite por ferramenta. Um agente de consulta e um agente que dá baixa em contas usam a mesma credencial.

### P6 — Auditoria não atribui quem fez
O trigger grava `auth.uid()` (migração `20260825000800`, linha 17). Chamadas via service role (API e MCP) têm `auth.uid()` NULL. Toda escrita de agente entra no `audit_log` como **autor desconhecido** — exatamente o requisito que a seção de auditoria da spec pretende cobrir.

### P7 — Chamada de RPC com nomes de parâmetro errados
Linha 450: `supabase.rpc("get_bancos_com_saldos", { _tenant, data_inicio, data_fim })`. A assinatura é `(_tenant, _data_inicio, _data_fim)`. Os dois últimos não batem — `?com_saldos=true&data_inicio=…` não filtra como esperado.

### P8 — Servidor MCP stdio não tem tenant
`mcp/src/index.ts` usa service role direto, sem API key e sem `tenant_id`. Consultas como `handleListarBancos` (linha 503) fazem `.from("bancos").select(...)` **sem filtro de tenant** — retornam bancos de todos os tenants. Só é "seguro" hoje porque roda local, num processo de confiança. Não é promovível a HTTP como está.

### P9 — CORS inconsistente
O preflight responde com `corsHeaders(origin)`, mas todas as respostas reais usam `corsHeaders(null)` (helper `json`, linha 9).

### P10 — DELETE é destrutivo e em cascata
`DELETE /lancamentos/:id?recorrencia=true` apaga a série inteira, hard delete, sem dry-run e sem confirmação. Exposto a um agente, é uma ferramenta de perda de dados em uma chamada.

**Nota:** `executar_sql` já está desativado no código (`handleExecutarSQL` retorna erro) — a superfície de SQL arbitrário não está aberta hoje, e a proposta é mantê-la fechada.

---

## 3. Arquitetura proposta

Três camadas, com fronteira de segurança **no banco**, não no agente.

### Camada 1 — Operações específicas (escrita)
Ferramentas nomeadas, schema fechado, uma responsabilidade cada: `criar_lancamento`, `baixar_lancamento`, `transferir_entre_contas`, `arquivar_banco`. Toda escrita com `idempotency_key` obrigatória e `dry_run` opcional.

### Camada 2 — Consulta declarativa (leitura)
Uma ferramenta `consultar_entidade` com entidade + filtros + agregação **de um allowlist**, nunca SQL livre. `tenant_id` injetado pelo servidor a partir da API key, jamais aceito do payload. Paginação por cursor obrigatória.

### Camada 3 — Workflows transacionais (lote)
Operações multi-passo atômicas com dry-run, idempotência e registro em auditoria.

### Decisão de transporte
**MCP em modo HTTP, como wrapper fino sobre a `api` edge function** — não reescrever o servidor stdio. Motivo: a `api` function já tem autenticação por tenant; o stdio não tem nenhuma (P8). Um caminho autenticado, não dois.

### Geração dinâmica de ferramenta
**Não.** O agente pode *propor* uma ferramenta nova; publicar código financeiro em produção sem revisão humana, não.

---

## 4. Fases propostas

**Fase 0 (proposta desta revisão — não estava no plano original):** corrigir P1–P4, P6, P7 antes de expor mais superfície.

**Fase 1:** MCP HTTP + `consultar_entidade` (leitura travada) + ferramentas de escrita existentes com `idempotency_key`.

**Fase 2:** `listar_eventos_auditoria` com cursor + arquivar/reativar em banco/categoria.

**Fase 3 (decisão separada):** conciliação bancária e anexos — projeto próprio, modelagem nova.

---

## 5. Perguntas ao painel

1. A fronteira de segurança proposta (tenant injetado pela API key, allowlist de campos, sem SQL livre) é suficiente para multi-tenant financeiro, ou há vazamento estrutural?
2. Fase 0 é realmente pré-requisito, ou dá para paralelizar com a Fase 1?
3. Escopo por API key (read-only vs write) deve entrar na Fase 1 ou pode esperar?
4. Idempotência: chave no cliente ou no servidor? Qual janela de retenção?
5. `dry_run` em operação financeira dá falsa confiança se o estado mudar entre o dry-run e a execução real?
6. Wrapper HTTP sobre a `api` function é a escolha certa, ou é dívida técnica sobre uma base que já tem 10 defeitos conhecidos?
