export interface LancamentoAllowlistFields {
  descricao?: string;
  valor?: string;
  tipo?: "receita" | "despesa";
  data_vencimento?: string;
  categoria_id?: string;
  banco_id?: string;
  observacao?: string;
}

export const ALLOWED_UPDATE_FIELDS = new Set([
  "descricao",
  "valor",
  "data_vencimento",
  "categoria_id",
  "banco_id",
  "observacao",
]);

export const FORBIDDEN_UPDATE_FIELDS = new Set([
  "id",
  "tenant_id",
  "created_at",
  "updated_at",
  "status",
  "valor_pago",
  "data_pagamento",
  "version",
  "recorrencia_id",
  "parcela_atual",
  "total_parcelas",
]);

export function validateLancamentoPatch(patch: Record<string, unknown>): { valid: boolean; forbiddenKeys: string[] } {
  const keys = Object.keys(patch);
  const forbiddenKeys = keys.filter((key) => FORBIDDEN_UPDATE_FIELDS.has(key) || !ALLOWED_UPDATE_FIELDS.has(key));
  return {
    valid: forbiddenKeys.length === 0,
    forbiddenKeys,
  };
}
