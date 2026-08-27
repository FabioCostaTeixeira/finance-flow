import { describe, expect, it } from "vitest";
import { generateConfirmationToken, verifyConfirmationTokenHash } from "../../../supabase/functions/_shared/confirmation.js";

describe("Task 14 - Confirmation Tokens & Batch Safety", () => {
  it("generates cryptographically secure single-use confirmation tokens", () => {
    const res = generateConfirmationToken({
      tenantId: "11111111-1111-4111-8111-111111111111",
      operation: "excluir_lancamento",
      payloadHash: "abc123hash",
      ttlSeconds: 300,
    });

    expect(res.rawToken).toHaveLength(64);
    expect(res.tokenHash).toHaveLength(64);
    expect(verifyConfirmationTokenHash(res.rawToken, res.tokenHash)).toBe(true);
  });

  it("fails verification for altered or invalid token strings", () => {
    const res = generateConfirmationToken({
      tenantId: "11111111-1111-4111-8111-111111111111",
      operation: "excluir_lancamento",
      payloadHash: "abc123hash",
    });

    expect(verifyConfirmationTokenHash("invalid_token", res.tokenHash)).toBe(false);
  });
});
