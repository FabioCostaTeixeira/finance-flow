import { describe, expect, it } from "vitest";
import { ALLOWED_UPDATE_FIELDS, FORBIDDEN_UPDATE_FIELDS, validateLancamentoPatch } from "../../../supabase/functions/_shared/lancamento-rules.js";

describe("Task 8 - Lancamento Operations Rules", () => {
  it("rejects forbidden fields in PATCH payloads", () => {
    const res = validateLancamentoPatch({ status: "pago", descricao: "Hack" });
    expect(res.valid).toBe(false);
    expect(res.forbiddenKeys).toContain("status");
  });

  it("rejects unknown/unmapped fields", () => {
    const res = validateLancamentoPatch({ campo_invalido: "abc" });
    expect(res.valid).toBe(false);
    expect(res.forbiddenKeys).toContain("campo_invalido");
  });

  it("accepts valid allowlisted fields", () => {
    const res = validateLancamentoPatch({
      descricao: "Novo Nome",
      valor: "150.00",
      data_vencimento: "2026-09-01",
    });
    expect(res.valid).toBe(true);
    expect(res.forbiddenKeys).toHaveLength(0);
  });

  it("strictly holds forbidden set boundaries", () => {
    for (const forbidden of FORBIDDEN_UPDATE_FIELDS) {
      expect(ALLOWED_UPDATE_FIELDS.has(forbidden)).toBe(false);
    }
  });
});
