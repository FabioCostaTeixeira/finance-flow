# MCP Seguro Multi-Tenant e Funcionalmente Completo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** transformar o Finance Flow em um MCP funcionalmente completo para operações financeiras, preservando isolamento multi-tenant, segurança, consistência monetária e promoção controlada.

**Architecture:** API HTTP e MCP compartilham contratos versionados. Tenant, ator e escopo vêm da API key; nenhuma rota aceita tenant de payload. O caminho de agente usa contexto compatível com RLS ou RPCs SECURITY DEFINER tenant-safe; service role direto fica restrito a funções administrativas internas. Toda escrita financeira passa por RPC transacional, idempotência, versionamento e auditoria.

**Tech Stack:** Supabase/PostgreSQL 15, RLS, RPCs PL/pgSQL, Edge Functions Deno, React/Vite/TypeScript, Vitest, Supabase Storage privado, MCP.

## In Scope

- contratos MCP e HTTP versionados;
- health, capabilities, schema, contexto e versão;
- lançamentos, pagamentos/recebimentos integrais e parciais;
- correção e estorno de baixas;
- transferências vinculadas, atômicas e estornáveis;
- recorrências e parcelamentos;
- anexos/comprovantes com Storage privado, hash e URLs temporárias;
- relatórios financeiros agregados no banco;
- cadastros administrativos;
- lotes com simulação, confirmação e rollback definido;
- auditoria interna consultável;
- erros estáveis, paginação e observabilidade;
- testes RLS, RPC, HTTP, MCP, Storage e concorrência.

## Explicit Non-Goals

Não criar tasks, tabelas, endpoints, ferramentas, abstrações ou preparação futura para:

- conciliação bancária;
- importação OFX;
- importação CSV bancário;
- Open Finance;
- correspondência automática com transações bancárias;
- webhooks;
- entrega de notificações;
- registro/administração de webhooks;
- cron de auditoria da Mary;
- eventos externos em tempo real;
- OCR novo.

Auditoria interna continua no escopo somente como trilha consultável pelo sistema. Não é webhook nem notificação externa.

## Global Constraints

- Nenhuma rota financeira antes de tenant, autenticação e escopos estarem definidos e testados.
- Toda alteração de schema vai para migration versionada; nunca aplicar SQL diretamente em produção.
- Nenhuma escrita `--linked` antes de aprovação explícita, backup e dry-run.
- Não alterar RLS, roles ou permissões sem validação explícita do usuário.
- `SUPABASE_SERVICE_ROLE_KEY` nunca aparece no frontend, no MCP público, em respostas ou logs.
- `executar_sql` permanece desativado e não aparece como ferramenta funcional.
- Não anunciar no `tools/list` handler ausente, desabilitado ou não testado.
- Nenhuma escrita financeira sem idempotency key, salvo health/discovery e leituras.
- Nenhuma mutação sensível sem `expected_version`; confirmação é vinculada ao payload e à versão.
- Erros não expõem SQL, stack trace, tabela interna, segredo, path privado ou dados de outro tenant.
- Usar `npx tsc -p tsconfig.app.json --noEmit`; `npx tsc --noEmit` não é evidência válida neste projeto.
- Todo teste de isolamento usa pelo menos dois tenants.

## Security Invariants

1. Tenant é derivado da API key e nunca do argumento da ferramenta.
2. Chave expirada/revogada ou escopo insuficiente falha antes de consultar dados.
3. Service role não é fronteira de tenant; se usado internamente, cada operação chama RPC tenant-safe ou recebe contexto validado.
4. RLS/RPC nega contexto ausente e impede leitura, escrita, Storage e auditoria cross-tenant.
5. Valor monetário é decimal canônico; cálculo sensível não usa `number` JS.
6. Retry não duplica efeito financeiro.
7. Conflito de versão não deixa alteração parcial.
8. Estorno preserva histórico; não há hard delete de evidência financeira.
9. Texto de usuário é dado não confiável; nunca controla instruções do agente.
10. Auditoria é append-only, tenant-safe, redigida e atribuída a ator/API key.

## Tool Inventory

### Discovery

`health_check`, `get_capabilities`, `get_schema`, `get_current_context`, `get_api_version`.

### Lançamentos

`listar_lancamentos`, `obter_lancamento`, `verificar_duplicidade`, `criar_lancamento`, `atualizar_lancamento`, `cancelar_lancamento`, `excluir_lancamento`, `restaurar_lancamento`.

### Pagamentos e recebimentos

`baixar_lancamento`, `registrar_pagamento_parcial`, `registrar_recebimento_parcial`, `listar_movimentos_lancamento`, `obter_movimento_pagamento`, `corrigir_movimento_pagamento`, `estornar_movimento_pagamento`, `estornar_baixa`.

### Transferências

`criar_transferencia`, `obter_transferencia`, `listar_transferencias`, `estornar_transferencia`.

### Recorrências

`criar_recorrencia`, `listar_recorrencias`, `obter_recorrencia`, `atualizar_recorrencia`, `pausar_recorrencia`, `retomar_recorrencia`, `cancelar_recorrencia`, `gerar_proximas_parcelas`, `gerar_parcela_ausente`, `alterar_somente_esta_parcela`, `alterar_esta_e_as_futuras`, `excluir_somente_esta_parcela`, `excluir_esta_e_as_futuras`.

### Anexos

`iniciar_upload_comprovante`, `finalizar_upload_comprovante`, `associar_comprovante_lancamento`, `listar_comprovantes_lancamento`, `obter_metadados_comprovante`, `obter_url_temporaria_comprovante`, `buscar_comprovante_por_hash`, `remover_associacao_comprovante`.

### Relatórios

`consultar_saldo_realizado`, `consultar_saldo_acumulado`, `consultar_saldo_projetado`, `relatorio_fluxo_caixa`, `relatorio_contas_pagar`, `relatorio_contas_receber`, `relatorio_atrasados`, `relatorio_por_categoria`, `relatorio_por_banco`, `relatorio_por_cliente_credor`, `comparar_periodos`, `projetar_fluxo_caixa`, `relatorio_kpis`.

### Cadastros

`criar_banco`, `atualizar_banco`, `arquivar_banco`, `reativar_banco`, `criar_categoria`, `atualizar_categoria`, `mover_categoria`, `arquivar_categoria`, `reativar_categoria`, `criar_cliente_credor`, `atualizar_cliente_credor`, `arquivar_cliente_credor`, `mesclar_clientes_credores`.

### Lotes e auditoria

`simular_lote`, `executar_lote`, `obter_resultado_lote`, `preparar_operacao`, `confirmar_operacao`, `listar_eventos_auditoria`, `obter_evento_auditoria`.

## Scope Matrix

| Grupo | Escopos mínimos |
|---|---|
| Discovery | nenhum além de chave válida |
| Leituras financeiras | `finance:read` |
| Criar | `finance:create` |
| Atualizar | `finance:update` |
| Pagar/receber | `finance:pay` |
| Transferir | `finance:transfer` |
| Excluir/cancelar/restaurar | `finance:delete` |
| Anexos | `finance:attachments` |
| Auditoria | `finance:audit` |
| Cadastros | `admin:cadastros` |

Permissões são cumulativas e mínimas. Não criar escopos de conciliação ou webhook.

## Dependency Graph

```text
1 diagnóstico/contratos
  → 2 tenant/RLS
  → 3 API keys/escopos/rate limit
  → 4 discovery/version/schema
  → 5 leituras/paginação/erros/observabilidade
  → 6 idempotência/versionamento/auditoria
  → 7 dinheiro/movimentos
  → 8 lançamentos
  → 9 transferências
  → 10 recorrências
  → 11 anexos
  → 12 relatórios
  → 13 cadastros
  → 14 dry-run/confirmação/lotes
  → 15 MCP read-only
  → 16 MCP escrita
  → 17 verificação local
  → 18 aprovação/promoção
```

## Migration Strategy

Migrations propostas, após conferir que não colidem com histórico local:

| Ordem | Migration | Conteúdo |
|---:|---|---|
| 1 | `20260827000100_mcp_agent_context.sql` | contexto tenant/ator e grants |
| 2 | `20260827000200_mcp_api_key_scopes.sql` | escopos, expiração, revogação e índices |
| 3 | `20260827000300_mcp_idempotency.sql` | reserva, resposta canônica e retenção |
| 4 | `20260827000400_mcp_versions_audit.sql` | versões, auditoria de ator e invariantes |
| 5 | `20260827000500_mcp_movimentos_pagamento.sql` | movimentos, estornos e RPCs |
| 6 | `20260827000600_mcp_transferencias.sql` | transferência atômica e estorno |
| 7 | `20260827000700_mcp_recorrencias.sql` | série, parcelas e geração concorrente |
| 8 | `20260827000800_mcp_comprovantes.sql` | metadados, hash, vínculo e Storage policies |
| 9 | `20260827000900_mcp_relatorios.sql` | RPCs agregadoras tenant-safe |
| 10 | `20260827001000_mcp_cadastros.sql` | arquivamento, hierarquia e cliente/credor |
| 11 | `20260827001100_mcp_confirmacoes_lotes.sql` | tokens, operações e resultados de lote |

Cada migration terá teste de reset local, grants explícitos, `search_path = public` em SECURITY DEFINER e revogação para `anon/public` quando aplicável.

### Task 1: Diagnóstico, decisões e catálogo versionado

**Objective:** substituir diagnóstico otimista por contrato implementável e inventário completo.

**Depends on:** nenhuma.

**Files:**
- Create: `docs/mcp/tool-contracts.md`
- Create: `mcp/src/contracts/tools.ts`
- Modify: `docs/proposta-mcp-fases.md`
- Reference: `docs/reviews/2026-08-26-mcp-fases/review_panel_report.md`

**Database changes:** nenhum.

**HTTP contracts:** registrar método, rota, request ID, envelope de sucesso/erro e headers por ferramenta.

**MCP contracts:** cada ferramenta terá nome, leitura/escrita, escopos, input/output, campos obrigatórios, enums, limites, paginação, idempotência, versão, confirmação, dry-run, erros, efeitos, retry, exemplos e testes.

**Security invariants:** não anunciar ferramenta sem handler conectado e teste.

**Steps:**
- [ ] Escrever testes que comparem inventário declarado com handlers exportados.
- [ ] Executar testes e confirmar falha para ferramentas atuais declaradas mas mortas.
- [ ] Registrar catálogo completo, incluindo as ferramentas obrigatórias deste plano.
- [ ] Marcar explicitamente discovery, auditoria interna e anexos; não adicionar itens non-goal.
- [ ] Atualizar proposta com P8 corrigido, view sem tenant, service role, prompt injection e limitações reais.
- [ ] Documentar decisões pendentes com opções, recomendação, impacto e bloqueio.
- [ ] Commit sugerido: `docs: define contratos completos do MCP`.

**Acceptance criteria:** catálogo é fonte de verdade; ferramentas fora dele não são públicas; nenhuma exclusão deliberada aparece como preparação futura.

**Commands:** `npm run test:unit`; `rg -n "webhook|OFX|Open Finance|conciliação" docs/mcp mcp/src/contracts`.

**Expected results:** testes passam; busca encontra apenas referências de non-goal no documento de escopo, nunca implementação.

### Task 2: Contexto de tenant, ator e RLS

**Objective:** tornar tenant boundary verificável no banco.

**Depends on:** Task 1.

**Files:**
- Create: `supabase/migrations/20260827000100_mcp_agent_context.sql`
- Create: `src/test/rls/mcp-agent-context.test.ts`
- Modify: `supabase/functions/_shared/auth.ts`

**Database changes:** contexto autenticado de tenant/ator; RPCs ou papel dedicado; grants mínimos; fail-closed.

**HTTP contracts:** chave resolve `tenant_id`, `actor_id`, escopos e request ID; payload com tenant divergente é ignorado/rejeitado.

**MCP contracts:** ferramentas nunca recebem tenant como autorização.

**Security invariants:** A não lê/escreve B; contexto ausente falha; service role não bypassa RPC tenant-safe.

**Steps:**
- [ ] Escrever testes A/B e contexto ausente.
- [ ] Executar `npm run test:rls` e confirmar falha inicial.
- [ ] Escolher entre papel compatível com RLS e RPC SECURITY DEFINER; recomendar RPCs transacionais com contexto validado enquanto Edge Functions não suportarem JWT de usuário por chave.
- [ ] Criar migration com `SET search_path = public`, revogar execução pública e filtros internos.
- [ ] Implementar resolução de tenant/ator sem aceitar payload.
- [ ] Rodar `npx supabase db reset`, suíte RLS e regressão.
- [ ] Commit sugerido: `fix(security): enforce tenant context for agent access`.

**Acceptance criteria:** todos os testes A/B passam para tabela, RPC e caminho HTTP; contexto ausente não retorna dados.

**Commands:** `npx supabase db reset`; `npm run test:rls`; `npm run lint`.

**Expected results:** isolamento comprovado; nenhum write em produção.

### Task 3: API keys, escopos, revogação e rate limit

**Objective:** conter acesso por chave e impedir corrida no rate limit.

**Depends on:** Task 2.

**Files:**
- Create: `supabase/migrations/20260827000200_mcp_api_key_scopes.sql`
- Modify: `supabase/functions/api/index.ts`
- Modify: `src/hooks/useApiKeys.ts`
- Modify: `src/pages/ApiKeys.tsx`
- Create: `src/test/api/auth-contract.test.ts`

**Database changes:** `scope[]`, `expires_at`, `revoked_at`, prefixo/hash, contador atômico ou RPC de quota.

**HTTP contracts:** `INVALID_API_KEY`, `KEY_EXPIRED`, `KEY_REVOKED`, `INSUFFICIENT_SCOPE`, `RATE_LIMITED`; retry seguro via `Retry-After`.

**MCP contracts:** capabilities refletem somente escopos da chave.

**Security invariants:** segredo só existe na criação; tenant sempre da chave; rate limit por chave e tenant.

**Steps:**
- [ ] Escrever testes de escopo, expiração, revogação, payload cross-tenant e 105 requisições concorrentes.
- [ ] Executar testes e confirmar falha no modelo atual.
- [ ] Implementar hash SHA-256, escopos mínimos e revogação imediata.
- [ ] Implementar incremento atômico em RPC/tabela; log não pode ser fonte única do bloqueio.
- [ ] Atualizar UI para mostrar somente prefixo e escopos.
- [ ] Testar regressão de autenticação.
- [ ] Commit sugerido: `fix(auth): scope and atomically rate-limit API keys`.

**Acceptance criteria:** chave read não escreve; chave expirada/revogada falha antes de query; concorrência respeita limite.

**Commands:** `npm run test:unit`; `npm run test:rls`; `npm run lint`; `npm run build`.

**Expected results:** escopos e rate limit testados localmente.

### Task 4: Health, capabilities, schema e versão

**Objective:** fornecer descoberta segura e compatibilidade explícita.

**Depends on:** Task 3.

**Files:**
- Modify: `supabase/functions/api/index.ts`
- Modify: `mcp/src/index.ts`
- Create: `mcp/src/contracts/discovery.ts`
- Create: `src/test/api/discovery-contract.test.ts`

**Database changes:** nenhum novo; ler versão de migration por mecanismo sem expor schema interno.

**HTTP contracts:** `GET /health`, `GET /capabilities`, `GET /schema`, `GET /context`, `GET /version`.

**MCP contracts:** respostas sem chave, connection string, SQL, role secreta ou stack trace. `health_check` inclui status, api_version, schema_version, database, tenant_context, request_id e timestamp.

**Security invariants:** banco indisponível retorna `SERVICE_UNAVAILABLE`, sem dados financeiros.

**Steps:**
- [ ] Escrever testes de sucesso, banco indisponível, chave inválida, expirada, tenant ausente e segredo ausente.
- [ ] Implementar respostas versionadas e capabilities filtradas por escopo.
- [ ] Implementar schema público com campos editáveis/read-only, enums, relações, limites e paginação.
- [ ] Ligar endpoints equivalentes aos handlers MCP.
- [ ] Testar compatibilidade de versão.
- [ ] Commit sugerido: `feat(mcp): add safe discovery and version contracts`.

**Acceptance criteria:** discovery funciona sem revelar política privada; ferramentas não autorizadas não aparecem como disponíveis.

**Commands:** `npm run test:unit`; `npm run lint`.

**Expected results:** envelope válido, sem segredos.

### Task 5: Modelo monetário, erros, paginação e observabilidade

**Objective:** padronizar contrato transversal antes das operações financeiras.

**Depends on:** Task 4.

**Files:**
- Create: `supabase/functions/_shared/money.ts`
- Create: `supabase/functions/_shared/errors.ts`
- Create: `supabase/functions/_shared/pagination.ts`
- Create: `supabase/functions/_shared/observability.ts`
- Create: `src/test/api/cross-cutting-contract.test.ts`

**Database changes:** precisão compatível com `numeric(15,2)`; sem `float` em RPC financeira.

**HTTP contracts:** erro único `{success:false,error:{code,message,retryable,field_errors,request_id}}`; paginação com cursor opaco, limite padrão/máximo e ordenação estável.

**MCP contracts:** decimal como string canônica `"41.24"`, `currency:"BRL"`; filtros tipados; nunca SQL.

**Security invariants:** rejeitar zero/negativo quando aplicável, vírgula decimal, notação científica, NaN, infinito e excesso de casas; não logar dinheiro além do necessário.

**Steps:**
- [ ] Escrever testes para `0`, negativo, máximo, `41,24`, `41.24`, `1e3`, NaN, infinito, arredondamento e soma parcial.
- [ ] Implementar parser decimal canônico e limites documentados; moeda inicial recomendada: BRL.
- [ ] Implementar cursor com `data_vencimento ASC, id ASC`, filtros vinculados e sem total caro por padrão.
- [ ] Implementar request ID, duração, ferramenta, tenant interno, prefixo, resultado e métricas sem segredo.
- [ ] Implementar todos os códigos estáveis deste plano.
- [ ] Commit sugerido: `feat(api): standardize money errors pagination and telemetry`.

**Acceptance criteria:** nenhum cálculo sensível depende de `number`; qualquer listagem tem cursor determinístico; erros não vazam internals.

**Commands:** `npm run test:unit`; `npm run lint`.

**Expected results:** suíte transversal passa.

### Task 6: Idempotência, versionamento e auditoria

**Objective:** garantir retry seguro, concorrência e atribuição.

**Depends on:** Task 5.

**Files:**
- Create: `supabase/migrations/20260827000300_mcp_idempotency.sql`
- Create: `supabase/migrations/20260827000400_mcp_versions_audit.sql`
- Modify: `supabase/functions/api/index.ts`
- Modify: `supabase/migrations/20260825000800_audit_log.sql`
- Create: `src/test/api/idempotency-version-audit.test.ts`

**Database changes:** `idempotency_keys(tenant_id, operation, key, payload_hash, status, resource_id, response, http_status, request_id, expires_at)`; versão em recursos sensíveis; auditoria append-only.

**HTTP contracts:** replay igual devolve resposta canônica; payload diferente devolve `IDEMPOTENCY_CONFLICT`; concorrência devolve `OPERATION_IN_PROGRESS` ou replay.

**MCP contracts:** toda escrita declara idempotência/versionamento no catálogo.

**Security invariants:** chave isolada por tenant/operação; token não guarda segredo; auditoria registra ator, ferramenta, versão, request ID e origem.

**Steps:**
- [ ] Escrever testes de retry, payload diferente, duas chamadas concorrentes, resposta perdida e `VERSION_CONFLICT`.
- [ ] Criar reserva atomicamente e estado de operação recuperável.
- [ ] Implementar hash canônico decimal/JSON ordenado.
- [ ] Implementar incremento de versão na mesma transação.
- [ ] Corrigir auditoria de DELETE sem acessar `NEW` inválido e preservar histórico.
- [ ] Verificar RLS da auditoria, retenção e redaction.
- [ ] Commit sugerido: `feat(finance): add idempotency optimistic locking and actor audit`.

**Acceptance criteria:** nenhum retry duplica efeito; conflito não modifica recurso; auditoria interna consultável e tenant-safe.

**Commands:** `npx supabase db reset`; `npm run test:rls`; `npm run test:unit`.

**Expected results:** testes concorrentes verdes.

### Task 7: Movimentos de pagamento e recebimento

**Objective:** modelar baixa integral/parcial como movimentos imutáveis corrigíveis.

**Depends on:** Task 6.

**Files:**
- Create: `supabase/migrations/20260827000500_mcp_movimentos_pagamento.sql`
- Create: `supabase/functions/_shared/payment-rules.ts`
- Create: `src/test/api/payment-contract.test.ts`

**Database changes:** `movimentos_pagamento` com id, tenant, lançamento, tipo, valor, moeda, data, banco, status, operação, ator, observação, versão, estorno e timestamps; RPCs de registrar/corrigir/estornar.

**HTTP contracts:** endpoints próprios para integral, parcial, correção, estorno e listagem; nunca editar `valor_pago` diretamente.

**MCP contracts:** ferramentas de pagamentos listadas no inventário, com `finance:pay`, idempotência, `expected_version` quando sensível, confirmação e dry-run.

**Security invariants:** soma válida define pago/recebido; zero/excedente inválido; banco e lançamento do mesmo tenant; estorno não apaga.

**Steps:**
- [ ] Escrever testes de integral, dois parciais, último parcial, excedente, retry, concorrência, correção, estorno parcial/integral, banco/data e falha transacional.
- [ ] Criar tabela e constraints.
- [ ] Implementar RPCs com lock, versão e auditoria.
- [ ] Derivar status, saldo restante, `valor_pago` e `data_pagamento` na transação.
- [ ] Definir decisão pendente para múltiplos bancos: recomendar listar movimentos e não inventar banco único.
- [ ] Commit sugerido: `feat(finance): model payment and receipt movements`.

**Acceptance criteria:** baixa parcial/integral, correção e estorno são consistentes e replay-safe.

**Commands:** `npx supabase db reset`; `npm run test:rls`; `npm run test:unit`.

**Expected results:** nenhuma duplicação ou alteração parcial.

### Task 8: Lançamentos completos

**Objective:** expor lançamentos com allowlist, cancelamento, restauração e duplicidade segura.

**Depends on:** Tasks 5–7.

**Files:**
- Modify: `supabase/functions/api/index.ts`
- Create: `supabase/functions/_shared/lancamento-rules.ts`
- Create: `src/test/api/lancamentos-contract.test.ts`

**Database changes:** view `lancamentos_bi` tenant-safe ou remoção do contrato; soft delete/cancelamento conforme decisão.

**HTTP contracts:** `GET /lancamentos`, `GET /lancamentos/:id`, `POST`, `PATCH` allowlisted, `POST /cancelar`, `POST /restaurar`, `DELETE` protegido.

**MCP contracts:** leituras com `finance:read`; criação com `finance:create`; update com `finance:update`; exclusão com `finance:delete`.

**Security invariants:** status/valor pago/vínculos/tenant/versão não são editáveis genericamente; banco/categoria pertencem ao tenant; status inicial derivado.

**Steps:**
- [ ] Escrever testes de campos proibidos, banco/categoria cross-tenant, duplicidade, cancelamento, restore, pago não excluível e paginação.
- [ ] Corrigir view e resumo sem carregar tabela inteira.
- [ ] Implementar endpoints separados e idempotentes.
- [ ] Testar tenant A/B e regressão do frontend.
- [ ] Commit sugerido: `feat(api): expose safe versioned lancamento operations`.

**Acceptance criteria:** listagem não 500, não trunca silenciosamente e nenhuma mutação genérica altera estado derivado.

**Commands:** `npm run test:unit`; `npm run test:rls`; `npm run lint`; `npm run build`.

**Expected results:** contrato de lançamentos verde.

### Task 9: Transferências atômicas e estornáveis

**Objective:** criar duas pernas vinculadas ou nenhuma, com estorno simétrico.

**Depends on:** Tasks 6–8.

**Files:**
- Create: `supabase/migrations/20260827000600_mcp_transferencias.sql`
- Modify: `supabase/functions/api/index.ts`
- Create: `src/test/api/transferencias-contract.test.ts`

**Database changes:** RPC de criação/estorno, vínculo único, constraints e auditoria da operação.

**HTTP contracts:** `POST/GET /transferencias`, `POST /transferencias/:id/estorno`; origem/destino, valor, versão e confirmação.

**MCP contracts:** `finance:transfer`, idempotência obrigatória, dry-run e confirmação.

**Security invariants:** mesma tenant, bancos diferentes, mesmo valor e `transferencia_id`; não contar como receita/despesa operacional.

**Steps:**
- [ ] Escrever testes de sucesso, mesma conta, tenant diferente, saldo insuficiente se aplicável, falha de uma perna, retry, concorrência, estorno e estorno duplicado.
- [ ] Implementar RPC única com `BEGIN` implícito, locks e rollback.
- [ ] Impedir exclusão de uma perna.
- [ ] Ajustar relatórios e saldo de bancos.
- [ ] Commit sugerido: `feat(finance): make transfers atomic and reversible`.

**Acceptance criteria:** nunca existe transferência com uma perna; estorno é idempotente.

**Commands:** `npx supabase db reset`; `npm run test:rls`; `npm run test:unit`.

**Expected results:** atomicidade comprovada por falha injetada.

### Task 10: Recorrências e parcelamentos

**Objective:** administrar série completa sem alterar silenciosamente parcelas pagas.

**Depends on:** Tasks 6–9.

**Files:**
- Create: `supabase/migrations/20260827000700_mcp_recorrencias.sql`
- Modify: `supabase/functions/api/index.ts`
- Modify: `src/lib/recurrence.ts`
- Create: `src/test/api/recorrencias-contract.test.ts`

**Database changes:** entidade/série, estado pausa/retomada/cancelamento, regra de fim, timezone e constraints de parcela.

**HTTP contracts:** endpoints para série, gerar próximas/ausente, alterar uma/futuras e excluir uma/futuras.

**MCP contracts:** ferramentas de recorrência com `finance:create/update/delete`, idempotência, versão e confirmação quando destrutivas.

**Security invariants:** geração concorrente não duplica; timezone e fim de semana explícitos; parcelas pagas protegidas; tenant e vínculos validados.

**Steps:**
- [ ] Escrever testes mensal, semanal, finita, infinita, pausa, retomada, cancelamento, parcela ausente, geração concorrente, retry, conflito e tentativa sobre paga.
- [ ] Implementar série e geração idempotente.
- [ ] Separar alteração desta parcela, desta e futuras e exclusão equivalente.
- [ ] Definir política para parcelas futuras materializadas e retroativas; bloquear dependentes até decisão.
- [ ] Commit sugerido: `feat(finance): manage recurrence series and installments`.

**Acceptance criteria:** nenhuma baixa cria parcela duplicada; série versionada; pagamentos protegidos.

**Commands:** `npm run test:unit`; `npm run test:rls`; `npm run lint`.

**Expected results:** regras temporais reproduzíveis em timezone declarado.

### Task 11: Anexos e comprovantes

**Objective:** armazenar comprovantes com isolamento, hash e URL temporária. OCR não faz parte.

**Depends on:** Tasks 2, 3, 6, 8.

**Files:**
- Create: `supabase/migrations/20260827000800_mcp_comprovantes.sql`
- Modify: `supabase/config.toml`
- Create: `supabase/functions/_shared/comprovantes.ts`
- Create: `src/test/storage/comprovantes-contract.test.ts`

**Database changes:** metadados com id, tenant, lançamento opcional, SHA-256, nome sanitizado, MIME, tamanho, bucket/path interno, Pix opcional, data, origem, ator e timestamps.

**HTTP contracts:** iniciar/finalizar upload, associar/listar/metadados, URL temporária, busca por hash e remover associação.

**MCP contracts:** `finance:attachments`; não retornar base64 grande; URL nunca permanente.

**Security invariants:** bucket privado, allowlist MIME/tamanho, path gerado pelo servidor, dedupe tenant+hash, sem vazamento entre tenants, auditoria sem binário.

**Steps:**
- [ ] Escrever testes de upload válido, MIME/tamanho, hash duplicado, path traversal, outro tenant, URL expirada, associação e download negado.
- [ ] Criar Storage policies e metadados tenant-safe.
- [ ] Implementar upload em duas etapas e confirmação de hash/tamanho/MIME.
- [ ] Implementar URL assinada com expiração curta.
- [ ] Definir política de apagar vínculo versus arquivo físico; recomendar retenção física até limpeza administrativa explícita.
- [ ] Commit sugerido: `feat(finance): add private receipt attachments`.

**Acceptance criteria:** nenhum arquivo fica público; cliente nunca controla path; outro tenant não acessa URL.

**Commands:** `npx supabase db reset`; `npm run test:rls`; `npm run test:unit`.

**Expected results:** Storage e metadados isolados.

### Task 12: Relatórios financeiros completos

**Objective:** produzir saldos e relatórios no banco, sem agregação integral em JavaScript.

**Depends on:** Tasks 7–11.

**Files:**
- Create: `supabase/migrations/20260827000900_mcp_relatorios.sql`
- Modify: `supabase/functions/api/index.ts`
- Create: `src/test/api/relatorios-contract.test.ts`

**Database changes:** RPCs agregadoras tenant-safe para realizado, acumulado, projetado, fluxo, pagar, receber, atrasados, categoria, banco, cliente/credor, comparação, projeção e KPI.

**HTTP contracts:** período `data_inicio` inclusivo e `data_fim` exclusivo; timezone, regime, moeda, statuses, filtros e versão retornados.

**MCP contracts:** relatórios do inventário; detalhes paginados; totais e agrupamentos separados.

**Security invariants:** transferência afeta saldos bancários mas não receita/despesa operacional; parcial/estorno seguem movimentos; tenant e filtros no banco.

**Steps:**
- [ ] Escrever testes de período vazio, limites, transferência, parcial, estorno, recorrência futura, múltiplos bancos/categorias, timezone, volume e detalhes paginados.
- [ ] Implementar RPCs com precisão decimal e filtros indexáveis.
- [ ] Corrigir RPC de saldo com parâmetros corretos e contexto de agente.
- [ ] Documentar default de período apenas se houver; retornar período efetivo.
- [ ] Testar plano de execução em volume local representativo.
- [ ] Commit sugerido: `feat(reports): add tenant-safe financial report RPCs`.

**Acceptance criteria:** resumo e relatórios não usam `.select('*')` integral para agregar; números de transferência não inflacionam resultado operacional.

**Commands:** `npm run test:unit`; `npm run test:rls`; `npm run lint`.

**Expected results:** relatórios determinísticos e tenant-safe.

### Task 13: Cadastros administrativos

**Objective:** administrar bancos, categorias e clientes/credores com escopo próprio.

**Depends on:** Tasks 2, 3, 6, 8.

**Files:**
- Create: `supabase/migrations/20260827001000_mcp_cadastros.sql`
- Modify: `supabase/functions/api/index.ts`
- Create: `src/test/api/cadastros-contract.test.ts`

**Database changes:** arquivamento, unicidade por tenant, hierarquia sem ciclos; entidade cliente/credor somente se existente ou após decisão explícita.

**HTTP contracts:** endpoints CRUD restritos a `admin:cadastros`; arquivar/reativar; mesclar com confirmação.

**MCP contracts:** ferramentas de bancos/categorias/clientes do inventário.

**Security invariants:** não apagar referenciado; banco arquivado não recebe movimento; pai do mesmo tenant; recursos antigos continuam legíveis.

**Steps:**
- [ ] Escrever testes de ciclo, pai cross-tenant, arquivamento referenciado, reativação, duplicidade, merge, escopo e concorrência.
- [ ] Registrar decisão pendente sobre entidade própria de cliente/credor; recomendar não inventar CRUD se modelo não existir.
- [ ] Implementar RPCs idempotentes com versão e auditoria.
- [ ] Implementar confirmação para merge e arquivamento destrutivo.
- [ ] Commit sugerido: `feat(admin): add scoped master data operations`.

**Acceptance criteria:** `finance:write` não administra cadastros; nenhuma referência fica órfã.

**Commands:** `npm run test:unit`; `npm run test:rls`; `npm run lint`.

**Expected results:** cadastros isolados e reversíveis quando permitido.

### Task 14: Dry-run, confirmação vinculada e lotes

**Objective:** simular e executar operações críticas sem falsa garantia de atomicidade.

**Depends on:** Tasks 6–13.

**Files:**
- Create: `supabase/migrations/20260827001100_mcp_confirmacoes_lotes.sql`
- Create: `supabase/functions/_shared/confirmation.ts`
- Create: `src/test/api/operations-lote-confirmation.test.ts`

**Database changes:** tokens assinados de uso único, operação preparada, hash, versão, expiração, resultados por item e estado recuperável.

**HTTP contracts:** `POST /operations/prepare`, `POST /operations/confirm`, `POST /batches/simulate`, `POST /batches/execute`, `GET /batches/:id`.

**MCP contracts:** `preparar_operacao`, `confirmar_operacao`, `simular_lote`, `executar_lote`, `obter_resultado_lote`; não aceitar apenas `confirmed:true`.

**Security invariants:** token vincula tenant, chave/ator, operação, IDs, payload hash e versão; consumo atômico; dry-run não persiste efeito; lote exige limite, idempotência e confirmação.

**Steps:**
- [ ] Escrever testes de dry-run, token expirado, payload alterado, recurso alterado, replay, lote inválido, tenant cruzado, falha no meio e limite.
- [ ] Implementar dry-run usando mesmas validações da execução.
- [ ] Implementar confirmação de uso único e conflito de versão.
- [ ] Implementar lote com atomicidade total por padrão; sucesso parcial somente se modo nomeado e documentado.
- [ ] Definir limites de itens/payload/timeout e política de rollback.
- [ ] Commit sugerido: `feat(finance): add bound confirmations and batch simulation`.

**Acceptance criteria:** dry-run retorna estado atual/proposto, afetados, avisos e hash; execução exige token válido; lote não tem SQL.

**Commands:** `npm run test:unit`; `npm run test:rls`; `npm run lint`.

**Expected results:** nenhum lote sem limite ou confirmação.

### Task 15: MCP read-only

**Objective:** expor discovery, leituras, relatórios e auditoria somente após backend testado.

**Depends on:** Tasks 1–14.

**Files:**
- Modify: `mcp/src/index.ts`
- Create: `mcp/src/tools/read-only.ts`
- Create: `mcp/src/test/read-only-contract.test.ts`

**Database changes:** nenhuma nova; consumir RPCs/views já tenant-safe.

**HTTP contracts:** wrapper fino para rotas existentes, preservando envelope, request ID e erros estáveis.

**MCP contracts:** apenas ferramentas do catálogo com `finance:read`, `finance:audit` ou discovery; paginação obrigatória.

**Security invariants:** não usar handlers mortos, tabela legada ou view sem tenant; resposta sem internals.

**Steps:**
- [ ] Escrever teste que tools/list corresponde exatamente a handlers executáveis e escopos.
- [ ] Remover retorno incondicional morto e handlers não conectados do anúncio.
- [ ] Ligar leituras e relatórios com contratos versionados.
- [ ] Testar tenant A/B, chave read-only e erro sem vazamento.
- [ ] Commit sugerido: `feat(mcp): expose tested read-only tools`.

**Acceptance criteria:** qualquer ferramenta anunciada executa e tem contrato/teste; nenhum write disponível.

**Commands:** `npm run test:unit`; `npm run test:rls`; `npm run lint`.

**Expected results:** MCP read-only operacional localmente.

### Task 16: MCP de escrita controlada

**Objective:** expor mutações financeiras e administrativas com gates completos.

**Depends on:** Tasks 7–15.

**Files:**
- Create: `mcp/src/tools/write.ts`
- Modify: `mcp/src/index.ts`
- Create: `mcp/src/test/write-tools.test.ts`

**Database changes:** nenhuma nova; usar somente RPCs anteriores.

**HTTP contracts:** escopo, idempotency key, expected version, confirmação, dry-run e request ID são repassados sem alteração semântica.

**MCP contracts:** cada write declara efeitos colaterais, retry, confirmação e erro; texto livre é dado não confiável e não controla ferramenta.

**Security invariants:** agente não pode escolher tenant, status derivado, valor pago, vínculo interno ou path de Storage.

**Steps:**
- [ ] Escrever testes de cada grupo de escrita, escopos insuficientes, retry e prompt injection em observação/cliente.
- [ ] Ligar somente operações com RPC/teste verdes.
- [ ] Exigir confirmação para pagamento, estorno, transferência, exclusão, recorrência, merge e lote.
- [ ] Bloquear qualquer operação fora do catálogo.
- [ ] Commit sugerido: `feat(mcp): expose guarded financial write tools`.

**Acceptance criteria:** MCP de escrita não aumenta autoridade além da API; auditoria identifica ator e operação.

**Commands:** `npm run test:unit`; `npm run test:rls`; `npm run lint`; `npm run build`.

**Expected results:** escrita MCP coberta e escopada.

### Task 17: Verificação final local

**Objective:** provar o sistema completo antes de revisão/promover.

**Depends on:** Tasks 1–16.

**Files:**
- Create/Modify: `src/test/api/`, `src/test/rls/`, `mcp/src/test/`, `src/test/storage/`
- Modify: `README.md` com comandos e limites aprovados

**Database changes:** reset local completo e migrações em ordem.

**HTTP contracts:** contratos de dois tenants, erros, paginação, discovery, escrita e lote.

**MCP contracts:** tools/list, execução, retry, confirmação e versão.

**Security invariants:** nenhum cross-tenant, segredo ou operação fora de escopo.

**Steps:**
- [ ] `npx supabase db reset`.
- [ ] `npm run test:rls`.
- [ ] `npm run test:unit`.
- [ ] testes HTTP/API/MCP/Storage/concorrência/migrations.
- [ ] `npm run lint`.
- [ ] `npm run build`.
- [ ] teste manual com dois tenants, chave read, chave write e chave admin.
- [ ] revisar catálogo contra handlers e migrations contra histórico.
- [ ] Commit sugerido: `test(mcp): verify complete tenant-safe contract`.

**Acceptance criteria:** toda suíte passa; relatório registra comandos, versão do schema e evidências.

**Commands:** comandos acima, sem `--linked`.

**Expected results:** zero falhas, zero testes ignorados, zero segredo em artefatos.

### Task 18: Revisão, aprovação e promoção segura

**Objective:** promover somente após autorização e reconciliação do histórico.

**Depends on:** Task 17.

**Files:**
- Modify: `finance-flow/CLAUDE.md`
- Create: `docs/mcp/deploy-runbook.md`
- Create: `docs/mcp/rollback-runbook.md`

**Database changes:** nenhuma nova além das migrations aprovadas.

**HTTP contracts:** versão mínima compatível e health pós-deploy.

**MCP contracts:** capabilities pós-deploy devem refletir versão real.

**Security invariants:** backup antes de escrita; sem promoção sem aprovação explícita; rollback documentado e testado localmente.

**Steps:**
- [ ] Obter validação explícita do usuário para RLS/roles e escopos.
- [ ] Conferir histórico remoto: não assumir que migrations antigas do repo foram aplicadas.
- [ ] Fazer backup schema/data antes de qualquer `--linked`.
- [ ] Rodar `db push --dry-run` e revisar lista.
- [ ] Promover migrations e functions em janela combinada.
- [ ] Verificar health, versão, tenant A/B, escopos e ausência de segredos.
- [ ] Documentar rollback por migration reversível/forward fix; não usar `git reset --hard` nem apagar dados financeiros.
- [ ] Commit sugerido: `docs(mcp): add approved production deployment runbooks`.

**Acceptance criteria:** promoção auditada, health verde, nenhum tenant cruzado, rollback disponível.

**Commands:** somente após aprovação: `npx supabase db dump --linked`, `npx supabase db push --linked --dry-run`, depois comandos de promoção autorizados.

**Expected results:** produção recebe somente migrations revisadas e verificadas.

## Tool Matrix

| Tool group | Scope | Idempotency | Version | Confirmation | Dry-run |
|---|---|---:|---:|---:|---:|
| Discovery | key válida | não | não | não | não |
| Leituras | finance:read | não | não | não | não |
| Criar lançamento | finance:create | sim | não | não | sim |
| Atualizar lançamento | finance:update | sim | sim | sensível | sim |
| Cancelar/excluir/restaurar | finance:delete | sim | sim | sim | sim |
| Pagar/receber/estornar | finance:pay | sim | sim | sim | sim |
| Transferir/estornar | finance:transfer | sim | sim | sim | sim |
| Recorrência destrutiva | finance:update/delete | sim | sim | sim | sim |
| Anexos | finance:attachments | sim em mutação | associação sensível | não/sim | não |
| Cadastros | admin:cadastros | sim | sim | merge/destrutivo | sim |
| Lotes | escopos dos itens | sim lote/itens | sim | sim | obrigatório |
| Auditoria | finance:audit | não | não | não | não |

## Stable Error Codes

| Code | HTTP recomendado | Retryable |
|---|---:|---:|
| `UNAUTHENTICATED`, `INVALID_API_KEY`, `KEY_EXPIRED`, `KEY_REVOKED` | 401 | não |
| `INSUFFICIENT_SCOPE`, `TENANT_CONTEXT_MISSING` | 403 | não |
| `RESOURCE_NOT_FOUND` | 404 | não |
| `VALIDATION_ERROR`, `TRANSFER_ACCOUNT_CONFLICT`, `PAYMENT_EXCEEDS_BALANCE`, `RESOURCE_ARCHIVED` | 400/409 | não |
| `VERSION_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `DUPLICATE_FINANCIAL_EVENT`, `RECURRENCE_CONFLICT` | 409 | não |
| `OPERATION_IN_PROGRESS`, `RATE_LIMITED` | 409/429 | sim |
| `CONFIRMATION_REQUIRED`, `CONFIRMATION_INVALID`, `CONFIRMATION_EXPIRED` | 400/409 | não |
| `FILE_TYPE_NOT_ALLOWED`, `FILE_TOO_LARGE` | 400 | não |
| `SERVICE_UNAVAILABLE`, `INTERNAL_ERROR` | 503/500 | depende |

## Migration Inventory

As onze migrations listadas em Migration Strategy são obrigatórias somente se a implementação correspondente for aprovada. Cada uma precisa de teste de reset, grants, RLS/RPC e regeneração dos tipos Supabase quando alterar schema.

## Deploy Order

1. congelar contrato e aprovar decisões;
2. backup remoto somente leitura;
3. conferir divergência do histórico;
4. aplicar migrations locais via reset;
5. rodar RLS, unit, contrato, Storage, lint e build;
6. executar dry-run remoto;
7. promover migrations aprovadas;
8. publicar functions;
9. verificar health/version/capabilities e dois tenants;
10. habilitar MCP read-only;
11. habilitar writes somente após observação e aprovação separada.

## Rollback

- interromper exposição MCP e revogar chaves novas;
- manter dados financeiros e auditoria;
- usar migration forward-fix para schema já promovido;
- restaurar backup somente com decisão explícita e procedimento ensaiado;
- não apagar movimentos, estornos, auditoria ou comprovantes para “voltar versão”.

## Risks and Pending Decisions

- **Contexto no banco:** papel RLS dedicado versus RPC SECURITY DEFINER; recomendação: RPCs transacionais com contexto validado até haver transporte JWT apropriado.
- **Moeda:** recomendar BRL e decimal string `numeric(15,2)); bloquear múltiplas moedas até contrato de câmbio existir.
- **Cliente/credor:** confirmar se entidade própria existe; se não, manter campo existente e não criar CRUD desconectado.
- **Soft delete:** definir sem apagar histórico; recomendar cancelamento + arquivamento.
- **Pagamentos múltiplos bancos:** retornar movimentos, não inventar saldo em banco único.
- **Sucesso parcial em lotes:** recomendar atomicidade total como padrão.
- **Retenção:** definir prazo de idempotência, auditoria e arquivos antes da implementação.
- **Histórico remoto:** reconciliar migrations não registradas antes de promoção.

## Final Acceptance Checklist

- [ ] Tenant A não lê/escreve B em RLS, RPC, HTTP, MCP e Storage.
- [ ] Toda escrita financeira tem idempotência.
- [ ] Atualizações sensíveis têm versionamento.
- [ ] Baixa integral/parcial, correção e estorno passam testes.
- [ ] Transferências são atômicas, vinculadas e estornáveis.
- [ ] Recorrências e parcelas têm administração completa.
- [ ] Comprovantes são privados, hashados e associados com segurança.
- [ ] Relatórios distinguem realizado, acumulado e projetado.
- [ ] Cadastros têm `admin:cadastros`.
- [ ] Lotes exigem simulação e confirmação vinculada.
- [ ] Health, capabilities, schema e version estão disponíveis sem segredos.
- [ ] Erros são estáveis e sem vazamento.
- [ ] tools/list corresponde exatamente a handlers testados.
- [ ] Todos os testes locais passam.
- [ ] Migrations foram revisadas e resetadas do zero.
- [ ] Produção só foi alterada após aprovação explícita.

## Explicit Out-of-Scope Checklist

- [ ] Conciliação bancária não será implementada.
- [ ] OFX não será implementado.
- [ ] CSV bancário não será implementado.
- [ ] Open Finance não será implementado.
- [ ] Matching automático não será implementado.
- [ ] Webhooks não serão implementados.
- [ ] Notificações não serão implementadas.
- [ ] Cron da Mary não será implementado.
- [ ] Eventos externos em tempo real não serão implementados.
- [ ] OCR novo não será implementado.
