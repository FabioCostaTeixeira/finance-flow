import { StatusLancamento } from '@/lib/statusUtils';

/**
 * Semântica única de "quanto deste lançamento já aconteceu" e "quanto falta".
 *
 * Espelha `get_bancos_com_saldos`
 * (supabase/migrations/20260919000100_fix_saldo_valor_pago_zero.sql). Qualquer
 * mudança aqui precisa sair na migration junto, senão a aba Bancos e o Fluxo de
 * Caixa voltam a divergir.
 *
 * A armadilha que originou este módulo: `lancamentos.valor_pago` é
 * `numeric DEFAULT 0`, nunca NULL. Então `valor_pago || valor` (JS, 0 é falsy) e
 * `COALESCE(valor_pago, valor)` (SQL, 0 não é NULL) davam respostas diferentes
 * para a mesma linha.
 */

/** Status em que o dinheiro já entrou ou saiu por inteiro. */
const STATUS_LIQUIDADOS: readonly string[] = ['recebido', 'pago', 'transferencia'];

export interface LancamentoParaSaldo {
  status: string;
  valor: number | string;
  valor_pago?: number | string | null;
}

export interface SaldoLancamento {
  /** Quanto já entrou/saiu de fato. */
  realizado: number;
  /** Quanto ainda falta entrar/sair. Nunca negativo. */
  pendente: number;
}

export function isLiquidado(status: string): boolean {
  return STATUS_LIQUIDADOS.includes(status);
}

export function calcularSaldoLancamento(lancamento: LancamentoParaSaldo): SaldoLancamento {
  const valor = Number(lancamento.valor) || 0;
  const valorPago = Number(lancamento.valor_pago) || 0;

  if (isLiquidado(lancamento.status)) {
    // valor_pago = 0 num lançamento liquidado significa "ninguém preencheu",
    // não "recebi zero". O valor previsto é a melhor informação disponível.
    return { realizado: valorPago > 0 ? valorPago : valor, pendente: 0 };
  }

  if (lancamento.status === 'parcial') {
    return { realizado: valorPago, pendente: Math.max(valor - valorPago, 0) };
  }

  // a_receber, a_pagar, vencida, atrasado
  return { realizado: 0, pendente: Math.max(valor - valorPago, 0) };
}

export type { StatusLancamento };
