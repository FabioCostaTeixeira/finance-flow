---
titulo: SQL injection no MCP Server via interpolação de args.tipo
tipo: correcao
prioridade: alta
esforco: rapido
arquivo: mcp/src/index.ts:554
origem: auditoria
data: 2026-05-09
---

## Descrição

Três handlers no MCP Server constroem filtros SQL via interpolação direta de `args.tipo` (string controlada pelo chamador):

```ts
// handleRelatorioPorCategoria (~linha 554)
const tipoFilter = args.tipo ? `AND l.tipo = '${args.tipo}'` : "";

// handleCompararPeriodos (~linha 765)
const tipoFilter = args.tipo ? `AND tipo = '${args.tipo}'` : "";

// handleTopClientesCredores (~linha 814)
const tipoFilter = args.tipo ? `AND tipo = '${args.tipo}'` : "";
```

Embora o schema MCP declare `enum: ["receita", "despesa"]`, **não há validação server-side**. Um agente de IA mal-instruído ou um cliente direto pode passar `'; DROP TABLE lancamentos; --` como `tipo`.

O handler `executar_sql` já tem proteção (valida SELECT/WITH), mas os handlers de relatório não têm.

## Como resolver

Adicionar validação explícita antes de qualquer interpolação:

```ts
const TIPOS_VALIDOS = ["receita", "despesa"] as const;

function validarTipo(tipo: unknown): "receita" | "despesa" | null {
  if (tipo === "receita" || tipo === "despesa") return tipo;
  if (tipo != null) throw new Error(`tipo inválido: ${tipo}`);
  return null;
}
```

E substituir a interpolação por parametrização ou pelo guard acima nos três handlers afetados.
