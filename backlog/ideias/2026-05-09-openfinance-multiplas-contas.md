---
titulo: Viabilidade de integração com Open Finance para múltiplas contas bancárias
tipo: ideia
prioridade: media
esforco: grande
arquivo: src/hooks/useBancos.ts
origem: backlog-manual
data: 2026-05-09
---

## Descrição

Investigar a viabilidade de conectar contas bancárias reais ao Finance Flow via Open Finance (Banco Central do Brasil), eliminando a necessidade de lançamento manual.

### Contas de interesse (casos de uso reais)

| Titular | Banco | Tipo |
|---------|-------|------|
| Fábio | Stone | PF |
| Fábio | Stone | PJ |
| Fábio | Nubank | PF |
| Mary | Nubank | PF |

O sistema precisa suportar múltiplos titulares (contas de terceiros com acesso consentido), não apenas o usuário logado.

## Questões a investigar

### 1. Compatibilidade técnica com o sistema atual
- A tabela `bancos` suporta campo `open_finance_id` ou `consent_id`?
- A tabela `lancamentos` tem campo para `transacao_id_externo` (evitar duplicatas)?
- RLS atual permite que um usuário veja lancamentos de contas de outro titular (ex: Mary)?
- O modelo de roles (`master | admin | user`) é adequado para o caso multi-titular?

### 2. Regulatório e acesso
- Open Finance BR exige que a instituição seja **participante homologado** pelo Banco Central
- Stone e Nubank são participantes ativos — verificar escopo de dados disponíveis (extrato, saldo, PIX)
- Consentimento deve ser renovado periodicamente (72h para dados transacionais, 12 meses para dados cadastrais)
- Avaliar se usar um **agregador** (Pluggy, Belvo, Quanto) é mais viável do que integrar direto

### 3. Alternativa de menor custo: agregadores Open Finance
| Provedor | Modelo | Custo estimado |
|----------|--------|----------------|
| **Pluggy** | SaaS — SDK + webhook | Free tier disponível |
| **Belvo** | SaaS — API REST | Pay-per-use |
| **Quanto** | SaaS — foco em PJ | A confirmar |

Um agregador cuida da conexão com os bancos, do consentimento e da normalização dos dados — o Finance Flow só consome o webhook.

### 4. Arquitetura sugerida (se viável)
```
Open Finance (via Pluggy/Belvo)
    → webhook → Supabase Edge Function
    → normalizar para schema lancamentos
    → insert com transacao_id_externo (upsert para evitar duplicatas)
    → notificar usuário via Telegram/WhatsApp
```

## Próximos passos

1. Criar conta de teste no Pluggy (sandbox gratuito)
2. Mapear campos retornados pela API para o schema de `lancamentos`
3. Avaliar se o modelo de roles precisa de ajuste para multi-titular
4. Definir política de consentimento (quem autoriza, por quanto tempo)
5. Estimar volume de transações/mês para precificação
