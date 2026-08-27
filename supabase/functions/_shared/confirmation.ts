import { createHash, randomBytes } from "node:crypto";

export interface ConfirmationTokenPayload {
  tenantId: string;
  operation: string;
  payloadHash: string;
  ttlSeconds?: number;
}

export function generateConfirmationToken(payload: ConfirmationTokenPayload): {
  rawToken: string;
  tokenHash: string;
  expiresAt: string;
} {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const ttl = payload.ttlSeconds ?? 300; // 5 minutos por padrão
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  return { rawToken, tokenHash, expiresAt };
}

export function verifyConfirmationTokenHash(rawToken: string, expectedHash: string): boolean {
  const hash = createHash("sha256").update(rawToken).digest("hex");
  return hash === expectedHash;
}
