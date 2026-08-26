-- Índice de otimização para o join usado por get_bancos_com_saldos(_tenant, _data_inicio, _data_fim).
-- A função faz LEFT JOIN public.lancamentos l ON l.banco_id = b.id AND l.tenant_id = _tenant,
-- consultado toda vez que a tela de Bancos/FluxoCaixa calcula saldos por banco.
-- Já existe idx_lancamentos_tenant_tipo_status_venc (tenant_id,tipo,status,data_vencimento),
-- que não cobre bem esse join porque a condição de igualdade relevante aqui é (tenant_id, banco_id),
-- não (tenant_id, tipo, status). Sem este índice o join cai em seq scan da tabela lancamentos
-- filtrando por tenant_id e cruzando com banco_id em memória.
CREATE INDEX IF NOT EXISTS idx_lancamentos_tenant_banco ON public.lancamentos(tenant_id, banco_id);

-- Nota: o filtro de data em get_bancos_com_saldos usa COALESCE(data_pagamento, data_vencimento),
-- que não é coberto por nenhum índice simples (precisaria de índice de expressão). Não foi criado
-- aqui por ser uma mudança de risco/benefício menos óbvio para uma auditoria de baixo risco —
-- reportado separadamente para avaliação futura caso a tabela lancamentos cresça muito por tenant.
