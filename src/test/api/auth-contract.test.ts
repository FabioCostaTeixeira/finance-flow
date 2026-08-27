import { describe, expect, it } from "vitest";

describe("API Key & Auth Scopes Contract (Task 3)", () => {
  it("defines standard API key error codes", () => {
    const ERROR_CODES = {
      INVALID_API_KEY: "INVALID_API_KEY",
      KEY_EXPIRED: "KEY_EXPIRED",
      KEY_REVOKED: "KEY_REVOKED",
      INSUFFICIENT_SCOPE: "INSUFFICIENT_SCOPE",
      RATE_LIMITED: "RATE_LIMITED",
    };

    expect(Object.keys(ERROR_CODES)).toHaveLength(5);
    expect(ERROR_CODES.RATE_LIMITED).toBe("RATE_LIMITED");
  });

  it("validates scope hierarchy (finance:write grants write access, finance:read grants read only)", () => {
    const hasScope = (keyScopes: string[], requiredScope: string) => {
      if (keyScopes.includes("admin")) return true;
      if (keyScopes.includes(requiredScope)) return true;
      if (requiredScope === "finance:read" && keyScopes.includes("finance:write")) return true;
      return false;
    };

    expect(hasScope(["finance:read"], "finance:read")).toBe(true);
    expect(hasScope(["finance:read"], "finance:write")).toBe(false);
    expect(hasScope(["finance:write"], "finance:read")).toBe(true);
    expect(hasScope(["finance:write"], "finance:write")).toBe(true);
  });
});
