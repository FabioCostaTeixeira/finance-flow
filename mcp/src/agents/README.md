# Multi-Agent CFO System — Configurações de Agentes

Arquivos de configuração do sistema multi-agente CFO do Finance Flow.

## Arquitetura

```
CFO Digital (Orquestrador)
├── Controller Digital     — validação, classificação, auditoria
├── Treasurer Digital      — saldo, pagamentos, transferências
├── FP&A Digital          — análise, comparação, projeção
└── Analista Financeiro   — CRUD de lançamentos e baixas
```

## Arquivos

| Arquivo               | Descrição                                         |
|-----------------------|---------------------------------------------------|
| `cfo.config.ts`       | Prompt e tools do CFO — orquestrador principal    |
| `controller.config.ts`| Prompt e tools do Controller — validação/auditoria|
| `treasurer.config.ts` | Prompt e tools do Treasurer — caixa e pagamentos  |
| `fpa.config.ts`       | Prompt e tools do FP&A — análise e projeção       |
| `analista.config.ts`  | Prompt e tools do Analista — operações de CRUD    |
| `risk-map.ts`         | Mapa de risco por tool — define o que exige confirmação |
| `memory.ts`           | Memória persistida por agente via Supabase        |
| `planner.ts`          | Executor de planos multi-step com DAG de dependências |

## Como Usar

### 1. CFO como dispatcher

```typescript
import { CFO_SYSTEM_PROMPT, CFO_TOOLS } from "./agents/cfo.config.js";
// Passe CFO_SYSTEM_PROMPT como system prompt do agente Claude
// Restrinja as tools disponíveis a CFO_TOOLS
```

### 2. Verificar risco antes de executar

```typescript
import { requiresConfirmation, getRisk } from "./agents/risk-map.js";

if (requiresConfirmation("excluir_lancamento")) {
  // Apresentar preview ao usuário e aguardar confirmação
}
```

### 3. Memória de agente

```typescript
import { saveMemory, buildContextBlock } from "./agents/memory.js";

// Salvar preferência
await saveMemory("cfo", "moeda_preferida", "BRL");

// Injetar no prompt
const contexto = await buildContextBlock("cfo");
const promptFinal = CFO_SYSTEM_PROMPT + contexto;
```

### 4. Plano multi-step

```typescript
import { createPlan, getNextStep, markStep } from "./agents/planner.js";

const plan = createPlan("Processar folha de pagamento", [
  { id: "1", description: "Listar funcionários", tool: "listar_lancamentos", args: { categoria_nome: "Folha" } },
  { id: "2", description: "Baixar cada lançamento", tool: "baixar_lancamento", args: {}, depends_on: ["1"] },
]);
```

## Migração Necessária (Supabase)

Para habilitar memória de agentes, execute no painel do Supabase:

```sql
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
```
