/**
 * Fonte de verdade do catálogo MCP v1.
 *
 * `status: "planned"` documenta contrato futuro, mas nunca publica ferramenta.
 * Só ferramenta `connected`, com handler exportado e teste, entra em tools/list.
 */
export type ToolMode = "read" | "write";
export type ToolStatus = "planned" | "connected" | "disabled";

export interface McpToolContract {
  name: string;
  group: string;
  summary: string;
  mode: ToolMode;
  status: ToolStatus;
  scopes: readonly string[];
  input: { required: readonly string[]; properties: readonly string[]; enums: Record<string, readonly string[]> };
  output: { success: readonly string[]; error: readonly string[] };
  limits: { maxPageSize: number | null; maxBatchItems: number | null };
  pagination: "cursor" | "none";
  idempotency: "not-applicable" | "required";
  expectedVersion: "not-applicable" | "required";
  confirmation: "not-applicable" | "required";
  dryRun: "not-applicable" | "available";
  effects: readonly string[];
  retry: string;
  http: { method: "POST"; route: string; requiredHeaders: readonly string[] };
  examples: readonly string[];
  tests: readonly string[];
}

type Seed = Pick<McpToolContract, "name" | "group" | "summary" | "mode" | "scopes"> & {
  input?: readonly string[];
  required?: readonly string[];
  enums?: Record<string, readonly string[]>;
  pagination?: "cursor" | "none";
  maxBatchItems?: number | null;
};

const read = (name: string, group: string, summary: string, scopes: readonly string[] = ["finance:read"], input: readonly string[] = ["cursor", "limit"], pagination: "cursor" | "none" = "cursor"): Seed => ({ name, group, summary, mode: "read", scopes, input, pagination });
const write = (name: string, group: string, summary: string, scopes: readonly string[], input: readonly string[] = ["id"], required: readonly string[] = ["id"], enums: Record<string, readonly string[]> = {}, maxBatchItems: number | null = null): Seed => ({ name, group, summary, mode: "write", scopes, input, required, enums, pagination: "none", maxBatchItems });

const seeds: readonly Seed[] = [
  read("health_check", "discovery", "Disponibilidade do serviço e dependências.", [], [], "none"),
  read("get_capabilities", "discovery", "Versão do catálogo e ferramentas publicadas.", [], [], "none"),
  read("get_schema", "discovery", "Schema público permitido, sem nomes internos.", [], [], "none"),
  read("get_current_context", "discovery", "Tenant, ator e escopos resolvidos pela chave.", [], [], "none"),
  read("get_api_version", "discovery", "Versão HTTP/MCP compatível.", [], [], "none"),

  read("listar_lancamentos", "lancamentos", "Lista lançamentos por cursor."),
  read("obter_lancamento", "lancamentos", "Obtém lançamento por id.", ["finance:read"], ["id"], "none"),
  read("verificar_duplicidade", "lancamentos", "Procura possível duplicidade sem mutar dados.", ["finance:read"], ["tipo", "valor", "data_vencimento", "cliente_credor"], "none"),
  write("criar_lancamento", "lancamentos", "Cria lançamento financeiro.", ["finance:create"], ["tipo", "cliente_credor", "valor", "data_vencimento", "banco_id", "categoria_id"], ["tipo", "cliente_credor", "valor", "data_vencimento"], { tipo: ["receita", "despesa"] }),
  write("atualizar_lancamento", "lancamentos", "Atualiza campos permitidos de lançamento.", ["finance:update"], ["id", "expected_version", "patch"], ["id", "expected_version", "patch"]),
  write("cancelar_lancamento", "lancamentos", "Cancela sem apagar evidência.", ["finance:delete"], ["id", "expected_version", "motivo"], ["id", "expected_version", "motivo"]),
  write("excluir_lancamento", "lancamentos", "Exclusão lógica protegida; nunca hard delete de evidência.", ["finance:delete"], ["id", "expected_version", "motivo"], ["id", "expected_version", "motivo"]),
  write("restaurar_lancamento", "lancamentos", "Restaura lançamento excluído logicamente.", ["finance:delete"], ["id", "expected_version"], ["id", "expected_version"]),

  write("baixar_lancamento", "pagamentos", "Registra baixa total.", ["finance:pay"], ["id", "expected_version", "valor", "data"], ["id", "expected_version", "valor", "data"]),
  write("registrar_pagamento_parcial", "pagamentos", "Registra pagamento parcial.", ["finance:pay"], ["id", "expected_version", "valor", "data"], ["id", "expected_version", "valor", "data"]),
  write("registrar_recebimento_parcial", "pagamentos", "Registra recebimento parcial.", ["finance:pay"], ["id", "expected_version", "valor", "data"], ["id", "expected_version", "valor", "data"]),
  read("listar_movimentos_lancamento", "pagamentos", "Lista movimentos de pagamento por lançamento.", ["finance:read"], ["lancamento_id", "cursor", "limit"]),
  read("obter_movimento_pagamento", "pagamentos", "Obtém movimento de pagamento.", ["finance:read"], ["id"], "none"),
  write("corrigir_movimento_pagamento", "pagamentos", "Corrige movimento preservando trilha.", ["finance:pay"], ["id", "expected_version", "patch"], ["id", "expected_version", "patch"]),
  write("estornar_movimento_pagamento", "pagamentos", "Estorna movimento de pagamento.", ["finance:pay"], ["id", "expected_version", "motivo"], ["id", "expected_version", "motivo"]),
  write("estornar_baixa", "pagamentos", "Estorna baixa integral vinculada.", ["finance:pay"], ["lancamento_id", "expected_version", "motivo"], ["lancamento_id", "expected_version", "motivo"]),

  write("criar_transferencia", "transferencias", "Cria duas pernas atômicas.", ["finance:transfer"], ["banco_origem_id", "banco_destino_id", "valor", "data"], ["banco_origem_id", "banco_destino_id", "valor", "data"]),
  read("obter_transferencia", "transferencias", "Obtém transferência e pernas vinculadas.", ["finance:read"], ["id"], "none"),
  read("listar_transferencias", "transferencias", "Lista transferências por cursor."),
  write("estornar_transferencia", "transferencias", "Estorna as duas pernas atomicamente.", ["finance:transfer"], ["id", "expected_version", "motivo"], ["id", "expected_version", "motivo"]),

  write("criar_recorrencia", "recorrencias", "Cria série de recorrência.", ["finance:create"], ["template", "frequencia", "inicio"], ["template", "frequencia", "inicio"], { frequencia: ["mensal", "semanal", "anual"] }),
  read("listar_recorrencias", "recorrencias", "Lista séries por cursor."),
  read("obter_recorrencia", "recorrencias", "Obtém série e estado.", ["finance:read"], ["id"], "none"),
  write("atualizar_recorrencia", "recorrencias", "Atualiza série a partir da versão esperada.", ["finance:update"], ["id", "expected_version", "patch"], ["id", "expected_version", "patch"]),
  write("pausar_recorrencia", "recorrencias", "Pausa geração de novas parcelas.", ["finance:update"], ["id", "expected_version"], ["id", "expected_version"]),
  write("retomar_recorrencia", "recorrencias", "Retoma geração de parcelas.", ["finance:update"], ["id", "expected_version"], ["id", "expected_version"]),
  write("cancelar_recorrencia", "recorrencias", "Cancela série sem apagar histórico.", ["finance:delete"], ["id", "expected_version", "motivo"], ["id", "expected_version", "motivo"]),
  write("gerar_proximas_parcelas", "recorrencias", "Gera parcelas idempotentemente.", ["finance:create"], ["recorrencia_id", "ate"], ["recorrencia_id", "ate"]),
  write("gerar_parcela_ausente", "recorrencias", "Gera parcela específica ausente.", ["finance:create"], ["recorrencia_id", "competencia"], ["recorrencia_id", "competencia"]),
  write("alterar_somente_esta_parcela", "recorrencias", "Altera uma parcela.", ["finance:update"], ["id", "expected_version", "patch"], ["id", "expected_version", "patch"]),
  write("alterar_esta_e_as_futuras", "recorrencias", "Altera parcela atual e futuras.", ["finance:update"], ["id", "expected_version", "patch"], ["id", "expected_version", "patch"]),
  write("excluir_somente_esta_parcela", "recorrencias", "Exclui logicamente uma parcela.", ["finance:delete"], ["id", "expected_version", "motivo"], ["id", "expected_version", "motivo"]),
  write("excluir_esta_e_as_futuras", "recorrencias", "Exclui logicamente parcela e futuras.", ["finance:delete"], ["id", "expected_version", "motivo"], ["id", "expected_version", "motivo"]),

  write("iniciar_upload_comprovante", "anexos", "Inicia upload privado com metadados e hash esperado.", ["finance:attachments"], ["nome", "content_type", "size", "sha256"], ["nome", "content_type", "size", "sha256"]),
  write("finalizar_upload_comprovante", "anexos", "Confirma objeto enviado e hash.", ["finance:attachments"], ["upload_id", "sha256"], ["upload_id", "sha256"]),
  write("associar_comprovante_lancamento", "anexos", "Associa comprovante a lançamento.", ["finance:attachments"], ["comprovante_id", "lancamento_id"], ["comprovante_id", "lancamento_id"]),
  read("listar_comprovantes_lancamento", "anexos", "Lista metadados de comprovantes.", ["finance:attachments"], ["lancamento_id", "cursor", "limit"]),
  read("obter_metadados_comprovante", "anexos", "Obtém metadados, nunca URL permanente.", ["finance:attachments"], ["id"], "none"),
  read("obter_url_temporaria_comprovante", "anexos", "Emite URL temporária privada.", ["finance:attachments"], ["id"], "none"),
  read("buscar_comprovante_por_hash", "anexos", "Busca hash dentro do tenant.", ["finance:attachments"], ["sha256"], "none"),
  write("remover_associacao_comprovante", "anexos", "Remove vínculo, sem apagar objeto sem política explícita.", ["finance:attachments"], ["comprovante_id", "lancamento_id"], ["comprovante_id", "lancamento_id"]),

  read("consultar_saldo_realizado", "relatorios", "Saldo por valores liquidados."),
  read("consultar_saldo_acumulado", "relatorios", "Saldo acumulado por período."),
  read("consultar_saldo_projetado", "relatorios", "Saldo incluindo projeções."),
  read("relatorio_fluxo_caixa", "relatorios", "Fluxo de caixa agregado no banco."),
  read("relatorio_contas_pagar", "relatorios", "Contas a pagar por cursor."),
  read("relatorio_contas_receber", "relatorios", "Contas a receber por cursor."),
  read("relatorio_atrasados", "relatorios", "Itens vencidos por cursor."),
  read("relatorio_por_categoria", "relatorios", "Agregado por categoria."),
  read("relatorio_por_banco", "relatorios", "Agregado por banco."),
  read("relatorio_por_cliente_credor", "relatorios", "Agregado por cliente/credor."),
  read("comparar_periodos", "relatorios", "Comparativo entre períodos.", ["finance:read"], ["periodo_a", "periodo_b"], "none"),
  read("projetar_fluxo_caixa", "relatorios", "Projeção declarada; método informado.", ["finance:read"], ["horizonte"], "none"),
  read("relatorio_kpis", "relatorios", "KPIs financeiros.", ["finance:read"], ["periodo"], "none"),

  write("criar_banco", "cadastros", "Cria banco.", ["admin:cadastros"], ["nome"], ["nome"]),
  write("atualizar_banco", "cadastros", "Atualiza banco.", ["admin:cadastros"], ["id", "expected_version", "patch"], ["id", "expected_version", "patch"]),
  write("arquivar_banco", "cadastros", "Arquiva banco sem apagar histórico.", ["admin:cadastros"], ["id", "expected_version"], ["id", "expected_version"]),
  write("reativar_banco", "cadastros", "Reativa banco arquivado.", ["admin:cadastros"], ["id", "expected_version"], ["id", "expected_version"]),
  write("criar_categoria", "cadastros", "Cria categoria.", ["admin:cadastros"], ["nome", "tipo"], ["nome", "tipo"], { tipo: ["receita", "despesa"] }),
  write("atualizar_categoria", "cadastros", "Atualiza categoria.", ["admin:cadastros"], ["id", "expected_version", "patch"], ["id", "expected_version", "patch"]),
  write("mover_categoria", "cadastros", "Move categoria na hierarquia.", ["admin:cadastros"], ["id", "expected_version", "categoria_pai_id"], ["id", "expected_version", "categoria_pai_id"]),
  write("arquivar_categoria", "cadastros", "Arquiva categoria.", ["admin:cadastros"], ["id", "expected_version"], ["id", "expected_version"]),
  write("reativar_categoria", "cadastros", "Reativa categoria.", ["admin:cadastros"], ["id", "expected_version"], ["id", "expected_version"]),
  write("criar_cliente_credor", "cadastros", "Cria cliente ou credor.", ["admin:cadastros"], ["nome", "tipo"], ["nome", "tipo"], { tipo: ["cliente", "credor"] }),
  write("atualizar_cliente_credor", "cadastros", "Atualiza cliente ou credor.", ["admin:cadastros"], ["id", "expected_version", "patch"], ["id", "expected_version", "patch"]),
  write("arquivar_cliente_credor", "cadastros", "Arquiva cliente ou credor.", ["admin:cadastros"], ["id", "expected_version"], ["id", "expected_version"]),
  write("mesclar_clientes_credores", "cadastros", "Mescla registros preservando auditoria.", ["admin:cadastros"], ["origem_id", "destino_id", "expected_version"], ["origem_id", "destino_id", "expected_version"]),

  write("simular_lote", "lotes", "Simula lote sem persistir efeito.", ["finance:update"], ["operacoes"], ["operacoes"], {}, 250),
  write("executar_lote", "lotes", "Executa lote confirmado e idempotente.", ["finance:update"], ["confirmation_token", "operacoes"], ["confirmation_token", "operacoes"], {}, 250),
  read("obter_resultado_lote", "lotes", "Obtém resultado canônico de lote.", ["finance:read"], ["id"], "none"),
  write("preparar_operacao", "lotes", "Gera confirmação vinculada a payload e versões.", ["finance:update"], ["operacao", "payload"], ["operacao", "payload"]),
  write("confirmar_operacao", "lotes", "Consome token de confirmação uma vez.", ["finance:update"], ["confirmation_token"], ["confirmation_token"]),
  read("listar_eventos_auditoria", "auditoria-interna", "Lista eventos internos, redigidos e tenant-safe.", ["finance:audit"], ["cursor", "limit"]),
  read("obter_evento_auditoria", "auditoria-interna", "Obtém evento interno por id.", ["finance:audit"], ["id"], "none"),
];

function toContract(seed: Seed): McpToolContract {
  const isWrite = seed.mode === "write";
  return {
    ...seed,
    status: "planned",
    input: { required: seed.required ?? [], properties: seed.input ?? [], enums: seed.enums ?? {} },
    output: { success: ["request_id", "data"], error: ["request_id", "error.code", "error.message"] },
    limits: { maxPageSize: seed.pagination === "cursor" ? 100 : null, maxBatchItems: seed.maxBatchItems ?? null },
    pagination: seed.pagination ?? "none",
    idempotency: isWrite ? "required" : "not-applicable",
    expectedVersion: isWrite ? "required" : "not-applicable",
    confirmation: isWrite ? "required" : "not-applicable",
    dryRun: isWrite ? "available" : "not-applicable",
    effects: isWrite ? ["auditoria append-only", "efeito apenas após confirmação"] : ["nenhuma mutação"],
    retry: isWrite ? "Repetir somente com mesma idempotency key; resposta canônica." : "Seguro repetir; cursor preserva ordem estável.",
    http: { method: "POST", route: `/mcp/v1/tools/${seed.name}`, requiredHeaders: ["X-API-Key", "X-Request-Id"] },
    examples: [`${seed.name} com campos obrigatórios do contrato.`],
    tests: ["contrato schema", "isolamento de dois tenants", ...(isWrite ? ["idempotência", "versão/confirmação", "auditoria"] : ["paginação/erros"])],
  };
}

export const MCP_TOOL_CONTRACT_VERSION = "1.0.0";
export const TOOL_CONTRACTS: readonly McpToolContract[] = seeds.map(toContract);

/** Handlers realmente conectados e testados. Vazio até Tasks 15/16. */
export const CONNECTED_MCP_HANDLERS: Readonly<Record<string, true>> = {};

/** Único array permitido para resposta MCP tools/list. */
export const PUBLIC_MCP_TOOL_DEFINITIONS = TOOL_CONTRACTS
  .filter((tool) => tool.status === "connected" && CONNECTED_MCP_HANDLERS[tool.name])
  .map((tool) => ({
    name: tool.name,
    description: tool.summary,
    inputSchema: { type: "object", properties: {} },
  }));
