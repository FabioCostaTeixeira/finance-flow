# Validação de Alterações — Plano MCP Finance Flow

**Documento comparado:** Downloads/mcp-finance-flow-prompt-expansao-plano.md  
**Base preservada:** docs/superpowers/plans/2026-08-26-mcp-seguro-v2.md  
**Resultado:** aprovado com incorporação no plano v3.

## Requisitos de segurança preservados

| Requisito do v2 | Preservado em |
|---|---|
| tenant derivado da chave, nunca payload | Security Invariants; Tasks 2, 3, 8, 15, 16 |
| RLS/RPC tenant-safe | Tasks 2, 7–14; Security Invariants |
| service role não como fronteira | Architecture; Tasks 2, 15, 16 |
| API keys com escopo/expiração/revogação | Task 3; Scope Matrix |
| rate limit atômico | Task 3 |
| idempotência real e retry seguro | Task 6 e todas as escritas |
| versionamento otimista | Task 6; operações sensíveis |
| auditoria com ator e redaction | Task 6; Task 14; ferramentas de auditoria |
| validação monetária decimal | Task 5 |
| allowlist de campos/ferramentas | Tasks 1, 5, 8, 15, 16 |
| testes entre tenants | Tasks 2, 3, 7–17 |
| sem SQL arbitrário | Global Constraints; Tasks 1, 14–16 |
| paginação determinística | Task 5 e ferramentas de leitura |
| prompt injection como risco | Security Invariants; Task 16 |
| promoção segura por migrations | Migration Strategy; Task 18 |
| sem produção antes de aprovação | Global Constraints; Task 18 |

## Capacidades adicionadas pelo cliente

| Pedido | Cobertura |
|---|---|
| catálogo versionado de ferramentas | Task 1; docs/mcp/tool-contracts.md |
| health/capabilities/schema/context/version | Task 4 |
| modelo monetário explícito | Task 5 |
| pagamentos/recebimentos integrais e parciais | Task 7 |
| correção/estorno de baixas | Task 7 |
| lançamentos completos | Task 8 |
| transferências vinculadas/estornáveis | Task 9 |
| recorrências/parcelamentos completos | Task 10 |
| anexos/comprovantes | Task 11 |
| OCR | deliberadamente fora; nenhum OCR novo |
| relatórios completos | Task 12 |
| cadastros administrativos | Task 13 |
| dry-run/confirmação vinculada | Task 14 |
| operações em lote | Task 14 |
| erros estáveis | Task 5; Stable Error Codes |
| filtros/paginação | Task 5 |
| observabilidade segura | Task 5 |
| auditoria interna consultável | Tasks 1, 6, 15; ferramentas de auditoria |
| testes completos | Task 17 e critérios de cada task |
| deploy/rollback | Task 18 e seções finais |

## Itens que permaneceram fora

Não foram transformados em task, tabela, endpoint, ferramenta ou preparação futura:

- conciliação bancária;
- OFX;
- CSV bancário;
- Open Finance;
- matching automático;
- webhooks;
- notificações;
- administração de webhooks;
- cron da Mary;
- eventos externos em tempo real;
- OCR novo.

## Ajustes de interpretação

1. “Anexos e comprovantes” entram no escopo; “OCR” não entra.
2. “Auditoria” significa trilha interna consultável; não significa evento externo.
3. “Lote” só aparece depois de RPCs transacionais, limites, idempotência e confirmação.
4. A lista de ferramentas é catálogo de contrato, não afirmação de que handlers atuais já funcionam.
5. Cliente/credor ficou como decisão pendente porque o repositório ainda precisa provar se há entidade própria.
6. Contexto RLS versus RPC SECURITY DEFINER ficou como decisão pendente, com recomendação e bloqueio explícitos.

## Conclusão

Nenhum requisito de segurança do plano v2 foi removido. O plano v3 amplia cobertura funcional conforme pedido, mantém as travas anteriores e formaliza as exclusões deliberadas.
