---
titulo: IA interna proativa — insights via CLI e notificações via WhatsApp (Baileys)
tipo: ideia
prioridade: media
esforco: grande
arquivo: mcp/src/index.ts
origem: backlog-manual
data: 2026-05-09
---

## Descrição

Estruturar uma camada de inteligência interna no Finance Flow que opere de forma **proativa** (não reativa): em vez de apenas responder perguntas, a IA monitora padrões financeiros em segundo plano e comunica ao usuário quando detecta algo relevante.

### Dois canais de entrega

1. **CLI** — processo que roda localmente (ou em cron no servidor), analisa os dados e imprime insights no terminal / salva em log
2. **WhatsApp** — a mesma IA envia mensagens proativas via Baileys (WhatsApp Web API, open source, sem custo por mensagem)

> **Nota:** A biblioteca citada como "bayless" é provavelmente **Baileys** (`@whiskeysockets/baileys`), a biblioteca Node.js mais usada para conectar ao WhatsApp Web sem API oficial. Alternativa paga: Twilio WhatsApp API ou Meta Cloud API (com aprovação de template).

---

## Comportamentos proativos desejados

### Alertas de limite
- Usuário define limite mensal por categoria (ex: Alimentação ≤ R$ 800)
- IA monitora e notifica quando atingir 80% e 100% do limite
- Mensagem: *"Você já gastou R$ 650 em Alimentação este mês (81% do limite). Faltam R$ 150."*

### Detecção de consumo exagerado
- Compara gasto da semana/mês atual com média histórica
- Se desvio > N% (configurável), dispara alerta
- Mensagem: *"Seus gastos com Transporte em maio estão 40% acima da sua média dos últimos 3 meses."*

### Projeção de saldo
- Com base em lançamentos `a_pagar` e `a_receber` futuros, projeta saldo ao fim do mês
- Alerta se projeção for negativa
- Mensagem: *"Se todos os lançamentos previstos se confirmarem, seu saldo em 31/05 será -R$ 420. Há 3 despesas não pagas que somam R$ 1.200."*

### Resumo semanal
- Todo domingo às 20h (configurável), envia resumo da semana: receitas, despesas, saldo, top categorias

---

## Arquitetura sugerida

```
┌─────────────────────────────────────┐
│  Supabase (dados financeiros)       │
└──────────────┬──────────────────────┘
               │ service_role key (MCP)
               ▼
┌─────────────────────────────────────┐
│  Finance Flow AI Worker             │
│  (Node.js / TypeScript)             │
│  - Roda via cron (ex: a cada 1h)    │
│  - Consome MCP tools existentes     │
│  - Chama LLM (ai_settings)          │
│  - Detecta padrões e gera insights  │
└──────────┬──────────────────────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
 CLI output    Baileys
 (terminal/    (WhatsApp Web)
  log file)
```

### Integração com estrutura existente
- Reutilizar `ai_settings` (provider, model, API key já configurados no sistema)
- Reutilizar MCP tools (`listar_lancamentos`, `relatorio_por_categoria`) como fonte de dados
- Adicionar tabela `alertas_config` (limite por categoria, threshold de desvio, horário de resumo)
- Adicionar tabela `alertas_enviados` (log de o que foi enviado, para não duplicar)

---

## Sobre Baileys (WhatsApp Web API)

- Repo: `@whiskeysockets/baileys` (fork mais mantido de `@adiwajshing/baileys`)
- Sem custo por mensagem, sem aprovação de template
- Requer escanear QR Code uma vez para autenticar a sessão
- Sessão pode ser persistida em arquivo (ou Supabase Storage)
- **Limitação:** não é API oficial da Meta — pode ser bloqueado se o número enviar spam. Para uso pessoal/familiar é estável.
- **Alternativa oficial:** Meta Cloud API (gratuita até 1000 conversas/mês, requer número dedicado e aprovação)

---

## Próximos passos

1. Definir quais alertas têm maior valor imediato (limite de categoria é o mais simples)
2. Criar tabela `alertas_config` no Supabase
3. Fazer spike de Baileys: conectar, enviar mensagem de teste, persistir sessão
4. Criar worker CLI mínimo que roda `listar_lancamentos` e imprime insight no terminal
5. Conectar worker ao canal WhatsApp
6. Adicionar tela de configuração de alertas no frontend (página `Configurações` ou dentro de `AISettings`)
