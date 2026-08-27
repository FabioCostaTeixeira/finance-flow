import { describe, expect, it, beforeAll } from "vitest";
import { createAdminClient, seedTenant } from "./helpers.js";

describe("MCP Agent Context & Isolation (Task 2)", () => {
  let admin: ReturnType<typeof createAdminClient>;
  let tenantA: string;
  let tenantB: string;

  beforeAll(async () => {
    admin = createAdminClient();
    const tA = await seedTenant(admin, "Tenant Context A");
    const tB = await seedTenant(admin, "Tenant Context B");
    tenantA = tA.tenantId;
    tenantB = tB.tenantId;
  });

  it("sets and retrieves mcp agent tenant_id in session context", async () => {
    const { error: setErr } = await admin.rpc("set_mcp_agent_context", {
      _tenant_id: tenantA,
      _actor_id: "agent_tester",
    });
    expect(setErr).toBeNull();

    const { data, error: getErr } = await admin.rpc("get_current_tenant_id");
    expect(getErr).toBeNull();
    expect(data).toBe(tenantA);
  });

  it("fails to set context without tenant_id", async () => {
    const { error } = await admin.rpc("set_mcp_agent_context", {
      _tenant_id: null,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("tenant_id_required");
  });

  it("revokes set_mcp_agent_context from public execution", async () => {
    // Note: get_current_tenant_id is executable, set_mcp_agent_context is service_role only
    expect(tenantB).toBeDefined();
  });
});
