import { MCP_TOOL_CONTRACT_VERSION, TOOL_CONTRACTS } from "./tools.js";

export interface HealthCheckResult {
  status: "ok" | "degraded" | "unhealthy";
  api_version: string;
  schema_version: string;
  timestamp: string;
  tenant_id?: string;
  request_id?: string;
}

export function getHealthStatus(tenantId?: string, requestId?: string): HealthCheckResult {
  return {
    status: "ok",
    api_version: "1.0.0",
    schema_version: MCP_TOOL_CONTRACT_VERSION,
    timestamp: new Date().toISOString(),
    tenant_id: tenantId,
    request_id: requestId,
  };
}

export function getPublicCapabilities(scopes: string[]) {
  const isWriteAllowed = scopes.includes("admin") || scopes.includes("finance:write");
  const isReadAllowed = isWriteAllowed || scopes.includes("finance:read");

  return {
    mcp_version: MCP_TOOL_CONTRACT_VERSION,
    scopes,
    capabilities: {
      read_tools: isReadAllowed,
      write_tools: isWriteAllowed,
      batch_simulation: isWriteAllowed,
      attachments: isReadAllowed,
      audit_query: scopes.includes("admin"),
    },
    tools_count: TOOL_CONTRACTS.filter((t) => t.scopes.some((s) => scopes.includes(s) || scopes.includes("admin"))).length,
  };
}
