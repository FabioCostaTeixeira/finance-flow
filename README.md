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
- `vercel.json` regra de rewrite para SPA

## Observacao sobre MCP

O diretorio `mcp/` fica separado do fluxo principal do app web. Ele contem um servidor MCP experimental/auxiliar e nao faz parte da execucao normal do Finance Flow no navegador.
