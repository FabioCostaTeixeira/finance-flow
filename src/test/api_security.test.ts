import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";

describe("api_security_unit", () => {
  function hashApiKey(key: string): string {
    return createHash("sha256").update(key).digest("hex");
  }

  function semTenantDoPayload(body: Record<string, unknown>) {
    const { tenant_id: _ignorado, user_id: _ignoradoUser, created_by: _ignoradoCreated, ...rest } = body;
    return rest;
  }

  it("calcula hash SHA-256 correto para API key", () => {
    const key = "ff_live_test_123456789";
    const hash = hashApiKey(key);
    expect(hash).toHaveLength(64);
    expect(hashApiKey(key)).toBe(hash);
    expect(hashApiKey(key + "x")).not.toBe(hash);
  });

  it("semTenantDoPayload remove campos de injeção de ator e tenant", () => {
    const payload = {
      cliente_credor: "Fornecedor X",
      valor: 150.50,
      tenant_id: "tenant-hack-uuid",
      user_id: "user-hack-uuid",
      created_by: "created-hack-uuid",
      observacao: "Teste",
    };

    const limpo = semTenantDoPayload(payload);
    expect(limpo).toEqual({
      cliente_credor: "Fornecedor X",
      valor: 150.50,
      observacao: "Teste",
    });
    expect(limpo).not.toHaveProperty("tenant_id");
    expect(limpo).not.toHaveProperty("user_id");
    expect(limpo).not.toHaveProperty("created_by");
  });
});
