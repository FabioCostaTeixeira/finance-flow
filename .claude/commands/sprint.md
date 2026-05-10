# Sprint — Pipeline Completo de Desenvolvimento

Você é o orquestrador do ciclo completo de desenvolvimento do Finance Flow.

Ao ser invocado, execute as fases abaixo **em sequência**, pausando apenas nos dois checkpoints humanos indicados.

---

## Fase 1 — Auditoria de Código

Execute a auditoria completa conforme definido no skill `auditoria`:

1. Leia todos os grupos de arquivos em paralelo:
   - **Hooks** (`src/hooks/`): todos os `.ts` e `.tsx`
   - **Páginas** (`src/pages/`): todos os `.tsx`
   - **Componentes** (`src/components/`): todos os `.tsx` (exceto `ui/`)
   - **Contextos** (`src/contexts/`): todos os arquivos
   - **Lib** (`src/lib/`): todos os arquivos
   - **Integrações** (`src/integrations/supabase/client.ts`)
   - **MCP Server** (`mcp/src/index.ts`)
   - **Env e config** (`.env`, `vite.config.ts`)

2. Execute a auditoria completa (segurança, variáveis de ambiente, código morto, padrões, qualidade, performance, robustez, testes).

3. Gere o relatório estruturado (Resumo Executivo, Críticos, Melhorias, Sugestões, Testes, Testes de Interface, Top 5).

4. **Antes de criar qualquer arquivo de backlog**, liste os existentes em:
   - `backlog/correcoes/`
   - `backlog/melhorias/`
   - `backlog/ideias/`

5. Crie **apenas** os arquivos de backlog para achados que:
   - NÃO existam já no backlog (verificar por slug e título)
   - Tenham `status: open` no frontmatter (campo obrigatório)

   Formato do frontmatter:
   ```
   ---
   titulo: ...
   tipo: correcao | melhoria | ideia
   prioridade: alta | media | baixa
   esforco: rapido | medio | grande
   arquivo: src/...
   origem: auditoria
   status: open
   data: YYYY-MM-DD
   ---
   ```

6. Informe: "Auditoria concluída. X novos itens no backlog (Y críticos, Z melhorias, W ideias). N já existiam e foram ignorados."

---

## CHECKPOINT 1 — Aprovar Backlog

Apresente ao usuário:
- Resumo dos novos itens criados no backlog (título + prioridade)
- Resumo dos itens já existentes (ignorados)

> **Os itens acima serão enviados ao PMO para criação de cards no Trello.**
> Aprovar? Responda "sim" para continuar ou indique ajustes.

**Aguarde confirmação antes de avançar.**

---

## Fase 2 — PMO: Estruturar e Publicar no Trello

1. Leia **todos** os arquivos `.md` das pastas de backlog que tenham `status: open`:
   - `backlog/correcoes/*.md`
   - `backlog/melhorias/*.md`
   - `backlog/ideias/*.md`

2. Agrupe os itens em estrutura **Epic > Feature > UserStory** conforme o template do squad `pmo-backlog`:
   - 1 Epic por sprint (nomeado com a data e tema)
   - Features por área temática (Correções Críticas, Melhorias de Cache, Testes, etc.)
   - 1 UserStory por item do backlog

3. Para cada UserStory, produza descrição completa com:
   - 🎯 Objetivo, 📦 Escopo, ✅ Checklist de Tarefas, 🏁 Critérios de Aceite

4. Salve o backlog estruturado em:
   `../Agents ASC/squads/pmo-backlog/output/{YYYY-MM-DD-HHMMSS}/v1/backlog.yaml`

5. Crie o board no Trello com o nome do Epic.

6. Crie 1 lista por Feature e 1 card por UserStory com a descrição completa.

7. Registre o link do board criado.

8. Informe: "PMO concluído. Board criado com X features e Y cards: [URL]"

---

## CHECKPOINT 2 — Aprovar Ordem de Execução

Apresente ao usuário a fila priorizada (por impacto e dependências):

```
Ordem de execução proposta:
1. [US-X.X] — título — motivo da prioridade
2. ...
```

> **O Scrum Master irá delegar ao dev-agent nesta ordem.**
> Aprovar? Responda "sim" para iniciar ou indique alterações.

**Aguarde confirmação antes de avançar.**

---

## Fase 3 — Scrum Master + Dev Agent

Execute o loop de implementação até zerar a fila:

### A cada iteração:

1. **Verificar código atual** — antes de implementar, confirmar se a task já está resolvida no código.
   - Se já resolvida: marcar como `done` no Trello, atualizar `status: done` no `.md` do backlog, seguir para a próxima.
   - Se pendente: implementar.

2. **Implementar:**
   - Ler o arquivo alvo
   - Aplicar a correção/melhoria
   - Verificar que não há regressões (TypeScript, testes existentes)

3. **Atualizar Trello:**
   - Mover card para `Concluído` (done) ou `Blocked` (bloqueado)

4. **Atualizar `.md` do backlog:**
   - Alterar `status: open` para `status: done` no arquivo de backlog correspondente

5. **Informar:**
   > `[Scrum Master]` Task `US-X.X` — {done|blocked}. Card atualizado no Trello.

6. Avançar para a próxima task.

### Regras do loop:
- Nunca implementar mais de uma task simultaneamente
- Se blocked: registrar motivo, informar usuário, avançar para a próxima
- Ao encerrar: emitir relatório final (done / blocked / ignoradas)

---

## Relatório Final

Ao concluir todas as tasks:

```
## Sprint Concluída

Board: [nome] — [URL]

| Task | Título | Status | Observação |
|------|--------|--------|-----------|
| ... | ... | ✅ done | ... |

Total: X done | Y blocked | Z já implementadas
```

---

**Regra especial:** qualquer task envolvendo lógica de roles, RLS ou permissões deve ser pausada e validada com o usuário antes de implementar.
