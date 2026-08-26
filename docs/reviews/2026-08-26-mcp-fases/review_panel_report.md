# Review Panel Report — Proposta MCP Faseada

**Data:** 2026-08-26  
**Escopo:** `docs/proposta-mcp-fases.md`  
**Pergunta:** a arquitetura é segura e escalável para produção?

## Veredito executivo

**REJEITAR a promoção/exposição neste estado.** A direção geral — ferramentas específicas, consulta declarativa, sem SQL livre e fases — é aproveitável, mas a proposta subestima o estado real do código e chama de “fronteira no banco” um isolamento que, no caminho de API/MCP, depende de filtros manuais executados com `service_role`.

Scores dos revisores: **4/10, 4/10, 4/10, 5/10, 5/10**. Quatro recomendaram `REVISE`; o Security Auditor recomendou `REJECT`.

## Consenso técnico

1. **Não expor escrita de agente ainda.** A chave atual é tudo-ou-nada; DELETE de recorrência é destrutivo; não há idempotência, versionamento ou testes do caminho HTTP por API key.
2. **Mudar o diagnóstico da proposta.** P8 não é uma exposição ativa: o dispatcher do MCP retorna erro antes do `switch` (`mcp/src/index.ts:853`). Porém, os handlers são código não exercitado, sem tenant confiável e não podem ser tratados como “já existentes”.
3. **Corrigir a listagem antes de qualquer Fase 1.** A view `lancamentos_bi` não possui `tenant_id`, mas a API filtra por essa coluna (`supabase/functions/api/index.ts:284`). O resultado esperado é erro 500; removê-lo sem redesenhar a view criaria risco cross-tenant via `service_role`.
4. **Corrigir o RPC de saldos no caminho de API.** `can_access()` depende de `auth.uid()` (`20260825000300_rls_engine.sql:22-26`); service role não traz esse usuário. O RPC pode retornar zero linhas mesmo com `_tenant` correto.
5. **Atomicidade precisa viver no banco.** HTTP/PostgREST em chamadas separadas não entrega workflow multi-etapas atômico. Transferência, baixa com recorrência e lotes devem usar RPC transacional ou promessa explicitamente limitada.
6. **Idempotência precisa ser implementada, não apenas aceita no payload.** Criar tabela/índice/retorno canônico e cobrir retry após efeito aplicado e resposta perdida.
7. **Adicionar contrato HTTP por API key.** Os testes RLS existentes validam `authenticated`, não a edge function com `service_role`; precisam existir testes de dois tenants para cada endpoint exposto.
8. **Adicionar contenção.** Escopo read-only/read-write por chave, expiração, limite por operação e confirmação para escrita/perda de dados.
9. **Tratar prompt injection.** Campos como `observacao` e `cliente_credor` são texto controlado por usuários e podem chegar ao LLM que possui ferramenta de escrita. A proposta não define isolamento de instruções, confirmação humana, política de dados não confiáveis ou execução somente de operações propostas.

## Fase 0 mínima revisada

Antes de qualquer exposição a agente:

- redefinir `lancamentos_bi` com tenant explícito ou removê-la do contrato;
- corrigir RPCs e separar claramente caminho `authenticated` de caminho API key;
- validar valores monetários, limites de parcelas e estados de baixa;
- corrigir auditoria em DELETE e atribuir chamadas de agente a uma identidade de API key/ator, não apenas `auth.uid()`;
- implementar idempotência e, quando necessário, `expected_version`/lock;
- bloquear ou transformar DELETE de série em operação protegida, com dry-run e confirmação;
- definir escopo/expiração de API key e rate limit atômico;
- criar suíte de contrato HTTP multi-tenant e testes de retry/concorrência;
- decidir, com validação explícita do usuário, se o isolamento será RLS com contexto de tenant dedicado ou filtros manuais temporários. O segundo não deve ser chamado de fronteira no banco.

## Faseamento recomendado

**Fase 0 — fundação e contrato:** itens acima, sem MCP público.  
**Fase 1 — leitura somente:** API/MCP autenticado, allowlist pequena, paginação, view/RPCs tenant-safe e testes de isolamento.  
**Fase 2 — escrita controlada:** apenas operações idempotentes, escopo de chave, confirmação e auditoria com ator.  
**Fase 3 — lotes e recursos novos:** somente após RPCs transacionais; anexos/OCR, conciliação e webhooks devem ser projetos separados.

## Itens que não devem ser tratados como aprovados

- “20 ferramentas MCP existentes”: declaradas, mas dispatcher está desativado e várias usam tabela/RPC legados.
- “80% já coberto”: não há teste de carga nem contrato da edge function; o endpoint principal de listagem está quebrado por schema.
- “dry_run” como controle de segurança: sem snapshot/versionamento, estado pode mudar entre simulação e execução.
- `executar_sql`: está desativado hoje; deve continuar fora do contrato.

## Decisão

**REVISE antes de implementar Fase 1.** A proposta deve ser corrigida primeiro; nenhuma migration de RLS/roles deve ser feita sem validação explícita do usuário, conforme `finance-flow/CLAUDE.md`.

## Fontes internas

- `docs/proposta-mcp-fases.md`
- `docs/reviews/2026-08-26-mcp-fases/state/reviewer_security_phase_3.md`
- `docs/reviews/2026-08-26-mcp-fases/state/reviewer_codequality_phase_3.md`
- `docs/reviews/2026-08-26-mcp-fases/state/reviewer_feasibility_phase_3.md`
- `docs/reviews/2026-08-26-mcp-fases/state/reviewer_risk_phase_3.md`
- `docs/reviews/2026-08-26-mcp-fases/state/reviewer_devilsadvocate_phase_3.md`
