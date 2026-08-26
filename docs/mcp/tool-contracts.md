# Contratos MCP/HTTP v1

Status: catálogo de planejamento. Nenhuma ferramenta deste documento está publicada em MCP hoje.

Fonte executável: `mcp/src/contracts/tools.ts` (`MCP_TOOL_CONTRACT_VERSION = 1.1.0`). Cada uma das 79 entradas tem JSON Schema canônico: tipo, formato (`uuid`, `date`, `date-time`, `decimal`, `sha256`), enum, regex decimal, limites de texto/número/array (`minItems`/`maxItems`), `required` e `additionalProperties: false`; sucesso e erro também são schemas estruturados. Cada entrada inclui exemplos concretos de entrada e saída, validados contra o schema. `tools/list` só pode usar `PUBLIC_MCP_TOOL_DEFINITIONS`, que converte esse schema em `inputSchema`; não existe schema vazio/de fachada.

## Validação Task 1 — 2026-08-26

- Contratos reforçados: `get_schema` publica `properties`, `required`, formatos e limites; cadastros e anexos exigem campos de concorrência corretos; lote exige pelo menos um item, simulação vinculada, versão e idempotência por item.
- Teste focado: `mcp/src/contracts/tools.test.ts`, 10/10 aprovados.
- `cd mcp && npx tsc --noEmit`: permanecem somente cinco casts preexistentes em `src/index.ts` (linhas 550, 577, 732, 792 e 834). Não há erro novo de contratos, testes ou dispatcher.

Uma ferramenta entra em `tools/list` somente com `status: connected` e handler real em `CONNECTED_MCP_HANDLERS`. Esse registro aceita apenas funções `McpToolHandler`, jamais booleanos/marcadores, e `tools/call` consulta o mesmo registro antes de despachar. O catálogo atual mantém todas como `planned`, logo a lista pública é vazia até haver contexto autenticado, handler e teste.

## Contrato comum HTTP e MCP

Cada ferramenta usa `POST /mcp/v1/tools/{nome}` quando implementada. Todas exigem `X-API-Key` e `X-Request-Id`; toda escrita também exige `Idempotency-Key`. A chave resolve tenant, ator e escopos. `tenant_id`, ator e escopos nunca são aceitos no corpo. Sucesso: `{ request_id, data }`. Falha: `{ request_id, error: { code, message } }`, com código estável; nunca inclui SQL, stack, nomes internos, segredos ou dados de outro tenant. MCP preserva mesma semântica em `tools/call`.

Leituras usam cursor opaco estável (`cursor`, `limit`, máximo 100 quando paginadas), e retornam `next_cursor` quando houver mais dados (string vazia significa fim). Escritas idempotentes expõem `dry_run`; mutações de recurso existente também exigem `expected_version`; operações que consomem confirmação exigem `confirmation_token`. `preparar_operacao` produz o token e não o recebe. Discovery, consultas e `simular_lote` são leituras e não recebem controles de escrita. Cada resposta define `request_id`, efeitos e retry. Valores monetários são strings/decimal canônico, nunca `number` JavaScript para cálculo financeiro.

## Catálogo completo v1 (planejado, não público)

| Grupo | Ferramentas |
|---|---|
| Discovery | `health_check`, `get_capabilities`, `get_schema`, `get_current_context`, `get_api_version` |
| Lançamentos | `listar_lancamentos`, `obter_lancamento`, `verificar_duplicidade`, `criar_lancamento`, `atualizar_lancamento`, `cancelar_lancamento`, `excluir_lancamento`, `restaurar_lancamento` |
| Pagamentos | `baixar_lancamento`, `registrar_pagamento_parcial`, `registrar_recebimento_parcial`, `listar_movimentos_lancamento`, `obter_movimento_pagamento`, `corrigir_movimento_pagamento`, `estornar_movimento_pagamento`, `estornar_baixa` |
| Transferências | `criar_transferencia`, `obter_transferencia`, `listar_transferencias`, `estornar_transferencia` |
| Recorrências | `criar_recorrencia`, `listar_recorrencias`, `obter_recorrencia`, `atualizar_recorrencia`, `pausar_recorrencia`, `retomar_recorrencia`, `cancelar_recorrencia`, `gerar_proximas_parcelas`, `gerar_parcela_ausente`, `alterar_somente_esta_parcela`, `alterar_esta_e_as_futuras`, `excluir_somente_esta_parcela`, `excluir_esta_e_as_futuras` |
| Anexos | `iniciar_upload_comprovante`, `finalizar_upload_comprovante`, `associar_comprovante_lancamento`, `listar_comprovantes_lancamento`, `obter_metadados_comprovante`, `obter_url_temporaria_comprovante`, `buscar_comprovante_por_hash`, `remover_associacao_comprovante` |
| Relatórios | `consultar_saldo_realizado`, `consultar_saldo_acumulado`, `consultar_saldo_projetado`, `relatorio_fluxo_caixa`, `relatorio_contas_pagar`, `relatorio_contas_receber`, `relatorio_atrasados`, `relatorio_por_categoria`, `relatorio_por_banco`, `relatorio_por_cliente_credor`, `comparar_periodos`, `projetar_fluxo_caixa`, `relatorio_kpis` |
| Cadastros | `criar_banco`, `atualizar_banco`, `arquivar_banco`, `reativar_banco`, `criar_categoria`, `atualizar_categoria`, `mover_categoria`, `arquivar_categoria`, `reativar_categoria`, `criar_cliente_credor`, `atualizar_cliente_credor`, `arquivar_cliente_credor`, `mesclar_clientes_credores` |
| Lotes | `simular_lote`, `executar_lote`, `obter_resultado_lote`, `preparar_operacao`, `confirmar_operacao` |
| Auditoria interna | `listar_eventos_auditoria`, `obter_evento_auditoria` |

Escopos mínimos: discovery requer somente chave válida; leitura `finance:read`; criar `finance:create`; atualizar `finance:update`; pagar/receber `finance:pay`; transferir `finance:transfer`; cancelar/excluir/restaurar `finance:delete`; anexos `finance:attachments`; auditoria `finance:audit`; cadastros `admin:cadastros`.

`executar_sql` é exclusão deliberada: continua desativada e não é contrato funcional. Auditoria é interna, append-only, redigida e consultável; não é entrega externa.

## Matrizes de comportamento

| Tipo | Idempotência | Versão | Confirmação | Dry-run | Efeito | Retry |
|---|---|---|---|---|---|---|
| Discovery/leitura | não aplicável | não aplicável | não aplicável | não aplicável | nenhum | seguro; cursor mantém ordem |
| Escrita financeira/cadastro | obrigatória | obrigatória | obrigatória | disponível | RPC transacional, auditoria append-only | mesma chave retorna resposta canônica |
| Lote | obrigatória por lote/itens | obrigatória nos alvos | token de uso único | obrigatório antes de executar | atômico ou estado recuperável explícito | mesma chave/tokens não duplicam efeito |
| Anexo | obrigatória no upload/vínculo | quando altera vínculo | obrigatória para remoção | disponível onde não persiste | storage privado, hash e auditoria | mesmo hash/chave não duplica arquivo |

## Decisões pendentes

| Decisão | Opções | Recomendação | Impacto/bloqueio |
|---|---|---|---|
| Contexto de tenant | RLS com contexto dedicado; filtros manuais service role | RLS/contexto ou RPC tenant-safe; não chamar filtro manual de fronteira | Bloqueia qualquer rota MCP pública e Task 2 |
| View `lancamentos_bi` | recriar com `tenant_id`; retirar do contrato | recriar e manter filtro; até lá não expor | Bloqueia listagem/relatórios que dependem da view |
| RPC de saldos | adaptar a contexto de chave; novo RPC tenant-safe | separar caminho authenticated/API key e testar | Bloqueia consulta de saldos por chave |
| Escritas antigas | reaproveitar handlers stdio; substituir por RPCs | substituir por operações transacionais | Bloqueia Tasks 7–16 |
| Retenção | 30/90/180 dias para chave e auditoria; política legal | decidir com responsável financeiro/jurídico antes de schema | Bloqueia migration de idempotência/auditoria |
| Dry-run | estimativa; snapshot/versionado | só confirmação vinculada a hash+versões; senão rotular estimativa | Bloqueia lotes e escrita sensível |

## Fora de escopo deliberado

Não há ferramenta, endpoint, tabela ou preparação futura para conciliação bancária, importação OFX/CSV bancário, Open Finance, matching de extrato, webhook, notificações/eventos externos, cron de auditoria ou OCR novo. Anexos/comprovantes privados estão no escopo; não incluem OCR.
