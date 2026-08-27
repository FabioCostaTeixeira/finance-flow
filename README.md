# Finance Flow

Sistema de gestao financeira web construido com React + Vite + TypeScript.

## Tecnologias

- React 18
- Vite 5
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase

## Requisitos

- Node.js 18+ (recomendado Node.js 20+)
- npm 9+

## Executar localmente

```sh
git clone https://github.com/FabioCostaTeixeira/finance-flow.git
cd finance-flow-main
npm install
npm run dev
```

Aplicacao local: `http://localhost:8080`

## Suite de Testes e Qualidade

```sh
# Testes unitarios e de contrato do frontend/backend
npm run test:unit

# Testes de isolamento RLS do Supabase
npm run test:rls

# Linting e verificacao de tipos
npm run lint

# Build de producao
npm run build
```

## Servidor MCP (Model Context Protocol)

O diretorio `mcp/` contem o servidor MCP para integracao com agentes de IA.

```sh
cd mcp
npm install
npx vitest run --config vitest.contracts.config.ts
```

Limites e Invariantes MCP:
- Rate limit por chave: 120 req/min (429 em excesso).
- Tamanho maximo de lote (`executar_lote`): 250 itens.
- Idempotencia atomica obrigatoria em operacoes de escrita via cabeçalho `Idempotency-Key`.
- Versionamento otimista obrigatorio via `expected_version`.
- Confirmacao tokenizada de uso unico (`confirmation_token`) para operacoes destrutivas/lote.

## Build de producao

```sh
npm run build
npm run preview
```

## Deploy na Vercel

Este projeto usa `BrowserRouter`, entao precisa de rewrite SPA para evitar 404 em rotas internas.

O arquivo [`vercel.json`](./vercel.json) ja esta configurado:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Configuracao recomendada na Vercel:

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

## Variaveis de ambiente

Crie um arquivo `.env` na raiz com as variaveis necessarias do Supabase.

Exemplo:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Estrutura principal

- `src/` codigo fonte da aplicacao
- `public/` arquivos estaticos
- `supabase/` funcoes e migracoes
- `mcp/` servidor MCP externo e testes de contrato
- `vercel.json` regra de rewrite para SPA
