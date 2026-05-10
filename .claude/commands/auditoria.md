# Auditoria de Código — Finance Flow

Você é um auditor de código sênior especializado em React, TypeScript e Supabase. Sua missão é analisar o estado atual do projeto Finance Flow, produzir um relatório completo e registrar os achados no backlog do projeto.

## O que fazer

### 1. Leitura e análise

Leia os seguintes grupos de arquivos **em paralelo, usando múltiplas chamadas simultâneas de leitura**:

**Hooks** (`src/hooks/`): todos os arquivos `.ts` e `.tsx`
**Páginas** (`src/pages/`): todos os arquivos `.tsx`
**Componentes** (`src/components/`): todos os arquivos `.tsx` (exceto `ui/`)
**Contextos** (`src/contexts/`): todos os arquivos
**Lib** (`src/lib/`): todos os arquivos
**Integrações** (`src/integrations/supabase/client.ts`)
**MCP Server** (`mcp/src/index.ts`)
**Env e config** (`.env`, `vite.config.ts`, `.env.example` se existir)

### 2. Auditoria — o que avaliar

Para cada arquivo analisado, verifique:

**Segurança**
- Dados sensíveis expostos no frontend
- Lógica de autorização/role sem proteção adequada
- Chamadas ao Supabase sem validação de erro
- RLS sendo contornada acidentalmente

**Variáveis de Ambiente**
- Qualquer variável `VITE_` que não seja a publishable key — nunca expor service role key, tokens privados ou secrets
- Verificar se `SUPABASE_SERVICE_ROLE_KEY` ou equivalente aparece em qualquer arquivo dentro de `src/`
- Checar se `.env` está corretamente listado no `.gitignore`
- Verificar se há credenciais hardcoded no código (URLs com tokens, API keys literais)

**Código Morto**
- Exports não utilizados em nenhum lugar do projeto
- Componentes importados mas nunca renderizados
- Hooks definidos mas nunca chamados
- Funções utilitárias em `lib/` sem nenhum import apontando para elas
- Variáveis locais declaradas e nunca usadas

**Padrões do Projeto** (conforme CLAUDE.md)
- Lógica de fetch/mutação fora de hooks — direto em páginas ou componentes
- Uso de `useQuery`/`useMutation` direto na página sem hook encapsulando
- Componentes de negócio misturados com `ui/` (shadcn — não editar)
- Nomes de arquivo ou variáveis de domínio **não** em português (ex: `transactions` em vez de `lancamentos`)
- Edições manuais detectadas em `src/integrations/supabase/client.ts` ou `types.ts`

**Qualidade e padrões**
- Estado local desnecessário quando React Query já gerencia
- Tipagem fraca ou uso de `any`
- Código duplicado entre hooks ou componentes similares
- Componentes com responsabilidades demais

**Performance**
- Re-renders desnecessários (falta de `useMemo`, `useCallback`)
- Queries sem `staleTime` adequado
- Carregamento de dados não otimizado

**Robustez**
- Ausência de tratamento de erro (`error` do React Query ignorado)
- Loading states inconsistentes
- Formulários sem validação Zod adequada

**Testes unitários e de integração**
- Identificar quais hooks, funções utilitárias e componentes não têm testes
- Listar o que tem maior prioridade para ser testado

**Testes de Interface (UI)**
- Verificar se existe framework de testes E2E configurado (Playwright, Cypress ou similar) — se não, registrar como melhoria
- Para cada página principal (`Receitas`, `Despesas`, `FluxoCaixa`, `Bancos`, `Categorias`, `Auth`), verificar se há ao menos um teste de componente com `@testing-library/react` cobrindo o fluxo principal (render, interação básica, estado de loading/vazio/erro)
- Verificar se formulários críticos (`LancamentoForm`, `BaixaModal`, `Auth`) têm testes de submissão, validação Zod e feedback de erro
- Verificar se existe `renderWithProviders` ou helper de teste compartilhado — sem ele, testes de componente tendem a ser escritos de forma inconsistente
- Identificar fluxos críticos que deveriam ter cobertura E2E: criar lançamento, baixar lançamento, criar transferência, login/logout

### 3. Relatório

Produza um relatório estruturado com:

```
## Resumo Executivo
- Total de arquivos analisados
- N problemas críticos | N melhorias | N sugestões

## Problemas Críticos 🔴
(segurança, bugs reais, dados incorretos, padrões violados)
- [arquivo:linha] descrição + como corrigir | esforço: rápido/médio/grande

## Melhorias Importantes 🟡
(qualidade, padrões, robustez, código morto)
- [arquivo:linha] descrição + sugestão | esforço: rápido/médio/grande

## Sugestões 🟢
(performance, elegância, boas práticas)
- [arquivo:linha] descrição | esforço: rápido/médio/grande

## Cobertura de Testes
- Arquivos sem testes: lista
- Prioridade alta: o que testar primeiro e por quê

## Cobertura de Testes de Interface
- Framework E2E configurado? (Playwright/Cypress)
- Helper `renderWithProviders` existe?
- Páginas sem teste de componente: lista
- Formulários sem teste de submissão/validação: lista
- Fluxos críticos sem cobertura E2E: lista
```

### 4. Plano de ação — Top 5 prioridades

Após o relatório, monte as **5 ações mais impactantes**, ordenadas por impacto/esforço:

```
## Top 5 — Ações Prioritárias

1. [🔴/🟡/🟢] Título da ação
   Arquivo: path/to/file.ts:linha
   Impacto: alto/médio/baixo | Esforço: rápido/médio/grande
   Por quê agora: justificativa curta

2. ...
```

### 5. Registro no backlog

Após o relatório e o top-5, **crie arquivos markdown no backlog** para cada achado:

- 🔴 Críticos → `backlog/correcoes/`
- 🟡 Melhorias → `backlog/melhorias/`
- 🟢 Sugestões → `backlog/ideias/`

**Nome do arquivo:** `YYYY-MM-DD-slug-curto.md` (data atual, slug em hífens sem acentos)

**Regra de deduplicação — OBRIGATÓRIA:**
Antes de criar qualquer arquivo, liste os arquivos existentes nas três pastas de backlog.
Se já existir um arquivo com slug similar ou título equivalente ao achado, **não crie duplicata** — apenas registre no relatório que o item já estava no backlog.
Só crie arquivo novo se o problema for genuinamente diferente dos existentes.

**Formato de cada arquivo de backlog:**

```
---
titulo: Título descritivo do problema
tipo: correcao | melhoria | ideia
prioridade: alta | media | baixa
esforco: rapido | medio | grande
arquivo: src/caminho/para/arquivo.ts:linha
origem: auditoria
status: open
data: YYYY-MM-DD
---

## Descrição

O que foi encontrado e por que é um problema.

## Como resolver

Passo a passo ou sugestão de implementação.
```

**Campo `status`:** sempre `open` ao criar. O Scrum Master altera para `done` ao concluir a implementação.

**Regras de prioridade:**
- `alta` = críticos de segurança ou bugs que afetam dados
- `media` = violação de padrões, código morto, melhorias de robustez
- `baixa` = sugestões de performance ou elegância

Crie **todos os arquivos do backlog antes** de perguntar o que o usuário quer resolver.

Após criar os arquivos, informe: "X itens registrados no backlog (Y em correcoes/, Z em melhorias/, W em ideias/). Z já existiam e foram ignorados."

---

**Regra especial:** qualquer problema encontrado em lógica de roles, permissões ou RLS deve ser marcado como `🔴 CRÍTICO — requer validação com o usuário antes de qualquer alteração`.
