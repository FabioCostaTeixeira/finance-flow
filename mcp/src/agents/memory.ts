import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export interface AgentMemory {
  agent: string;
  key: string;
  value: string;
  updated_at: string;
}

export async function saveMemory(agent: string, key: string, value: string): Promise<void> {
  await supabase.from("agent_memory").upsert(
    { agent, key, value, updated_at: new Date().toISOString() },
    { onConflict: "agent,key" },
  );
}

export async function getMemory(agent: string, key?: string): Promise<AgentMemory[]> {
  let q = supabase.from("agent_memory").select("*").eq("agent", agent);
  if (key) q = q.eq("key", key);
  const { data } = await q;
  return (data ?? []) as AgentMemory[];
}

export async function buildContextBlock(agent: string): Promise<string> {
  const memories = await getMemory(agent);
  if (memories.length === 0) return "";
  const lines = memories.map((m) => `- ${m.key}: ${m.value}`).join("\n");
  return `\n## Contexto Persistido (${agent})\n${lines}\n`;
}

export const MEMORY_MIGRATION = `
-- Execute no painel do Supabase para habilitar memória de agentes
CREATE TABLE IF NOT EXISTS agent_memory (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent       TEXT NOT NULL,
  key         TEXT NOT NULL,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent, key)
);

ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON agent_memory USING (auth.role() = 'service_role');
`;
