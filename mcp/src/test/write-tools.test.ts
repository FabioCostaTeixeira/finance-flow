import { describe, expect, it } from "vitest";
import { CONNECTED_MCP_HANDLERS, TOOL_CONTRACTS } from "../contracts/tools.js";

describe("Task 16 - Write MCP Tools Validation", () => {
  it("verifies all write tools require idempotency key and proper scope", () => {
    const writeTools = TOOL_CONTRACTS.filter((t) => t.mode === "write");
    expect(writeTools.length).toBeGreaterThan(0);

    for (const tool of writeTools) {
      expect(tool.idempotency).toBe("required");
      expect(tool.http.requiredHeaders).toContain("Idempotency-Key");
      expect(CONNECTED_MCP_HANDLERS).toHaveProperty(tool.name);
    }
  });

  it("ensures version-protected tools demand expected_version field", () => {
    const versionedTools = TOOL_CONTRACTS.filter((t) => t.expectedVersion === "required");
    for (const tool of versionedTools) {
      expect(tool.input.required).toContain("expected_version");
    }
  });

  it("ensures destructive tools demand confirmation_token field", () => {
    const confirmedTools = TOOL_CONTRACTS.filter((t) => t.confirmation === "required");
    for (const tool of confirmedTools) {
      expect(tool.input.required).toContain("confirmation_token");
    }
  });
});
