# MCP Seguro Multi-Tenant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** preparar exposição de leitura e escrita financeira a agentes de IA sem depender de filtros manuais frágeis, sem duplicação financeira e com isolamento multi-tenant testado.

**Architecture:** O transporte público será HTTP autenticado por API key com tenant e escopo resolvidos no servidor. O banco continuará sendo a fronteira de isolamento: o caminho de agente usará um papel/contexto dedicado compatível com RLS, ou RPCs transacionais com tenant derivado de contexto confiável; service role direto fica restrito a operações administrativas. O MCP expõe primeiro leitura allowlisted e somente depois escritas idempotentes.

**Tech Stack:** Supabase/PostgreSQL 15, RLS, RPCs PL/pgSQL, Edge Functions Deno, React/Vite/TypeScript, Vitest.

## Global Constraints

- Toda alteração de schema vai para `supabase/migrations/`; nunca aplicar SQL diretamente em produção.
- Nenhum comando `--linked` que escreva em produção antes de revisão e aprovação explícitas.
- Não alterar roles, RLS ou permissões sem validação explícita do usuário.
- `SUPABASE_SERVICE_ROLE_KEY` nunca vai para frontend, MCP público ou logs.
- Toda escrita financeira terá allowlist de campos, validação de valores, idempotência e auditoria.
- `executar_sql` permanece desativado.
- Cada task termina com teste correspondente; usar `npx tsc -p tsconfig.app.json --noEmit`, não `npx tsc --noEmit`.

## Escopo de arquivos

- `supabase/migrations/`: contexto de agente, view/RPCs tenant-safe, idempotência, versão e auditoria.
- `supabase/functions/api/index.ts`: autenticação, escopo, validação, paginação e chamadas transacionais.
- `supabase/functions/_shared/`: autenticação/headers/validação compartilhados.
- `mcp/src/index.ts`: wrapper HTTP/transport e ferramentas allowlisted; remover handlers mortos.
- `src/test/api/`: contratos HTTP por API key e isolamento entre tenants.
- `src/test/rls/`: provar que contexto de agente não atravessa tenants.
- `docs/proposta-mcp-fases.md`: atualizar diagnóstico e fases após aprovação técnica.

### Task 1: Fixar diagnóstico e contrato de segurança

**Files:**
- Modify: `docs/proposta-mcp-fases.md`
- Reference: `docs/reviews/2026-08-26-mcp-fases/review_panel_report.md`

- [ ] Atualizar status para “REVISE — não implementar antes da Fase 0”.
- [ ] Corrigir P8: dispatcher MCP está desativado; handlers são código não exercitado.
- [ ] Remover afirmação de que a fronteira atual está no banco quando API usa service role.
- [ ] Mover P5, P8 e P10 para pré-requisitos antes de qualquer escrita.
- [ ] Substituir “ferramentas existentes” por “superfície a reimplementar/testar”.
- [ ] Registrar prompt injection, valores monetários, baixa não idempotente e view sem tenant como riscos adicionais.
- [ ] Verificar referências e garantir que nenhuma promessa de atomicidade via HTTP permaneça sem RPC transacional.

### Task 2: Escolher e provar contexto de tenant no banco

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_agent_context.sql`
- Create: `src/test/rls/agente-contexto.test.ts`

- [ ] Escrever teste com dois tenants: contexto A lê somente A; contexto B lê somente B; contexto ausente falha fechado.
- [ ] Definir mecanismo único: papel não-service-role com JWT/contexto confiável, ou RPCs SECURITY DEFINER que recebam contexto validado e filtrem internamente.
- [ ] Implementar `SET search_path = public`, revogar execução pública e documentar como contexto chega ao banco.
- [ ] Não aceitar `tenant_id` arbitrário do payload como autorização.
- [ ] Rodar reset local e suíte RLS; registrar resultado.

### Task 3: Tornar leitura principal tenant-safe

**Files:**
- Modify/Create: migration versionada para `lancamentos_bi`
- Modify: `supabase/functions/api/index.ts`
- Create: `src/test/api/lancamentos-contract.test.ts`

- [ ] Redefinir view com `tenant_id` explícito e grants mínimos, ou retirar view do contrato.
- [ ] Implementar paginação por cursor/limite máximo; resposta deve informar cursor e total apenas quando calculado com segurança.
- [ ] Corrigir `get_bancos_com_saldos` para parâmetros `_tenant`, `_data_inicio`, `_data_fim` e comportamento correto no contexto de agente.
- [ ] Criar contrato HTTP com chave A/B e provar que listagem, bancos, categorias e resumo não cruzam tenant.
- [ ] Fazer resumo via RPC agregadora filtrada no banco; não carregar histórico inteiro em JavaScript.

### Task 4: Fechar escrita financeira perigosa

**Files:**
- Modify: `supabase/functions/api/index.ts`
- Create: `supabase/functions/_shared/finance-validation.ts`
- Create: `src/test/api/writes-contract.test.ts`

- [ ] Allowlist explícita para PUT; rejeitar status, vínculos e campos derivados fora de endpoints próprios.
- [ ] Validar dinheiro como decimal positivo e limites de parcelas/recorrência.
- [ ] Remover DELETE em cascata por query param; usar operação explícita com confirmação e soft-delete/escopo definido.
- [ ] Fazer baixa com transação, lock/version check e tratamento de falha na criação da próxima recorrência.
- [ ] Garantir transferência em uma única RPC transacional.
- [ ] Testar concorrência, retry, payload malformado, valores negativos e transferência parcial.

### Task 5: Implementar idempotência, versão e auditoria de ator

**Files:**
- Create: migration versionada para `idempotency_keys` e `lancamentos.version`
- Modify: `supabase/functions/api/index.ts`
- Modify: `supabase/migrations/20260825000800_audit_log.sql`
- Create: `src/test/api/idempotency.test.ts`

- [ ] Criar chave única por tenant/operação e armazenar resposta canônica.
- [ ] Reservar chave atomicamente antes do efeito; retry deve devolver mesmo resultado sem duplicar.
- [ ] Exigir `expected_version` em updates sensíveis e incrementar versão dentro da transação.
- [ ] Auditar ator como API key identificada/hash prefixado e operação; nunca registrar segredo.
- [ ] Testar resposta perdida simulada, retry concorrente e conflito de versão.

### Task 6: Escopo e rate limit de API keys

**Files:**
- Create: migration versionada para `api_keys.scope`, `expires_at` e contador atômico
- Modify: `src/hooks/useApiKeys.ts`
- Modify: `src/pages/ApiKeys.tsx`
- Modify: `supabase/functions/api/index.ts`
- Create: `src/test/api/auth-contract.test.ts`

- [ ] Separar `read`, `write` e operações destrutivas.
- [ ] Rejeitar chave expirada/inativa antes de qualquer consulta de dados.
- [ ] Implementar limite atômico por chave/tenant, não contador posterior sujeito a corrida.
- [ ] Nunca aceitar tenant do header/payload como substituto do tenant da chave.
- [ ] Testar escopo, expiração, revogação, concorrência e ausência de chave.

### Task 7: MCP HTTP read-only inicial

**Files:**
- Modify: `mcp/src/index.ts`
- Create/Modify: `mcp/src/auth.ts`, se necessário
- Create: `mcp/src/tools/read-only.ts`
- Create: `mcp/src/test/`

- [ ] Remover dispatcher morto e não anunciar ferramenta não executável.
- [ ] Expor somente leitura allowlisted após Tasks 2–6.
- [ ] Não reutilizar `consultar_lancamentos_bi` sem view tenant-safe.
- [ ] Retornar erros sem SQL, chaves ou detalhes internos.
- [ ] Executar testes de contrato e isolamento antes de habilitar qualquer escrita.

### Task 8: Escrita MCP controlada

**Files:**
- Create: `mcp/src/tools/write.ts`
- Modify: `mcp/src/index.ts`
- Create: `mcp/src/test/write-tools.test.ts`

- [ ] Exigir API key com escopo write e `idempotency_key`.
- [ ] Exigir confirmação explícita para baixa, transferência e exclusão.
- [ ] Tratar texto de usuário como dado não confiável; nenhuma observação pode virar instrução de controle.
- [ ] Expor somente RPCs/rotas já cobertas pelas Tasks 4–6.
- [ ] Manter lotes fora até existirem RPCs transacionais e limites de tamanho.

### Task 9: Verificação final local

- [ ] `npx supabase db reset`
- [ ] `npm run test:rls`
- [ ] `npm run test:unit`
- [ ] testes de contrato HTTP/API/MCP
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] teste manual com dois tenants e chaves de escopos diferentes
- [ ] revisão final da proposta e do relatório

### Task 10: Aprovação e promoção

- [ ] Apresentar diff, testes e riscos ao usuário.
- [ ] Obter validação explícita para migrations de RLS/roles.
- [ ] Fazer backup de produção antes de qualquer promoção.
- [ ] Executar dry-run de migrations e functions.
- [ ] Promover em janela combinada; nunca misturar migrations antigas não registradas sem reconciliação do histórico.

## Gaps assumidos

- Conciliação bancária, OFX/CSV, OCR, anexos e webhooks ficam fora deste plano.
- A decisão entre contexto RLS dedicado e RPCs transacionais precisa ser tomada antes da Task 2.
- Nenhuma conclusão sobre deploy/volume de produção foi inferida sem observação direta.
