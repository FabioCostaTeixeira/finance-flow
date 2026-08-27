import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

export function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map((item) => canonicalizeJson(item)).join(",")}]`;
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${canonicalizeJson((obj as Record<string, unknown>)[key])}`);
  return `{${entries.join(",")}}`;
}

export function computePayloadHash(payload: unknown): string {
  return createHash("sha256").update(canonicalizeJson(payload)).digest("hex");
}

export function verifyVersionMatch(currentVersion: number, expectedVersion: number): boolean {
  return currentVersion === expectedVersion;
}

describe("Task 6 - Idempotency & Versioning Utilities", () => {
  it("produces identical SHA-256 hash regardless of object key insertion order", () => {
    const payloadA = { b: 2, a: "10.50", c: [3, { z: "x", y: "w" }] };
    const payloadB = { a: "10.50", c: [3, { y: "w", z: "x" }], b: 2 };

    const hashA = computePayloadHash(payloadA);
    const hashB = computePayloadHash(payloadB);

    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^[a-f0-9]{64}$/);
  });

  it("differentiates payloads with different field values", () => {
    const payloadA = { valor: "100.00", descricao: "Teste A" };
    const payloadB = { valor: "100.00", descricao: "Teste B" };

    expect(computePayloadHash(payloadA)).not.toBe(computePayloadHash(payloadB));
  });

  it("strictly enforces optimistic lock version check", () => {
    expect(verifyVersionMatch(1, 1)).toBe(true);
    expect(verifyVersionMatch(2, 1)).toBe(false);
  });
});
