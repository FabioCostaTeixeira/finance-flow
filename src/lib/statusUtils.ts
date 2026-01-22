import { differenceInDays, parseISO, isAfter, startOfDay } from 'date-fns';

export type StatusLancamento = 
  | 'a_receber' 
  | 'recebido' 
  | 'a_pagar' 
  | 'pago' 
  | 'parcial' 
  | 'atrasado' 
  | 'vencida'
  | 'transferencia';

interface LancamentoForStatus {
  status: string;
  tipo: 'receita' | 'despesa';
  data_vencimento: string;
  valor: number | string;
  valor_pago: number | string | null;
}

/**
 * Calculates the computed status considering overdue rules:
 * - Despesas: if current date > due date and status is "a_pagar", return "atrasado"
 * - Receitas: if current date > due date + 3 days and status is "a_receber", return "vencida"
 */
export function getComputedStatus(lancamento: LancamentoForStatus): StatusLancamento {
  const today = startOfDay(new Date());
  const dueDate = startOfDay(parseISO(lancamento.data_vencimento));
  const originalStatus = lancamento.status as StatusLancamento;

  // If already paid/received or partial, keep original status
  if (['pago', 'recebido', 'parcial'].includes(originalStatus)) {
    return originalStatus;
  }

  // If already marked as overdue, keep it
  if (['atrasado', 'vencida'].includes(originalStatus)) {
    return originalStatus;
  }

  // Despesas: overdue if current date > due date
  if (lancamento.tipo === 'despesa' && originalStatus === 'a_pagar') {
    if (isAfter(today, dueDate)) {
      return 'atrasado';
    }
  }

  // Receitas: overdue if current date > due date + 3 days
  if (lancamento.tipo === 'receita' && originalStatus === 'a_receber') {
    const daysDiff = differenceInDays(today, dueDate);
    if (daysDiff > 3) {
      return 'vencida';
    }
  }

  return originalStatus;
}

/**
 * Get status badge configuration
 */
export function getStatusConfig(status: StatusLancamento, tipo: 'receita' | 'despesa') {
  const configs: Record<StatusLancamento, { label: string; className: string }> = {
    a_receber: {
      label: 'A Receber',
      className: 'bg-warning/20 text-warning border-warning/30',
    },
    recebido: {
      label: 'Recebido',
      className: 'bg-success/20 text-success border-success/30',
    },
    a_pagar: {
      label: 'A Pagar',
      className: 'bg-warning/20 text-warning border-warning/30',
    },
    pago: {
      label: 'Pago',
      className: 'bg-success/20 text-success border-success/30',
    },
    parcial: {
      label: 'Parcial',
      className: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    },
    atrasado: {
      label: 'Atrasado',
      className: 'bg-destructive/20 text-destructive border-destructive/30',
    },
    vencida: {
      label: 'Vencida',
      className: 'bg-destructive/20 text-destructive border-destructive/30',
    },
    transferencia: {
      label: 'Transferência',
      className: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    },
  };

  return configs[status] || configs.a_receber;
}
