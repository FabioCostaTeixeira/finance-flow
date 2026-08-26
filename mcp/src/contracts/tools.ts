/** Catálogo MCP/HTTP v1. Todo schema é canônico e publicável sem tradução. */
export type ToolMode = "read" | "write";
export type ToolStatus = "planned" | "connected" | "disabled";
export type FieldSchema = {
  type: "string" | "integer" | "number" | "boolean" | "object" | "array";
  format?: "uuid" | "date" | "date-time" | "decimal" | "uri" | "sha256";
  pattern?: string;
  enum?: readonly string[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  items?: FieldSchema;
  properties?: Readonly<Record<string, FieldSchema>>;
  required?: string[];
  additionalProperties?: boolean;
};
export type ObjectSchema = FieldSchema & {
  type: "object";
  properties: Record<string, FieldSchema>;
  required: string[];
  additionalProperties: false;
};

export interface McpToolContract {
  name: string; group: string; summary: string; mode: ToolMode; status: ToolStatus;
  scopes: readonly string[]; input: ObjectSchema;
  output: { success: ObjectSchema; error: ObjectSchema };
  limits: { maxPageSize: number | null; maxBatchItems: number | null };
  pagination: "cursor" | "none";
  idempotency: "not-applicable" | "required";
  expectedVersion: "not-applicable" | "required";
  confirmation: "not-applicable" | "required";
  dryRun: "not-applicable" | "available";
  effects: readonly string[]; retry: string;
  http: { method: "POST"; route: string; requiredHeaders: readonly string[] };
  examples: { input: Record<string, unknown>; output: Record<string, unknown> };
  tests: readonly string[];
}

const f = {
  uuid: { type: "string", format: "uuid" } as const,
  date: { type: "string", format: "date" } as const,
  datetime: { type: "string", format: "date-time" } as const,
  decimal: { type: "string", format: "decimal", pattern: "^-?\\d+(\\.\\d{1,2})?$" } as FieldSchema,
  text: { type: "string", minLength: 1, maxLength: 500 } as const,
  note: { type: "string", maxLength: 4000 } as const,
  cursor: { type: "string", minLength: 1, maxLength: 512 } as const,
  nextCursor: { type: "string", minLength: 0, maxLength: 512 } as const,
  limit: { type: "integer", minimum: 1, maximum: 100 } as const,
  version: { type: "integer", minimum: 1 } as const,
  bool: { type: "boolean" } as const,
  hash: { type: "string", format: "sha256", minLength: 64, maxLength: 64 } as const,
  tipo: { type: "string", enum: ["receita", "despesa"] } as const,
  status: { type: "string", enum: ["a_receber", "recebido", "a_pagar", "pago", "parcial", "atrasado", "cancelado"] } as const,
  frequency: { type: "string", enum: ["semanal", "mensal", "anual"] } as const,
};
const object = (properties: Record<string, FieldSchema>, required: readonly string[] = []): ObjectSchema => ({ type: "object", properties, required: [...required], additionalProperties: false });
const openObject = (): FieldSchema => ({ type: "object", properties: {}, required: [], additionalProperties: true });
const array = (items: FieldSchema, maxItems = 100, minItems = 0): FieldSchema => ({ type: "array", items, minItems, maxItems });
const page = (extra: Record<string, FieldSchema> = {}) => object({ cursor: f.cursor, limit: f.limit, ...extra });
const id = (key = "id") => object({ [key]: f.uuid }, [key]);
const uuid = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";

const lancamento = object({ id: f.uuid, version: f.version, tipo: f.tipo, cliente_credor: f.text, valor: f.decimal, data_vencimento: f.date, status: f.status }, ["id", "version", "tipo", "valor", "status"]);
const movimento = object({ id: f.uuid, lancamento_id: f.uuid, valor: f.decimal, data: f.date, tipo: { type: "string", enum: ["pagamento", "recebimento", "estorno", "correcao"] } }, ["id", "lancamento_id", "valor", "data", "tipo"]);
const transferencia = object({ id: f.uuid, version: f.version, banco_origem_id: f.uuid, banco_destino_id: f.uuid, valor: f.decimal, data: f.date, status: { type: "string", enum: ["confirmada", "estornada"] } }, ["id", "version", "valor", "status"]);
const recorrencia = object({ id: f.uuid, version: f.version, frequencia: f.frequency, inicio: f.date, status: { type: "string", enum: ["ativa", "pausada", "cancelada"] } }, ["id", "version", "frequencia", "status"]);
const comprovante = object({ id: f.uuid, nome: f.text, content_type: { type: "string", minLength: 3, maxLength: 127 }, size: { type: "integer", minimum: 1, maximum: 20_000_000 }, sha256: f.hash }, ["id", "nome", "sha256"]);
const cadastro = object({ id: f.uuid, version: f.version, nome: f.text, arquivado: f.bool }, ["id", "version", "nome", "arquivado"]);
const event = object({ id: f.uuid, created_at: f.datetime, actor_id: f.uuid, operation: f.text, resource_id: f.uuid }, ["id", "created_at", "operation"]);

const errorSchema = object({ request_id: f.uuid, error: object({ code: { type: "string", enum: ["VALIDATION_ERROR", "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "CONFLICT", "IDEMPOTENCY_CONFLICT", "CONFIRMATION_REQUIRED", "INTERNAL_ERROR"] }, message: f.text }, ["code", "message"]) }, ["request_id", "error"]);
const success = (data: ObjectSchema) => object({ request_id: f.uuid, data }, ["request_id", "data"]);
const single = (key: string, schema: ObjectSchema) => object({ [key]: schema }, [key]);
const listed = (key: string, schema: ObjectSchema) => object({ [key]: array(schema), next_cursor: f.nextCursor }, [key]);
const outputExample = (data: Record<string, unknown>) => ({ request_id: requestId, data });

type ReadOptions = { name: string; group: string; summary: string; scopes?: readonly string[]; input: ObjectSchema; data: ObjectSchema; example: Record<string, unknown>; output: Record<string, unknown>; pagination?: "cursor" | "none" };
type WriteOptions = ReadOptions & { expectedVersion?: boolean; confirmation?: boolean; dryRun?: boolean; maxBatchItems?: number | null };
const readTool = (o: ReadOptions): McpToolContract => ({
  ...o, mode: "read", status: "planned", scopes: o.scopes ?? ["finance:read"], output: { success: success(o.data), error: errorSchema },
  limits: { maxPageSize: o.pagination === "cursor" ? 100 : null, maxBatchItems: null }, pagination: o.pagination ?? "none",
  idempotency: "not-applicable", expectedVersion: "not-applicable", confirmation: "not-applicable", dryRun: "not-applicable",
  effects: ["nenhuma mutação"], retry: "Seguro repetir; cursor mantém ordenação estável.",
  http: { method: "POST", route: `/mcp/v1/tools/${o.name}`, requiredHeaders: ["X-API-Key", "X-Request-Id"] },
  examples: { input: o.example, output: outputExample(o.output) }, tests: ["schema", "erro estável", "isolamento de dois tenants"],
});
const writeTool = (o: WriteOptions): McpToolContract => {
  const expected = o.expectedVersion ?? false;
  const confirmation = o.confirmation ?? true;
  const dryRun = o.dryRun ?? true;
  const properties: Record<string, FieldSchema> = { ...o.input.properties };
  const required = [...o.input.required];
  if (expected) {
    properties.expected_version = f.version;
    if (!required.includes("expected_version")) required.push("expected_version");
  }
  if (confirmation) {
    properties.confirmation_token = f.uuid;
    if (!required.includes("confirmation_token")) required.push("confirmation_token");
  }
  if (dryRun) properties.dry_run = f.bool;
  return {
    ...o, mode: "write", status: "planned", scopes: o.scopes ?? ["finance:update"], input: object(properties, required), output: { success: success(o.data), error: errorSchema },
    limits: { maxPageSize: null, maxBatchItems: o.maxBatchItems ?? null }, pagination: "none", idempotency: "required",
    expectedVersion: expected ? "required" : "not-applicable", confirmation: confirmation ? "required" : "not-applicable", dryRun: dryRun ? "available" : "not-applicable",
    effects: ["auditoria append-only", "efeito somente após controles validados"], retry: "Repetir somente com a mesma Idempotency-Key; retorna resposta canônica.",
    http: { method: "POST", route: `/mcp/v1/tools/${o.name}`, requiredHeaders: ["X-API-Key", "X-Request-Id", "Idempotency-Key"] },
    examples: { input: o.example, output: outputExample(o.output) }, tests: ["schema", "isolamento de dois tenants", "idempotência", "confirmação", "auditoria"],
  };
};

const listLancamentos = page({ tipo: f.tipo, status: f.status, data_inicio: f.date, data_fim: f.date, banco_id: f.uuid, categoria_id: f.uuid });
const patchLancamento = object({ cliente_credor: f.text, valor: f.decimal, data_vencimento: f.date, banco_id: f.uuid, categoria_id: f.uuid, observacao: f.note }, []);
const patchRecorrencia = object({ frequencia: f.frequency, proxima_data: f.date, observacao: f.note }, []);
const patchCadastro = object({ nome: f.text, observacao: f.note }, []);
const token = "33333333-3333-4333-8333-333333333333";
const publicFieldSchema = object({
  type: { type: "string", enum: ["string", "integer", "number", "boolean", "object", "array"] },
  format: { type: "string", enum: ["uuid", "date", "date-time", "decimal", "uri", "sha256"] },
  pattern: f.note,
  enum: array(f.text),
  minLength: { type: "integer", minimum: 0 },
  maxLength: { type: "integer", minimum: 0 },
  minimum: { type: "number" },
  maximum: { type: "number" },
  minItems: { type: "integer", minimum: 0 },
  maxItems: { type: "integer", minimum: 0 },
  items: openObject(),
  properties: openObject(),
  required: array(f.text),
  additionalProperties: f.bool,
}, ["type"]);
const batchOperation = object({
  tool: f.text,
  target_id: f.uuid,
  expected_version: f.version,
  item_idempotency_key: f.uuid,
  payload: object({}, []),
}, ["tool", "target_id", "expected_version", "item_idempotency_key", "payload"]);

export const TOOL_CONTRACTS: readonly McpToolContract[] = [
  readTool({ name: "health_check", group: "discovery", summary: "Verifica disponibilidade e dependências públicas.", scopes: [], input: object({ include_dependencies: f.bool }), data: single("health", object({ status: { type: "string", enum: ["ok", "degraded"] }, version: f.text }, ["status", "version"])), example: { include_dependencies: true }, output: { health: { status: "ok", version: "1.0.0" } } }),
  readTool({ name: "get_capabilities", group: "discovery", summary: "Expõe versão e capacidades publicadas.", scopes: [], input: object({ include_deprecated: f.bool }), data: single("capabilities", object({ version: f.text, tools: array(object({ name: f.text, mode: { type: "string", enum: ["read", "write"] } }, ["name", "mode"])) }, ["version", "tools"])), example: { include_deprecated: false }, output: { capabilities: { version: "1.0.0", tools: [] } } }),
  readTool({ name: "get_schema", group: "discovery", summary: "Obtém schema público de uma ferramenta.", scopes: [], input: object({ tool_name: f.text }, ["tool_name"]), data: single("schema", object({ tool_name: f.text, input_schema: publicFieldSchema }, ["tool_name", "input_schema"])), example: { tool_name: "listar_lancamentos" }, output: { schema: { tool_name: "listar_lancamentos", input_schema: { type: "object", properties: { id: { type: "string", format: "uuid" } }, required: ["id"], additionalProperties: false } } } }),
  readTool({ name: "get_current_context", group: "discovery", summary: "Mostra contexto resolvido da chave sem aceitar tenant no payload.", scopes: [], input: object({ include_scopes: f.bool }), data: single("context", object({ tenant_id: f.uuid, actor_id: f.uuid, scopes: array(f.text) }, ["tenant_id", "actor_id", "scopes"])), example: { include_scopes: true }, output: { context: { tenant_id: uuid, actor_id: uuid, scopes: ["finance:read"] } } }),
  readTool({ name: "get_api_version", group: "discovery", summary: "Obtém versão compatível do protocolo.", scopes: [], input: object({ include_supported_versions: f.bool }), data: single("api", object({ version: f.text, supported_versions: array(f.text) }, ["version"])), example: { include_supported_versions: true }, output: { api: { version: "1.0.0", supported_versions: ["1.0.0"] } } }),

  readTool({ name: "listar_lancamentos", group: "lancamentos", summary: "Lista lançamentos com cursor e filtros fechados.", input: listLancamentos, data: listed("lancamentos", lancamento), example: { limit: 20, tipo: "despesa" }, output: { lancamentos: [{ id: uuid, version: 1, tipo: "despesa", valor: "125.00", status: "a_pagar" }], next_cursor: "cursor-2" }, pagination: "cursor" }),
  readTool({ name: "obter_lancamento", group: "lancamentos", summary: "Obtém lançamento por UUID.", input: id(), data: single("lancamento", lancamento), example: { id: uuid }, output: { lancamento: { id: uuid, version: 1, tipo: "receita", valor: "500.00", status: "a_receber" } } }),
  readTool({ name: "verificar_duplicidade", group: "lancamentos", summary: "Procura duplicidades por atributos financeiros.", input: object({ tipo: f.tipo, cliente_credor: f.text, valor: f.decimal, data_vencimento: f.date }, ["tipo", "cliente_credor", "valor", "data_vencimento"]), data: listed("candidatos", lancamento), example: { tipo: "despesa", cliente_credor: "Fornecedor A", valor: "125.00", data_vencimento: "2026-09-01" }, output: { candidatos: [], next_cursor: "" } }),
  writeTool({ name: "criar_lancamento", group: "lancamentos", summary: "Cria lançamento financeiro.", scopes: ["finance:create"], input: object({ tipo: f.tipo, cliente_credor: f.text, valor: f.decimal, data_vencimento: f.date, banco_id: f.uuid, categoria_id: f.uuid, observacao: f.note }, ["tipo", "cliente_credor", "valor", "data_vencimento"]), data: single("lancamento", lancamento), example: { tipo: "despesa", cliente_credor: "Fornecedor A", valor: "125.00", data_vencimento: "2026-09-01", confirmation_token: token, dry_run: false }, output: { lancamento: { id: uuid, version: 1, tipo: "despesa", valor: "125.00", status: "a_pagar" } } }),
  writeTool({ name: "atualizar_lancamento", group: "lancamentos", summary: "Atualiza campos permitidos.", scopes: ["finance:update"], input: object({ id: f.uuid, patch: patchLancamento }, ["id", "patch"]), data: single("lancamento", lancamento), example: { id: uuid, patch: { observacao: "Vencimento confirmado" }, expected_version: 1, confirmation_token: token, dry_run: false }, output: { lancamento: { id: uuid, version: 2, tipo: "despesa", valor: "125.00", status: "a_pagar" } }, expectedVersion: true }),
  ...["cancelar_lancamento", "excluir_lancamento", "restaurar_lancamento"].map((name) => writeTool({ name, group: "lancamentos", summary: name === "restaurar_lancamento" ? "Restaura lançamento excluído logicamente." : "Altera estado sem hard delete de evidência.", scopes: ["finance:delete"], input: object({ id: f.uuid, motivo: f.note }, name === "restaurar_lancamento" ? ["id"] : ["id", "motivo"]), data: single("lancamento", lancamento), example: { id: uuid, ...(name === "restaurar_lancamento" ? {} : { motivo: "Solicitação aprovada" }), expected_version: 1, confirmation_token: token, dry_run: false }, output: { lancamento: { id: uuid, version: 2, tipo: "despesa", valor: "125.00", status: name === "cancelar_lancamento" ? "cancelado" : "a_pagar" } }, expectedVersion: true })),

  ...["baixar_lancamento", "registrar_pagamento_parcial", "registrar_recebimento_parcial"].map((name) => writeTool({ name, group: "pagamentos", summary: "Registra movimento financeiro com valor decimal.", scopes: ["finance:pay"], input: object({ lancamento_id: f.uuid, valor: f.decimal, data: f.date }, ["lancamento_id", "valor", "data"]), data: single("movimento", movimento), example: { lancamento_id: uuid, valor: "50.00", data: "2026-09-01", expected_version: 1, confirmation_token: token, dry_run: false }, output: { movimento: { id: uuid, lancamento_id: uuid, valor: "50.00", data: "2026-09-01", tipo: name === "registrar_recebimento_parcial" ? "recebimento" : "pagamento" } }, expectedVersion: true })),
  readTool({ name: "listar_movimentos_lancamento", group: "pagamentos", summary: "Lista movimentos de um lançamento.", input: page({ lancamento_id: f.uuid }), data: listed("movimentos", movimento), example: { lancamento_id: uuid, limit: 20 }, output: { movimentos: [], next_cursor: "" }, pagination: "cursor" }),
  readTool({ name: "obter_movimento_pagamento", group: "pagamentos", summary: "Obtém movimento por UUID.", input: id(), data: single("movimento", movimento), example: { id: uuid }, output: { movimento: { id: uuid, lancamento_id: uuid, valor: "50.00", data: "2026-09-01", tipo: "pagamento" } } }),
  ...["corrigir_movimento_pagamento", "estornar_movimento_pagamento", "estornar_baixa"].map((name) => writeTool({ name, group: "pagamentos", summary: "Corrige ou estorna preservando histórico.", scopes: ["finance:pay"], input: object({ id: f.uuid, valor: f.decimal, motivo: f.note }, name === "corrigir_movimento_pagamento" ? ["id", "valor"] : ["id", "motivo"]), data: single("movimento", movimento), example: { id: uuid, ...(name === "corrigir_movimento_pagamento" ? { valor: "55.00" } : { motivo: "Pagamento duplicado" }), expected_version: 1, confirmation_token: token, dry_run: false }, output: { movimento: { id: uuid, lancamento_id: uuid, valor: "50.00", data: "2026-09-01", tipo: name === "corrigir_movimento_pagamento" ? "correcao" : "estorno" } }, expectedVersion: true })),

  writeTool({ name: "criar_transferencia", group: "transferencias", summary: "Cria duas pernas atômicas.", scopes: ["finance:transfer"], input: object({ banco_origem_id: f.uuid, banco_destino_id: f.uuid, valor: f.decimal, data: f.date, descricao: f.note }, ["banco_origem_id", "banco_destino_id", "valor", "data"]), data: single("transferencia", transferencia), example: { banco_origem_id: uuid, banco_destino_id: "44444444-4444-4444-8444-444444444444", valor: "200.00", data: "2026-09-01", confirmation_token: token, dry_run: false }, output: { transferencia: { id: uuid, version: 1, valor: "200.00", status: "confirmada" } } }),
  readTool({ name: "obter_transferencia", group: "transferencias", summary: "Obtém transferência e pernas.", input: id(), data: single("transferencia", transferencia), example: { id: uuid }, output: { transferencia: { id: uuid, version: 1, valor: "200.00", status: "confirmada" } } }),
  readTool({ name: "listar_transferencias", group: "transferencias", summary: "Lista transferências por cursor.", input: page({ data_inicio: f.date, data_fim: f.date }), data: listed("transferencias", transferencia), example: { limit: 20 }, output: { transferencias: [], next_cursor: "" }, pagination: "cursor" }),
  writeTool({ name: "estornar_transferencia", group: "transferencias", summary: "Estorna as duas pernas atomicamente.", scopes: ["finance:transfer"], input: object({ id: f.uuid, motivo: f.note }, ["id", "motivo"]), data: single("transferencia", transferencia), example: { id: uuid, motivo: "Conta incorreta", expected_version: 1, confirmation_token: token, dry_run: false }, output: { transferencia: { id: uuid, version: 2, valor: "200.00", status: "estornada" } }, expectedVersion: true }),

  writeTool({ name: "criar_recorrencia", group: "recorrencias", summary: "Cria série de recorrência.", scopes: ["finance:create"], input: object({ template: patchLancamento, frequencia: f.frequency, inicio: f.date }, ["template", "frequencia", "inicio"]), data: single("recorrencia", recorrencia), example: { template: { cliente_credor: "Aluguel", valor: "1200.00" }, frequencia: "mensal", inicio: "2026-09-01", confirmation_token: token, dry_run: false }, output: { recorrencia: { id: uuid, version: 1, frequencia: "mensal", inicio: "2026-09-01", status: "ativa" } } }),
  readTool({ name: "listar_recorrencias", group: "recorrencias", summary: "Lista séries por cursor.", input: page({ status: { type: "string", enum: ["ativa", "pausada", "cancelada"] } }), data: listed("recorrencias", recorrencia), example: { limit: 20, status: "ativa" }, output: { recorrencias: [], next_cursor: "" }, pagination: "cursor" }),
  readTool({ name: "obter_recorrencia", group: "recorrencias", summary: "Obtém série por UUID.", input: id(), data: single("recorrencia", recorrencia), example: { id: uuid }, output: { recorrencia: { id: uuid, version: 1, frequencia: "mensal", inicio: "2026-09-01", status: "ativa" } } }),
  writeTool({ name: "atualizar_recorrencia", group: "recorrencias", summary: "Atualiza campos permitidos da recorrência.", scopes: ["finance:update"], input: object({ id: f.uuid, patch: patchRecorrencia }, ["id", "patch"]), data: single("recorrencia", recorrencia), example: { id: uuid, patch: { frequencia: "mensal" }, expected_version: 1, confirmation_token: token, dry_run: false }, output: { recorrencia: { id: uuid, version: 2, frequencia: "mensal", inicio: "2026-09-01", status: "ativa" } }, expectedVersion: true }),
  ...["pausar_recorrencia", "retomar_recorrencia", "cancelar_recorrencia"].map((name) => writeTool({ name, group: "recorrencias", summary: "Altera estado da recorrência.", scopes: [name === "cancelar_recorrencia" ? "finance:delete" : "finance:update"], input: object({ id: f.uuid, motivo: f.note }, ["id"]), data: single("recorrencia", recorrencia), example: { id: uuid, expected_version: 1, confirmation_token: token, dry_run: false }, output: { recorrencia: { id: uuid, version: 2, frequencia: "mensal", inicio: "2026-09-01", status: name === "pausar_recorrencia" ? "pausada" : name === "cancelar_recorrencia" ? "cancelada" : "ativa" } }, expectedVersion: true })),
  ...["gerar_proximas_parcelas", "gerar_parcela_ausente"].map((name) => writeTool({ name, group: "recorrencias", summary: "Gera parcela idempotentemente.", scopes: ["finance:create"], input: object({ recorrencia_id: f.uuid, competencia: f.date, ate: f.date }, ["recorrencia_id"]), data: listed("parcelas", lancamento), example: { recorrencia_id: uuid, competencia: "2026-10-01", confirmation_token: token, dry_run: false }, output: { parcelas: [], next_cursor: "" } })),
  ...["alterar_somente_esta_parcela", "alterar_esta_e_as_futuras", "excluir_somente_esta_parcela", "excluir_esta_e_as_futuras"].map((name) => writeTool({ name, group: "recorrencias", summary: "Altera ou exclui logicamente parcelas selecionadas.", scopes: [name.startsWith("excluir") ? "finance:delete" : "finance:update"], input: object({ id: f.uuid, patch: patchLancamento, motivo: f.note }, ["id"]), data: single("lancamento", lancamento), example: { id: uuid, patch: { observacao: "Ajuste de contrato" }, expected_version: 1, confirmation_token: token, dry_run: false }, output: { lancamento: { id: uuid, version: 2, tipo: "despesa", valor: "1200.00", status: "a_pagar" } }, expectedVersion: true })),

  writeTool({ name: "iniciar_upload_comprovante", group: "anexos", summary: "Inicia upload privado com hash esperado.", scopes: ["finance:attachments"], input: object({ nome: f.text, content_type: { type: "string", minLength: 3, maxLength: 127 }, size: { type: "integer", minimum: 1, maximum: 20_000_000 }, sha256: f.hash }, ["nome", "content_type", "size", "sha256"]), data: single("upload", object({ upload_id: f.uuid, upload_url: { type: "string", format: "uri" }, expires_at: f.datetime }, ["upload_id", "upload_url", "expires_at"])), example: { nome: "nota.pdf", content_type: "application/pdf", size: 12345, sha256: "a".repeat(64), confirmation_token: token, dry_run: false }, output: { upload: { upload_id: uuid, upload_url: "https://storage.example/upload", expires_at: "2026-09-01T12:00:00Z" } } }),
  writeTool({ name: "finalizar_upload_comprovante", group: "anexos", summary: "Confirma objeto e hash enviados.", scopes: ["finance:attachments"], input: object({ upload_id: f.uuid, sha256: f.hash }, ["upload_id", "sha256"]), data: single("comprovante", comprovante), example: { upload_id: uuid, sha256: "a".repeat(64), confirmation_token: token, dry_run: false }, output: { comprovante: { id: uuid, nome: "nota.pdf", content_type: "application/pdf", size: 12345, sha256: "a".repeat(64) } } }),
  ...["associar_comprovante_lancamento", "remover_associacao_comprovante"].map((name) => writeTool({ name, group: "anexos", summary: "Cria ou remove vínculo de comprovante.", scopes: ["finance:attachments"], input: object({ comprovante_id: f.uuid, lancamento_id: f.uuid }, ["comprovante_id", "lancamento_id"]), data: single("vinculo", object({ comprovante_id: f.uuid, lancamento_id: f.uuid }, ["comprovante_id", "lancamento_id"])), example: { comprovante_id: uuid, lancamento_id: uuid, expected_version: 1, confirmation_token: token, dry_run: false }, output: { vinculo: { comprovante_id: uuid, lancamento_id: uuid } }, expectedVersion: true })),
  readTool({ name: "listar_comprovantes_lancamento", group: "anexos", summary: "Lista metadados de comprovantes.", scopes: ["finance:attachments"], input: page({ lancamento_id: f.uuid }), data: listed("comprovantes", comprovante), example: { lancamento_id: uuid, limit: 20 }, output: { comprovantes: [], next_cursor: "" }, pagination: "cursor" }),
  ...["obter_metadados_comprovante", "obter_url_temporaria_comprovante", "buscar_comprovante_por_hash"].map((name) => readTool({ name, group: "anexos", summary: name === "obter_url_temporaria_comprovante" ? "Emite URL temporária privada." : "Obtém comprovante dentro do tenant.", scopes: ["finance:attachments"], input: name === "buscar_comprovante_por_hash" ? object({ sha256: f.hash }, ["sha256"]) : id(), data: single(name === "obter_url_temporaria_comprovante" ? "url" : "comprovante", name === "obter_url_temporaria_comprovante" ? object({ url: { type: "string", format: "uri" }, expires_at: f.datetime }, ["url", "expires_at"]) : comprovante), example: name === "buscar_comprovante_por_hash" ? { sha256: "a".repeat(64) } : { id: uuid }, output: name === "obter_url_temporaria_comprovante" ? { url: { url: "https://storage.example/file", expires_at: "2026-09-01T12:00:00Z" } } : { comprovante: { id: uuid, nome: "nota.pdf", content_type: "application/pdf", size: 12345, sha256: "a".repeat(64) } } })),

  ...["consultar_saldo_realizado", "consultar_saldo_acumulado", "consultar_saldo_projetado", "relatorio_fluxo_caixa", "relatorio_contas_pagar", "relatorio_contas_receber", "relatorio_atrasados", "relatorio_por_categoria", "relatorio_por_banco", "relatorio_por_cliente_credor"].map((name) => readTool({ name, group: "relatorios", summary: "Consulta relatório agregado no banco.", input: page({ data_inicio: f.date, data_fim: f.date, banco_id: f.uuid, categoria_id: f.uuid }), data: listed("linhas", object({ chave: f.text, valor: f.decimal }, ["chave", "valor"])), example: { data_inicio: "2026-09-01", data_fim: "2026-09-30", limit: 50 }, output: { linhas: [{ chave: "setembro", valor: "500.00" }], next_cursor: "" }, pagination: "cursor" })),
  readTool({ name: "comparar_periodos", group: "relatorios", summary: "Compara dois períodos fechados.", input: object({ periodo_a_inicio: f.date, periodo_a_fim: f.date, periodo_b_inicio: f.date, periodo_b_fim: f.date, tipo: f.tipo }, ["periodo_a_inicio", "periodo_a_fim", "periodo_b_inicio", "periodo_b_fim"]), data: single("comparacao", object({ variacao: f.decimal, percentual: f.decimal }, ["variacao", "percentual"])), example: { periodo_a_inicio: "2026-09-01", periodo_a_fim: "2026-09-30", periodo_b_inicio: "2026-08-01", periodo_b_fim: "2026-08-31" }, output: { comparacao: { variacao: "100.00", percentual: "10.00" } } }),
  readTool({ name: "projetar_fluxo_caixa", group: "relatorios", summary: "Projeta fluxo com método declarado.", input: object({ horizonte_meses: { type: "integer", minimum: 1, maximum: 24 }, metodo: { type: "string", enum: ["historico", "recorrencias"] } }, ["horizonte_meses"]), data: listed("projecoes", object({ mes: f.date, saldo: f.decimal }, ["mes", "saldo"])), example: { horizonte_meses: 3, metodo: "recorrencias" }, output: { projecoes: [{ mes: "2026-10-01", saldo: "900.00" }], next_cursor: "" } }),
  readTool({ name: "relatorio_kpis", group: "relatorios", summary: "Obtém KPIs por período.", input: object({ data_inicio: f.date, data_fim: f.date }, ["data_inicio", "data_fim"]), data: single("kpis", object({ receita: f.decimal, despesa: f.decimal, saldo: f.decimal }, ["receita", "despesa", "saldo"])), example: { data_inicio: "2026-09-01", data_fim: "2026-09-30" }, output: { kpis: { receita: "1000.00", despesa: "500.00", saldo: "500.00" } } }),

  ...["criar_banco", "criar_categoria", "criar_cliente_credor"].map((name) => writeTool({ name, group: "cadastros", summary: "Cria cadastro administrativo.", scopes: ["admin:cadastros"], input: object({ nome: f.text, tipo: name === "criar_categoria" ? f.tipo : { type: "string", enum: ["cliente", "credor"] } }, ["nome"]), data: single("cadastro", cadastro), example: { nome: "Banco Principal", confirmation_token: token, dry_run: false }, output: { cadastro: { id: uuid, version: 1, nome: "Banco Principal", arquivado: false } } })),
  ...["atualizar_banco", "atualizar_categoria", "atualizar_cliente_credor"].map((name) => writeTool({ name, group: "cadastros", summary: "Atualiza campos permitidos do cadastro.", scopes: ["admin:cadastros"], input: object({ id: f.uuid, patch: patchCadastro }, ["id", "patch"]), data: single("cadastro", cadastro), example: { id: uuid, patch: { nome: "Banco Principal" }, expected_version: 1, confirmation_token: token, dry_run: false }, output: { cadastro: { id: uuid, version: 2, nome: "Banco Principal", arquivado: false } }, expectedVersion: true })),
  writeTool({ name: "mover_categoria", group: "cadastros", summary: "Move categoria para pai permitido.", scopes: ["admin:cadastros"], input: object({ id: f.uuid, categoria_pai_id: f.uuid }, ["id", "categoria_pai_id"]), data: single("cadastro", cadastro), example: { id: uuid, categoria_pai_id: "44444444-4444-4444-8444-444444444444", expected_version: 1, confirmation_token: token, dry_run: false }, output: { cadastro: { id: uuid, version: 2, nome: "Categoria", arquivado: false } }, expectedVersion: true }),
  ...["arquivar_banco", "reativar_banco", "arquivar_categoria", "reativar_categoria", "arquivar_cliente_credor"].map((name) => writeTool({ name, group: "cadastros", summary: "Altera arquivamento do cadastro.", scopes: ["admin:cadastros"], input: id(), data: single("cadastro", cadastro), example: { id: uuid, expected_version: 1, confirmation_token: token, dry_run: false }, output: { cadastro: { id: uuid, version: 2, nome: "Cadastro", arquivado: name.startsWith("arquivar") } }, expectedVersion: true })),
  writeTool({ name: "mesclar_clientes_credores", group: "cadastros", summary: "Mescla cadastro no destino informado.", scopes: ["admin:cadastros"], input: object({ id: f.uuid, destino_id: f.uuid }, ["id", "destino_id"]), data: single("cadastro", cadastro), example: { id: uuid, destino_id: "44444444-4444-4444-8444-444444444444", expected_version: 1, confirmation_token: token, dry_run: false }, output: { cadastro: { id: uuid, version: 2, nome: "Cadastro", arquivado: false } }, expectedVersion: true }),

  readTool({ name: "simular_lote", group: "lotes", summary: "Simula lote sem persistir efeitos.", scopes: ["finance:update"], input: object({ operacoes: array(batchOperation, 250, 1) }, ["operacoes"]), data: single("simulacao", object({ id: f.uuid, validas: { type: "integer", minimum: 0 }, invalidas: { type: "integer", minimum: 0 } }, ["id", "validas", "invalidas"])), example: { operacoes: [{ tool: "atualizar_lancamento", target_id: uuid, expected_version: 1, item_idempotency_key: "44444444-4444-4444-8444-444444444444", payload: {} }] }, output: { simulacao: { id: uuid, validas: 1, invalidas: 0 } } }),
  writeTool({ name: "executar_lote", group: "lotes", summary: "Executa lote confirmado e idempotente.", scopes: ["finance:update"], input: object({ simulacao_id: f.uuid, operacoes: array(batchOperation, 250, 1) }, ["simulacao_id", "operacoes"]), data: single("lote", object({ id: f.uuid, status: { type: "string", enum: ["concluido", "parcial"] } }, ["id", "status"])), example: { simulacao_id: uuid, operacoes: [{ tool: "atualizar_lancamento", target_id: uuid, expected_version: 1, item_idempotency_key: "44444444-4444-4444-8444-444444444444", payload: {} }], confirmation_token: token, dry_run: false }, output: { lote: { id: uuid, status: "concluido" } }, maxBatchItems: 250 }),
  readTool({ name: "obter_resultado_lote", group: "lotes", summary: "Obtém resposta canônica de lote.", input: id(), data: single("lote", object({ id: f.uuid, status: f.text, resultados: array(object({ indice: { type: "integer", minimum: 0 }, status: f.text }, ["indice", "status"])) }, ["id", "status"])), example: { id: uuid }, output: { lote: { id: uuid, status: "concluido", resultados: [{ indice: 0, status: "ok" }] } } }),
  writeTool({ name: "preparar_operacao", group: "lotes", summary: "Gera token vinculado a payload e versões.", scopes: ["finance:update"], input: object({ operacao: f.text, payload: openObject() }, ["operacao", "payload"]), data: single("preparacao", object({ confirmation_token: f.uuid, expires_at: f.datetime }, ["confirmation_token", "expires_at"])), example: { operacao: "atualizar_lancamento", payload: { id: uuid, expected_version: 1 } }, output: { preparacao: { confirmation_token: token, expires_at: "2026-09-01T12:00:00Z" } }, confirmation: false, dryRun: false }),
  writeTool({ name: "confirmar_operacao", group: "lotes", summary: "Consome token de confirmação uma única vez.", scopes: ["finance:update"], input: object({ confirmation_token: f.uuid }, ["confirmation_token"]), data: single("confirmacao", object({ consumed: f.bool, operation_id: f.uuid }, ["consumed", "operation_id"])), example: { confirmation_token: token }, output: { confirmacao: { consumed: true, operation_id: uuid } }, confirmation: true, dryRun: false }),
  readTool({ name: "listar_eventos_auditoria", group: "auditoria-interna", summary: "Lista auditoria interna redigida.", scopes: ["finance:audit"], input: page({ data_inicio: f.datetime, data_fim: f.datetime, operation: f.text }), data: listed("eventos", event), example: { limit: 20 }, output: { eventos: [], next_cursor: "" }, pagination: "cursor" }),
  readTool({ name: "obter_evento_auditoria", group: "auditoria-interna", summary: "Obtém evento redigido por UUID.", scopes: ["finance:audit"], input: id(), data: single("evento", event), example: { id: uuid }, output: { evento: { id: uuid, created_at: "2026-09-01T10:00:00Z", actor_id: uuid, operation: "lancamento.updated", resource_id: uuid } } }),
];

export const MCP_TOOL_CONTRACT_VERSION = "1.1.0";
export type McpToolHandler = (args: Record<string, unknown>) => Promise<unknown>;
/** Só funções executáveis podem ser conectadas; catálogo atual permanece privado. */
export const CONNECTED_MCP_HANDLERS: Readonly<Record<string, McpToolHandler>> = {};
export const toMcpToolDefinition = (tool: McpToolContract) => ({ name: tool.name, description: tool.summary, inputSchema: tool.input });
export const PUBLIC_MCP_TOOL_DEFINITIONS = TOOL_CONTRACTS
  .filter((tool) => (tool.status === "connected") && Object.hasOwn(CONNECTED_MCP_HANDLERS, tool.name))
  .map(toMcpToolDefinition);
