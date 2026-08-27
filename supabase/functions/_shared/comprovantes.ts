export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9_.-]/g, "_")
    .replace(/\.{2,}/g, ".")
    .substring(0, 255);
}

export function validateComprovanteMetadata(
  filename: string,
  mimeType: string,
  sizeBytes: number
): { valid: boolean; reason?: string } {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { valid: false, reason: `MIME type não permitido: ${mimeType}` };
  }
  if (sizeBytes <= 0 || sizeBytes > MAX_FILE_SIZE_BYTES) {
    return { valid: false, reason: `Tamanho inválido: ${sizeBytes} bytes (máx 10MB)` };
  }
  if (!filename || filename.trim().length === 0) {
    return { valid: false, reason: "Nome de arquivo inválido" };
  }
  return { valid: true };
}

export function buildTenantStoragePath(tenantId: string, hashSha256: string, sanitizedFilename: string): string {
  return `tenants/${tenantId}/${hashSha256}_${sanitizedFilename}`;
}
