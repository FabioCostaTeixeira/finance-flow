export type RiskLevel = "baixo" | "medio" | "alto" | "critico";

export interface ToolRiskEntry {
  tool: string;
  risk: RiskLevel;
  reason: string;
  requires_confirmation: boolean;
}

export const TOOL_RISK_MAP: ToolRiskEntry[] = [
  { tool: "listar_lancamentos",       risk: "baixo",   reason: "Apenas leitura",                          requires_confirmation: false },
  { tool: "consultar_saldo",          risk: "baixo",   reason: "Apenas leitura",                          requires_confirmation: false },
  { tool: "executar_sql",             risk: "baixo",   reason: "Apenas SELECT permitido",                 requires_confirmation: false },
  { tool: "listar_bancos",            risk: "baixo",   reason: "Apenas leitura",                          requires_confirmation: false },
  { tool: "listar_categorias",        risk: "baixo",   reason: "Apenas leitura",                          requires_confirmation: false },
  { tool: "consultar_lancamentos_bi", risk: "baixo",   reason: "Apenas leitura",                          requires_confirmation: false },
  { tool: "relatorio_fluxo_caixa",    risk: "baixo",   reason: "Apenas leitura",                          requires_confirmation: false },
  { tool: "relatorio_por_categoria",  risk: "baixo",   reason: "Apenas leitura",                          requires_confirmation: false },
  { tool: "relatorio_inadimplencia",  risk: "baixo",   reason: "Apenas leitura",                          requires_confirmation: false },
  { tool: "relatorio_kpi",            risk: "baixo",   reason: "Apenas leitura",                          requires_confirmation: false },
  { tool: "top_clientes_credores",    risk: "baixo",   reason: "Apenas leitura",                          requires_confirmation: false },
  { tool: "sugerir_categoria",        risk: "baixo",   reason: "Apenas sugestão, sem escrita",            requires_confirmation: false },
  { tool: "listar_auditoria",         risk: "baixo",   reason: "Apenas leitura",                          requires_confirmation: false },
  { tool: "projetar_fluxo_caixa",     risk: "baixo",   reason: "Cálculo local, sem escrita",              requires_confirmation: false },
  { tool: "comparar_periodos",        risk: "baixo",   reason: "Apenas leitura e cálculo",                requires_confirmation: false },
  { tool: "criar_lancamento",         risk: "medio",   reason: "Insere dado financeiro",                  requires_confirmation: false },
  { tool: "atualizar_lancamento",     risk: "medio",   reason: "Modifica dado financeiro existente",      requires_confirmation: false },
  { tool: "baixar_lancamento",        risk: "alto",    reason: "Registra pagamento — afeta saldo real",   requires_confirmation: true  },
  { tool: "transferir_entre_contas",  risk: "alto",    reason: "Move dinheiro entre contas",              requires_confirmation: true  },
  { tool: "excluir_lancamento",       risk: "critico", reason: "Exclusão irreversível de dado financeiro",requires_confirmation: true  },
];

export function getRisk(toolName: string): ToolRiskEntry {
  return (
    TOOL_RISK_MAP.find((e) => e.tool === toolName) ?? {
      tool: toolName,
      risk: "medio",
      reason: "Tool sem mapeamento de risco",
      requires_confirmation: false,
    }
  );
}

export function requiresConfirmation(toolName: string): boolean {
  return getRisk(toolName).requires_confirmation;
}
