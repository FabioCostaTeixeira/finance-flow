# Proposta MCP faseada — corrigida após review de segurança

**Status:** revise antes de qualquer exposição. Esta proposta não autoriza produção, migrations, mudança de RLS, roles ou permissões.

## Diagnóstico verificado

O servidor MCP stdio contém 20 definições históricas, mas seu dispatcher retorna erro antes do `switch`: elas não são ferramentas funcionais. Os handlers legados usam `service_role` sem contexto confiável de tenant e não são promovíveis. A partir desta revisão, `tools/list` usa o catálogo versionado e anuncia zero ferramentas até existir handler conectado e teste.

A edge function HTTP também não constitui fronteira de tenant: ela usa `service_role`, que ignora RLS, e depende de filtros manuais. A view `lancamentos_bi` não tem `tenant_id`, enquanto `GET /lancamentos` tenta filtrar por ela; hoje isso deve falhar, e remover o filtro seria risco cross-tenant. `get_bancos_com_saldos` chama `can_access`, que depende de `auth.uid()` e pode retornar vazio no caminho de API key/service role. Os parâmetros do RPC também não coincidem com a assinatura `_data_inicio`/`_data_fim`.

Não há idempotência implementada, `expected_version`, escopo/expiração por API key, rate limit atômico, contrato HTTP multi-tenant, nem atribuição de chave/ator confiável na auditoria. DELETE de recorrência é destrutivo. Texto em `observacao` e `cliente_credor` é dado não confiável: pode conter prompt injection e nunca pode instruir o agente ou autorizar escrita.

## Fronteira proposta

Tenant, ator e escopos vêm exclusivamente da API key. O caminho público usa contexto compatível com RLS ou RPCs `SECURITY DEFINER` tenant-safe com `search_path` fixado; `service_role` só permanece em funções administrativas internas. Cada escrita passa por RPC transacional, decimal canônico, idempotência persistida, versão otimista, confirmação vinculada ao payload e auditoria append-only com ator/chave/request ID. Agente trata texto de usuário como conteúdo, separa-o das instruções e mostra operação proposta para confirmação humana.

O contrato v1 está em `docs/mcp/tool-contracts.md` e `mcp/src/contracts/tools.ts`. Ele lista discovery, auditoria interna e anexos privados explicitamente. Não há SQL arbitrário funcional.

## Fases revisadas

1. **Fundação e contrato:** catálogo versionado, decisão de tenant, correção/remoção da view insegura, RPC de saldos, validação financeira, auditoria de ator, idempotência/versão, DELETE protegido, escopos/expiração/rate limit atômico e testes HTTP de dois tenants. Sem MCP público.
2. **Leitura controlada:** discovery e allowlist pequena paginada, somente depois de view/RPC tenant-safe e erros estáveis.
3. **Escrita controlada:** operações idempotentes, confirmação, versão e auditoria; nenhuma escrita baseada em handlers stdio legados.
4. **Recursos transacionais:** pagamentos, transferências, recorrências e lotes somente via RPCs atômicos ou com recuperação persistida explícita.
5. **Anexos privados e relatórios:** storage privado, hash e URLs temporárias; agregações no banco.

## Decisões que exigem validação

- escolher isolamento por contexto RLS/RPC versus filtros manuais temporários; a segunda opção não será descrita como fronteira de banco;
- escolher retenção de idempotência, auditoria e arquivos;
- definir se dry-run usa snapshot/versionamento ou é somente estimativa não vinculante;
- aprovar migrations separadamente, com backup e validação local.

## Não objetivos

Conciliação bancária, OFX/CSV bancário, Open Finance, matching de extrato, webhooks, notificações externas e OCR novo são excluídos deliberadamente. Auditoria interna não é webhook.
