export interface PaymentValidationResult {
  valid: boolean;
  code?: string;
  reason?: string;
  saldoRestante?: number;
}

export function validatePaymentMovement(
  valorLancamento: number,
  totalPagoAtual: number,
  valorMovimento: number
): PaymentValidationResult {
  if (Number.isNaN(valorMovimento) || !Number.isFinite(valorMovimento) || valorMovimento <= 0) {
    return { valid: false, code: "INVALID_AMOUNT", reason: "Valor deve ser número positivo" };
  }

  const saldoRestante = Number((valorLancamento - totalPagoAtual).toFixed(2));

  if (Number(valorMovimento.toFixed(2)) > saldoRestante) {
    return {
      valid: false,
      code: "AMOUNT_EXCEEDS_REMAINING",
      reason: `Valor solicitado R$ ${valorMovimento.toFixed(2)} excede saldo restante R$ ${saldoRestante.toFixed(2)}`,
      saldoRestante,
    };
  }

  return { valid: true, saldoRestante: Number((saldoRestante - valorMovimento).toFixed(2)) };
}

export function deriveLancamentoStatus(
  tipo: "receita" | "despesa",
  valorTotal: number,
  novoTotalPago: number
): "a_receber" | "recebido" | "a_pagar" | "pago" | "parcial" {
  if (novoTotalPago <= 0) {
    return tipo === "receita" ? "a_receber" : "a_pagar";
  }
  if (Number(novoTotalPago.toFixed(2)) >= Number(valorTotal.toFixed(2))) {
    return tipo === "receita" ? "recebido" : "pago";
  }
  return "parcial";
}
