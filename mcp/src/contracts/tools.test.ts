import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONNECTED_MCP_HANDLERS,
  PUBLIC_MCP_TOOL_DEFINITIONS,
  TOOL_CONTRACTS,
} from "./tools.js";

const mcpIndex = readFileSync(resolve(process.cwd(), "mcp/src/index.ts"), "utf8");

describe("MCP tool exposure", () => {
  it("advertises only catalog tools with exported connected handlers", () => {
    expect(PUBLIC_MCP_TOOL_DEFINITIONS.map((tool) => tool.name).sort()).toEqual(
      Object.keys(CONNECTED_MCP_HANDLERS).sort(),
    );
    expect(mcpIndex).toContain("tools: PUBLIC_MCP_TOOL_DEFINITIONS as Tool[]");
  });

  it("keeps complete planned catalog private until its contract fields exist", () => {
    expect(TOOL_CONTRACTS.length).toBeGreaterThan(70);
    expect(TOOL_CONTRACTS.every((tool) =>
      tool.status === "planned"
      && tool.input.properties.length > 0 || tool.group === "discovery",
    )).toBe(true);
    expect(TOOL_CONTRACTS.every((tool) => tool.http.requiredHeaders.includes("X-Request-Id"))).toBe(true);
    expect(TOOL_CONTRACTS.some((tool) => tool.name === "executar_sql")).toBe(false);
  });
});
