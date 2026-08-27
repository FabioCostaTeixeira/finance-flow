import { describe, expect, it } from "vitest";
import { buildTenantStoragePath, sanitizeFilename, validateComprovanteMetadata } from "../../../supabase/functions/_shared/comprovantes.js";

describe("Task 11 - Comprovante Validation & Path Safety", () => {
  it("sanitizes dangerous characters and prevents path traversal", () => {
    const raw = "../../../etc/passwd payload?.pdf";
    const clean = sanitizeFilename(raw);
    expect(clean).not.toContain("..");
    expect(clean).not.toContain("/");
    expect(clean).toBe("._._._etc_passwd_payload_.pdf");
  });

  it("validates allowed MIME types and max size", () => {
    expect(validateComprovanteMetadata("recibo.pdf", "application/pdf", 1024).valid).toBe(true);
    expect(validateComprovanteMetadata("foto.png", "image/png", 5000).valid).toBe(true);

    expect(validateComprovanteMetadata("script.exe", "application/x-msdownload", 1024).valid).toBe(false);
    expect(validateComprovanteMetadata("grande.pdf", "application/pdf", 20 * 1024 * 1024).valid).toBe(false);
  });

  it("builds strictly isolated tenant storage path", () => {
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    const path = buildTenantStoragePath(tenantId, hash, "recibo.pdf");

    expect(path).toBe(`tenants/${tenantId}/${hash}_recibo.pdf`);
    expect(path.startsWith(`tenants/${tenantId}/`)).toBe(true);
  });
});
