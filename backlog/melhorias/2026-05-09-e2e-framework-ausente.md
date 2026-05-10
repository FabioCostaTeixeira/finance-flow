---
titulo: Configurar framework de testes E2E (Playwright ou Cypress)
tipo: melhoria
prioridade: media
esforco: grande
arquivo: package.json
origem: auditoria
data: 2026-05-09
---

## Descrição

Nenhum framework de testes E2E está configurado no projeto. Playwright e Cypress estão ausentes do `package.json`. Fluxos críticos como criar lançamento, baixar lançamento, criar transferência e login/logout não têm qualquer cobertura automatizada de ponta-a-ponta.

Os dois bugs de transferência encontrados na auditoria (`AlertasNotificacao`, `LancamentosTable`) provavelmente existiriam há menos tempo se houvesse um teste E2E cobrindo o fluxo de criação e baixa de transferência.

## Como resolver

1. Instalar Playwright (preferência sobre Cypress por ser mais leve e ter melhor suporte a TypeScript):
   ```bash
   npm init playwright@latest
   ```

2. Criar testes para os fluxos críticos em `e2e/`:
   - `e2e/auth.spec.ts` — login/logout
   - `e2e/lancamento.spec.ts` — criar, editar, baixar, excluir lançamento
   - `e2e/transferencia.spec.ts` — criar par de transferência e verificar que ambos aparecem quitados
   - `e2e/fluxo-caixa.spec.ts` — smoke test: página carrega com dados

3. Configurar variáveis de ambiente de teste (usuário/senha de teste isolado no Supabase).

4. Adicionar script `test:e2e` no `package.json` e integrar no CI.
