# Finance Flow — CLAUDE.md

Sistema de gestão financeira pessoal/empresarial com suporte a lançamentos, fluxo de caixa, categorias hierárquicas, integração com Telegram, e controle de acesso por roles. **A IA embutida no app foi descontinuada** — todo acesso de IA a dados financeiros é feito externamente via servidor MCP (`mcp/`).

---

## Stack

- **Frontend:** React 18 + Vite + TypeScript
- **UI:** Tailwind CSS + shadcn/ui (Radix UI) + Framer Motion
- **Estado/Cache:** TanStack React Query v5
- **Formulários:** React Hook Form + Zod
- **Roteamento:** React Router DOM v6
- **Gráficos:** Recharts
- **Backend:** Supabase (PostgreSQL + Auth + RLS + Storage)
- **Deploy:** Vercel

---

## Comandos

```bash
npm run dev      # inicia o servidor de desenvolvimento
npm run build    # build de produção
npm run lint     # ESLint
npm run preview  # preview do build local
```

O projeto tem `bun.lock` — o package manager principal é **bun**, mas `npm` também funciona.

---

## Variáveis de ambiente

**Frontend** (`.env` na raiz de `finance-flow/`):
```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

**MCP Server** (`mcp/`):
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=   # chave de service role — nunca expor no frontend
```

> O `.gitignore` atual não bloqueia `.env` explicitamente, apenas `*.local`. Nunca commitar o `.env` com credenciais reais.

---

## Estrutura do projeto

```
finance-flow/
├── src/
│   ├── components/        # componentes reutilizáveis
│   │   └── ui/            # componentes shadcn/ui (não editar diretamente)
│   ├── contexts/          # AuthContext (user, session, role)
│   ├── hooks/             # toda lógica de fetch/mutação de dados
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts  # instância do supabase (não editar)
│   │       └── types.ts   # tipos gerados automaticamente (não editar)
│   ├── lib/               # utilitários (datas, recorrência, status)
│   └── pages/             # uma página por rota
├── mcp/                   # servidor MCP externo — único caminho de acesso de IA a dados financeiros
│   └── src/index.ts
└── public/
```

---

## Páginas e rotas

| Página | Descrição |
|---|---|
| `Auth` | Login com email/senha via Supabase Auth |
| `Receitas` | Lançamentos do tipo receita |
| `Despesas` | Lançamentos do tipo despesa |
| `FluxoCaixa` | Visão consolidada de entradas e saídas |
| `Bancos` | Cadastro de contas bancárias |
| `Categorias` | Categorias com hierarquia pai/filho |
| `TelegramBot` | Configuração da integração Telegram |
| `ApiKeys` | Gerenciamento de chaves de API externas |
| `Usuarios` | Gerenciamento de permissões de usuários |

---

## Banco de dados (Supabase)

Tabelas principais:
- **`lancamentos`** — transações financeiras (receitas e despesas). Campos-chave: `tipo`, `status`, `valor`, `data_vencimento`, `data_pagamento`, `banco_id`, `categoria_id`, `recorrencia_id`, `frequencia`, `parcela_atual`, `total_parcelas`
- **`bancos`** — contas bancárias
- **`categorias`** — hierarquia de categorias (`categoria_pai_id` auto-referencia)
- **`tenants`**, **`tenant_members`**, **`platform_operators`** — organizações, papéis por organização e operadores isolados
- **`audit_log`** — trilha de alterações por tenant
- **`profiles`** — dados de perfil dos usuários
- **`api_keys`** — chaves de acesso externo
- **`api_access_logs`** — log de acessos por API key
- **`messaging_channels`** — pareamento de canais de mensageria (Telegram)
- **`agent_memory`** — memória usada pelo servidor MCP externo (`mcp/`), não pelo frontend

Enums relevantes:
- `tipo_lancamento`: `receita | despesa`
- `status_lancamento`: `a_receber | recebido | a_pagar | pago | parcial | atrasado | vencida | transferencia`

Migrations: toda alteração vai por arquivo versionado em `supabase/migrations/`; nunca aplicar schema diretamente no painel.

---

## Autenticação e roles

O sistema tem três roles por tenant, em `tenant_members.role`, com autorização aplicada no banco por `can_access`:

| Role | Acesso |
|---|---|
| `master` | Acesso total, incluindo configurações de sistema |
| `admin` | Acesso operacional completo |
| `user` | Acesso restrito conforme permissões configuradas |

**Regra crítica:** qualquer alteração em lógica de permissões, RLS do Supabase ou roles **deve ser validada com o usuário antes de implementar**. Nunca alterar essas regras sem confirmação explícita.

---

## Integrações

| Integração | Status |
|---|---|
| Telegram Bot | Em validação |
| AI Chat interno (app) | **Descontinuado** — chat de IA embutido no app, edge functions `chat`/`ai-router`/`agent` e tabelas `chat_messages`/`ai_settings` foram removidos |
| MCP Server (Supabase + IA) | Ativo em `mcp/` — único caminho de acesso externo de IA a dados financeiros |
| WhatsApp | Planejado |

O MCP server em `mcp/src/index.ts` expõe ferramentas como `listar_lancamentos` para agentes de IA consumirem dados financeiros via service role key. Não há mais nenhum agente/chat de IA rodando dentro do app — qualquer integração de IA deve consumir dados via MCP externo.

---

## Padrões de código

- Lógica de fetch e mutação fica nos **hooks** (`src/hooks/`) — nunca direto nas páginas
- Componentes de UI genéricos ficam em `src/components/ui/` (shadcn — não editar)
- Componentes de negócio ficam em `src/components/`
- Importações usam alias `@/` para `src/`
- Nomes de arquivos e variáveis de domínio em **português** (ex: `lancamentos`, `categorias`, `bancos`)
- **Testes:** ao finalizar qualquer feature, escrever todos os testes possíveis (unitários, integração, componentes). Ainda a definir o framework de testes (Vitest é o natural para projetos Vite/React)
- Antes de merge que toque em policies/RLS, rode `npm run test:rls`.

---

## O que não fazer

- Não editar `src/integrations/supabase/client.ts` ou `types.ts` manualmente — são gerados pelo Supabase
- Não expor `SUPABASE_SERVICE_ROLE_KEY` no frontend
- Não alterar lógica de roles/permissões/RLS sem validação dupla com o usuário
- Não commitar o arquivo `.env`
- Não entregar uma feature sem escrever os testes correspondentes
