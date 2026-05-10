---
titulo: Código morto em recurrence.ts — formatDate e RecorrenciaConfig não usados
tipo: melhoria
prioridade: media
esforco: rapido
arquivo: src/lib/recurrence.ts:4
origem: auditoria
data: 2026-05-09
---

## Descrição

Dois exports em `src/lib/recurrence.ts` nunca são importados em nenhum arquivo do projeto:

1. **`RecorrenciaConfig` (interface, linha ~4)**:
   ```ts
   export interface RecorrenciaConfig {
     data_inicio: Date;
     frequencia: Frequencia;
     qtd_parcelas: number;
   }
   ```

2. **`formatDate` (função, linha ~108)**:
   ```ts
   export function formatDate(date: Date | string): string {
     const d = typeof date === 'string' ? new Date(date) : date;
     return new Intl.DateTimeFormat('pt-BR').format(d);
   }
   ```

Nenhum arquivo em `src/` importa esses dois exports. São relíquias de refatorações anteriores.

## Como resolver

Remover ambos de `recurrence.ts`. Verificar antes se existem testes para `formatDate` (os testes de `recorrencia.test.ts` criados na última sprint não cobrem ela) e deletar o teste correspondente se existir.
