import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONNECTED_MCP_HANDLERS,
  PUBLIC_MCP_TOOL_DEFINITIONS,
  TOOL_CONTRACTS,
  toMcpToolDefinition,
} from "./tools.js";

type Schema = {
  type: string;
  format?: string;
  pattern?: string;
  enum?: readonly string[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  items?: Schema;
  properties?: Record<string, Schema>;
  required?: readonly string[];
  additionalProperties?: boolean;
};

function expectExampleToMatchSchema(schema: Schema, value: unknown, path = "$"): void {
  if (schema.enum) expect(value, `${path} enum`).toBeOneOf(schema.enum);
  if (schema.type === "string") {
    expect(typeof value, `${path} type`).toBe("string");
    const text = value as string;
    if (schema.minLength !== undefined) expect(text.length, `${path} minLength`).toBeGreaterThanOrEqual(schema.minLength);
    if (schema.maxLength !== undefined) expect(text.length, `${path} maxLength`).toBeLessThanOrEqual(schema.maxLength);
    if (schema.pattern) expect(text, `${path} pattern`).toMatch(new RegExp(schema.pattern));
    return;
  }
  if (schema.type === "integer") {
    expect(Number.isInteger(value), `${path} integer`).toBe(true);
  } else if (schema.type === "boolean") {
    expect(typeof value, `${path} type`).toBe("boolean");
    return;
  } else if (schema.type === "array") {
    expect(Array.isArray(value), `${path} type`).toBe(true);
    const list = value as unknown[];
    if (schema.minItems !== undefined) expect(list.length, `${path} minItems`).toBeGreaterThanOrEqual(schema.minItems);
    if (schema.maxItems !== undefined) expect(list.length, `${path} maxItems`).toBeLessThanOrEqual(schema.maxItems);
    for (const [index, item] of list.entries()) expectExampleToMatchSchema(schema.items!, item, `${path}[${index}]`);
    return;
  } else if (schema.type === "object") {
    expect(value, `${path} object`).toBeTypeOf("object");
    expect(value, `${path} object`).not.toBeNull();
    const record = value as Record<string, unknown>;
    for (const required of schema.required ?? []) expect(record, `${path}.${required} required`).toHaveProperty(required);
    for (const [key, item] of Object.entries(record)) {
      const property = schema.properties?.[key];
      if (!property) {
        expect(schema.additionalProperties, `${path}.${key} allowed`).toBe(true);
        continue;
      }
      expectExampleToMatchSchema(property, item, `${path}.${key}`);
    }
    return;
  }
  expect(typeof value, `${path} number`).toBe("number");
  if (schema.minimum !== undefined) expect(value as number, `${path} minimum`).toBeGreaterThanOrEqual(schema.minimum);
  if (schema.maximum !== undefined) expect(value as number, `${path} maximum`).toBeLessThanOrEqual(schema.maximum);
}

const mcpIndex = readFileSync(resolve(process.cwd(), "mcp/src/index.ts"), "utf8");
const EXPECTED_TOOL_NAMES = [
  "health_check", "get_capabilities", "get_schema", "get_current_context", "get_api_version",
  "listar_lancamentos", "obter_lancamento", "verificar_duplicidade", "criar_lancamento", "atualizar_lancamento", "cancelar_lancamento", "excluir_lancamento", "restaurar_lancamento",
  "baixar_lancamento", "registrar_pagamento_parcial", "registrar_recebimento_parcial", "listar_movimentos_lancamento", "obter_movimento_pagamento", "corrigir_movimento_pagamento", "estornar_movimento_pagamento", "estornar_baixa",
  "criar_transferencia", "obter_transferencia", "listar_transferencias", "estornar_transferencia",
  "criar_recorrencia", "listar_recorrencias", "obter_recorrencia", "atualizar_recorrencia", "pausar_recorrencia", "retomar_recorrencia", "cancelar_recorrencia", "gerar_proximas_parcelas", "gerar_parcela_ausente", "alterar_somente_esta_parcela", "alterar_esta_e_as_futuras", "excluir_somente_esta_parcela", "excluir_esta_e_as_futuras",
  "iniciar_upload_comprovante", "finalizar_upload_comprovante", "associar_comprovante_lancamento", "listar_comprovantes_lancamento", "obter_metadados_comprovante", "obter_url_temporaria_comprovante", "buscar_comprovante_por_hash", "remover_associacao_comprovante",
  "consultar_saldo_realizado", "consultar_saldo_acumulado", "consultar_saldo_projetado", "relatorio_fluxo_caixa", "relatorio_contas_pagar", "relatorio_contas_receber", "relatorio_atrasados", "relatorio_por_categoria", "relatorio_por_banco", "relatorio_por_cliente_credor", "comparar_periodos", "projetar_fluxo_caixa", "relatorio_kpis",
  "criar_banco", "atualizar_banco", "arquivar_banco", "reativar_banco", "criar_categoria", "atualizar_categoria", "mover_categoria", "arquivar_categoria", "reativar_categoria", "criar_cliente_credor", "atualizar_cliente_credor", "arquivar_cliente_credor", "mesclar_clientes_credores",
  "simular_lote", "executar_lote", "obter_resultado_lote", "preparar_operacao", "confirmar_operacao", "listar_eventos_auditoria", "obter_evento_auditoria",
] as const;

describe("MCP tool contracts", () => {
  it("contains exact, unique planned inventory in approved groups", () => {
    const names = TOOL_CONTRACTS.map((tool) => tool.name);
    expect([...names].sort()).toEqual([...EXPECTED_TOOL_NAMES].sort());
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(TOOL_CONTRACTS.map((tool) => tool.group))).toEqual(new Set([
      "discovery", "lancamentos", "pagamentos", "transferencias", "recorrencias",
      "anexos", "relatorios", "cadastros", "lotes", "auditoria-interna",
    ]));
  });

  it("uses executable field schemas and real examples for every contract", () => {
    for (const tool of TOOL_CONTRACTS) {
      expect(tool.input.type).toBe("object");
      expect(tool.input.additionalProperties).toBe(false);
      expect(Object.keys(tool.input.properties).length).toBeGreaterThan(0);
      expect(tool.output.success.type).toBe("object");
      expect(tool.output.error.type).toBe("object");
      expect(tool.examples.input).not.toEqual({});
      expect(tool.examples.output).not.toEqual({});
      for (const required of tool.input.required) {
        expect(tool.input.properties).toHaveProperty(required);
      }
    }

    const create = TOOL_CONTRACTS.find((tool) => tool.name === "criar_lancamento");
    expect(create?.input.properties.valor).toMatchObject({ type: "string", format: "decimal" });
    expect(create?.input.properties.tipo).toMatchObject({ enum: ["receita", "despesa"] });
  });

  it("keeps write headers and control fields coherent with operation flags", () => {
    for (const tool of TOOL_CONTRACTS) {
      const inputFields = tool.input.properties;
      const isWrite = tool.mode === "write";
      expect(tool.idempotency === "required").toBe(isWrite);
      expect(tool.http.requiredHeaders.includes("Idempotency-Key")).toBe(isWrite);
      expect(tool.mode === "read").toBe(tool.idempotency === "not-applicable");

      if (tool.expectedVersion === "required") {
        expect(tool.input.required).toContain("expected_version");
        expect(inputFields).toHaveProperty("expected_version");
      } else {
        expect(inputFields).not.toHaveProperty("expected_version");
      }

      if (tool.confirmation === "required") {
        expect(tool.input.required).toContain("confirmation_token");
        expect(inputFields).toHaveProperty("confirmation_token");
      } else {
        expect(inputFields).not.toHaveProperty("confirmation_token");
      }

      if (tool.dryRun === "available") {
        expect(inputFields).toHaveProperty("dry_run");
      } else {
        expect(inputFields).not.toHaveProperty("dry_run");
      }
    }
  });

  it("makes every documented example executable against its exact canonical schema", () => {
    for (const tool of TOOL_CONTRACTS) {
      expect(new Set(tool.input.required).size, `${tool.name} required fields are unique`).toBe(tool.input.required.length);
      expectExampleToMatchSchema(tool.input, tool.examples.input, `${tool.name}.input`);
      expectExampleToMatchSchema(tool.output.success, tool.examples.output, `${tool.name}.output`);
    }
  });

  it("uses JSON Schema keywords that match each field kind", () => {
    const visit = (schema: Schema): void => {
      if (schema.type === "array") {
        expect(schema.minimum).toBeUndefined();
        expect(schema.maximum).toBeUndefined();
        expect(schema.maxItems).toBeTypeOf("number");
        visit(schema.items!);
      }
      if (schema.type === "object") Object.values(schema.properties ?? {}).forEach(visit);
    };
    TOOL_CONTRACTS.forEach((tool) => {
      visit(tool.input);
      visit(tool.output.success);
      visit(tool.output.error);
    });
  });

  it("publishes only executable connected handlers and forwards full canonical inputSchema", () => {
    const publicNames = PUBLIC_MCP_TOOL_DEFINITIONS.map((tool) => tool.name).sort();
    const handlerNames = Object.keys(CONNECTED_MCP_HANDLERS).sort();
    expect(publicNames).toEqual(handlerNames);
    expect(Object.values(CONNECTED_MCP_HANDLERS).every((handler) => typeof handler === "function")).toBe(true);
    expect(Object.keys(CONNECTED_MCP_HANDLERS).every((name) =>
      TOOL_CONTRACTS.some((tool) => tool.name === name && tool.status === "connected"),
    )).toBe(true);
    expect(PUBLIC_MCP_TOOL_DEFINITIONS.every((tool) => Object.keys(tool.inputSchema.properties).length > 0)).toBe(true);
    expect(toMcpToolDefinition(TOOL_CONTRACTS[0]).inputSchema).toEqual(TOOL_CONTRACTS[0].input);
    expect(mcpIndex).toContain("tools: PUBLIC_MCP_TOOL_DEFINITIONS as unknown as Tool[]");
    expect(mcpIndex).toContain("const handler = CONNECTED_MCP_HANDLERS[name]");
  });
});
