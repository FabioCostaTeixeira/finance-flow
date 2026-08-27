import { describe, expect, it } from "vitest";
import { getHealthStatus, getPublicCapabilities } from "../../../mcp/src/contracts/discovery.ts";

describe("Discovery & Health Contract (Task 4)", () => {
  it("generates health check payload without internal secrets", () => {
    const health = getHealthStatus("tenant-123", "req-456");
    expect(health.status).toBe("ok");
    expect(health.tenant_id).toBe("tenant-123");
    expect(health.request_id).toBe("req-456");
    expect(health.api_version).toBe("1.0.0");
    expect(health).not.toHaveProperty("db_connection");
    expect(health).not.toHaveProperty("service_role_key");
  });

  it("filters capabilities based on granted scopes", () => {
    const readOnlyCaps = getPublicCapabilities(["finance:read"]);
    expect(readOnlyCaps.capabilities.read_tools).toBe(true);
    expect(readOnlyCaps.capabilities.write_tools).toBe(false);
    expect(readOnlyCaps.capabilities.batch_simulation).toBe(false);

    const writeCaps = getPublicCapabilities(["finance:write"]);
    expect(writeCaps.capabilities.read_tools).toBe(true);
    expect(writeCaps.capabilities.write_tools).toBe(true);
    expect(writeCaps.capabilities.batch_simulation).toBe(true);
  });
});

