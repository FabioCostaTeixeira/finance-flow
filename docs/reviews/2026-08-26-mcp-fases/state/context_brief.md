# Context Brief — Review Panel: Proposta MCP Faseada

## Trabalho sob revisão
`docs/proposta-mcp-fases.md` — proposta de arquitetura para expor o Finance Flow
(app financeiro multi-tenant) a agentes de IA via MCP, em 4 fases.

**Pergunta central do usuário:** a arquitetura é **segura e escalável para produção**?

## Modo de revisão
**Mixed** — a proposta é prosa (modo Exhaustive), mas TODAS as alegações sobre
o código atual (seção 2, P1–P10) são verificáveis e devem ser tratadas em modo
**Precise**: cite arquivo:linha ou a alegação é rebaixada a [UNVERIFIED].

## Estado do codebase
- Branch: `main`, 0 commits atrás do remoto. Sem worktree. Sem aviso [STALE_BRANCH].
- Migrations aplicadas em produção (16). Testes: 31/31 RLS, 35/35 unit.

## Arquivos-chave (leia diretamente)
| Arquivo | Papel |
|---|---|
| `supabase/functions/api/index.ts` (530 ln) | Edge function HTTP, auth por API key SHA-256 → tenant_id |
| `mcp/src/index.ts` (885 ln) | Servidor MCP stdio, 20 ferramentas, service role, SEM tenant |
| `supabase/migrations/20260825000800_audit_log.sql` | Tabela audit_log + trigger (usa `auth.uid()`) |
| `supabase/migrations/20260826000500_fix_get_bancos_com_saldos_transferencia.sql` | Assinatura real do RPC `get_bancos_com_saldos` |
| `CLAUDE.md` | Regras do projeto |

## Documentação do sistema encontrada
- `CLAUDE.md` declara: **"Regra crítica: qualquer alteração em lógica de permissões,
  RLS do Supabase ou roles deve ser validada com o usuário antes de implementar."**
- `CLAUDE.md` declara: MCP externo é o **único** caminho de acesso de IA a dados
  financeiros. Telegram e chat de IA interno foram removidos.
- `CLAUDE.md`: "Não entregar uma feature sem escrever os testes correspondentes."
- Domínio em português (`lancamentos`, `bancos`, `categorias`).

## Mecanismos de segurança já descobertos (NÃO reportar como ausentes sem verificar)
- `executar_sql` **já está desativado** — `handleExecutarSQL` (mcp/src/index.ts:499)
  retorna erro. SQL arbitrário NÃO está aberto hoje.
- `referenciasDoTenant()` (api/index.ts:34) valida que banco_id/categoria_id
  pertencem ao tenant antes de insert/update.
- `semTenantDoPayload()` (api/index.ts:30) remove `tenant_id` do payload.
- RLS ativo em `audit_log` com `can_access(tenant_id,'usuarios')`.
- Transferências validam que ambos os bancos são do tenant (api/index.ts:329).

## Enum relevante
`status_lancamento`: `a_receber | recebido | a_pagar | pago | parcial | atrasado | vencida | transferencia`

## Live-State Claim Discipline
Nenhum agente tem acesso à infra de produção. Toda alegação sobre estado vivo
(o que está deployado, qual API key existe, se a function está publicada) é
`[STATIC-INFERENCE]` e **limitada a P1**. Só código-fonte é observável.
Linhas dentro de `echo`/comentários/README são documentação, não configuração.

## Lacunas de contexto
- Não sabemos o volume real de dados por tenant (relevante para P1/P2 — paginação).
- Não sabemos quantas API keys existem nem quem as consome hoje.
- Não há evidência de teste de carga.
