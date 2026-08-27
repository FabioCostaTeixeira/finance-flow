import { describe, expect, it } from "vitest";
import { CONNECTED_MCP_HANDLERS, PUBLIC_MCP_TOOL_DEFINITIONS, TOOL_CONTRACTS } from "../contracts/tools.js";

describe("Task 15 - Read-Only MCP Tools Exposure", () => {
  it("only advertises tools that have connected handlers", () => {
    const publicToolNames = PUBLIC_MCP_TOOL_DEFINITIONS.map((t) => t.name).sort();
    const handlerNames = Object.keys(CONNECTED_MCP_HANDLERS).sort();

    expect(publicToolNames).toEqual(handlerNames);
  });

  it("ensures read-only tools match their contract groups", () => {
    const readOnlyTools = TOOL_CONTRACTS.filter((t) => t.mode === "read");
    expect(readOnlyTools.length).toBeGreaterThan(0);

    for (const tool of readOnlyTools) {
      expect(tool.idempotency).toBe("not-applicable");
      expect(tool.http.requiredHeaders).not.toContain("Idempotency-Key");
    }
  });
});
