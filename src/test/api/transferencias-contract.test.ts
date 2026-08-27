import { describe, expect, it } from "vitest";

export function validateTransferAccounts(bancoOrigemId: string, bancoDestinoId: string): { valid: boolean; reason?: string } {
  if (bancoOrigemId === bancoDestinoId) {
    return { valid: false, reason: "Banco de origem e destino devem ser diferentes" };
  }
  return { valid: true };
}

describe("Task 9 - Atomic Transfer Contracts", () => {
  it("prevents transfer between identical origin and destination accounts", () => {
    const bankId = "11111111-1111-4111-8111-111111111111";
    const res = validateTransferAccounts(bankId, bankId);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain("diferentes");
  });

  it("accepts transfer between distinct accounts", () => {
    const bankA = "11111111-1111-4111-8111-111111111111";
    const bankB = "22222222-2222-4222-8222-222222222222";
    expect(validateTransferAccounts(bankA, bankB).valid).toBe(true);
  });
});
