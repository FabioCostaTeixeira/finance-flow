import { describe, expect, it } from "vitest";
import { parseCanonicalDecimal, formatBRL } from "../../../mcp/src/contracts/money.ts";

describe("Cross-Cutting Monetary & Error Contracts (Task 5)", () => {
  it("parses valid canonical decimal strings", () => {
    expect(parseCanonicalDecimal("41.24")).toBe("41.24");
    expect(parseCanonicalDecimal("100")).toBe("100.00");
    expect(parseCanonicalDecimal(50.5)).toBe("50.50");
  });

  it("rejects invalid monetary inputs (zero, negative, comma, scientific notation, NaN, infinity)", () => {
    expect(() => parseCanonicalDecimal("0")).toThrow("greater than zero");
    expect(() => parseCanonicalDecimal("-10.00")).toThrow("greater than zero");
    expect(() => parseCanonicalDecimal("41,24")).toThrow("canonical decimal");
    expect(() => parseCanonicalDecimal("1e3")).toThrow("canonical decimal");
    expect(() => parseCanonicalDecimal(NaN)).toThrow("not NaN");
    expect(() => parseCanonicalDecimal(Infinity)).toThrow("finite");
  });

  it("formats decimal string to BRL currency", () => {
    const formatted = formatBRL("41.24");
    expect(formatted).toContain("41,24");
  });
});

