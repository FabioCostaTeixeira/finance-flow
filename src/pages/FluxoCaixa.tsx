import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeftRight, TrendingUp, TrendingDown } from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { format, parseISO, startOfMonth, endOfMonth, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { useLancamentos, LancamentoExtendido } from '@/hooks/useLancamentos';
import { useBancos } from '@/hooks/useBancos';
import { formatCurrency } from '@/lib/recurrence';
import { cn } from '@/lib/utils';
import { FluxoCaixaFAB } from '@/components/FluxoCaixaFAB';
import { LancamentoForm } from '@/components/LancamentoForm';
import { TransferenciaModal } from '@/components/TransferenciaModal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function FluxoCaixaPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bancoIdFromUrl = searchParams.get('bancoId');
  
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [selectedBancoId, setSelectedBancoId] = useState<string | undefined>(bancoIdFromUrl || undefined);
  const [receitaFormOpen, setReceitaFormOpen] = useState(false);
  const [despesaFormOpen, setDespesaFormOpen] = useState(false);
  const [transferenciaOpen, setTransferenciaOpen] = useState(false);

  const { data: lancamentos = [], isLoading } = useLancamentos();
  const { data: bancos = [] } = useBancos();

  const filteredLancamentos = useMemo(() => {
    // Função auxiliar: usa data_pagamento se existir, senão data_vencimento
    const getDataEfetiva = (l: LancamentoExtendido) =>
      parseISO(l.data_pagamento || l.data_vencimento);

    return lancamentos
      .filter((lancamento) => {
        const lancDate = getDataEfetiva(lancamento);
        if (date?.from && isBefore(lancDate, startOfDay(date.from))) return false;
        if (date?.to && isAfter(lancDate, endOfDay(date.to))) return false;
        if (selectedBancoId && lancamento.banco_id !== selectedBancoId) return false;
        return true;
      })
      .sort((a, b) => getDataEfetiva(b).getTime() - getDataEfetiva(a).getTime());
  }, [lancamentos, date, selectedBancoId]);

  // Calcular fluxo de caixa com saldo acumulado e colunas separadas
  const fluxoComSaldo = useMemo(() => {
    let saldoAcumulado = 0;
    return filteredLancamentos.map((lancamento) => {
      const valor = Number(lancamento.valor);
      const valorPago = Number(lancamento.valor_pago) || 0;
      const isEntrada = lancamento.tipo === 'receita';
      const isQuitado = ['recebido', 'pago', 'transferencia'].includes(lancamento.status);

      // Separar valores projetados (a_receber/a_pagar) dos realizados (recebido/pago)
      let aReceber = 0;
      let realizado = 0;
      let aPagar = 0;
      let pago = 0;

      if (isEntrada) {
        if (isQuitado) {
          realizado = valorPago || valor;
        } else if (lancamento.status === 'parcial') {
          realizado = valorPago;
          aReceber = valor - valorPago;
        } else {
          aReceber = valor;
        }
      } else {
        if (isQuitado) {
          pago = valorPago || valor;
        } else if (lancamento.status === 'parcial') {
          pago = valorPago;
          aPagar = valor - valorPago;
        } else {
          aPagar = valor;
        }
      }

      const valorEfetivo = isEntrada ? (realizado + aReceber) : -(pago + aPagar);
      saldoAcumulado += valorEfetivo;

      return {
        ...lancamento,
        aReceber,
        realizado,
        aPagar,
        pago,
        saldoAcumulado,
      };
    });
  }, [filteredLancamentos]);

  // Calcular totais
  const totals = useMemo(() => {
    const totalAReceber = fluxoComSaldo.reduce((acc, l) => acc + l.aReceber, 0);
    const totalRealizado = fluxoComSaldo.reduce((acc, l) => acc + l.realizado, 0);
    const totalAPagar = fluxoComSaldo.reduce((acc, l) => acc + l.aPagar, 0);
    const totalPago = fluxoComSaldo.reduce((acc, l) => acc + l.pago, 0);
    const totalEntradas = totalAReceber + totalRealizado;
    const totalSaidas = totalAPagar + totalPago;
    return {
      aReceber: totalAReceber,
      realizado: totalRealizado,
      aPagar: totalAPagar,
      pago: totalPago,
      entradas: totalEntradas,
      saidas: totalSaidas,
      saldo: totalEntradas - totalSaidas,
    };
  }, [fluxoComSaldo]);

  const saldoRealizado = totals.realizado - totals.pago;
  const saldoFuturo = (totals.aReceber + totals.realizado) - (totals.aPagar + totals.pago);


  const handleBancoChange = (value: string) => {
    const newBancoId = value === 'all' ? undefined : value;
    setSelectedBancoId(newBancoId);
    if (newBancoId) {
      navigate(`/fluxo-caixa?bancoId=${newBancoId}`, { replace: true });
    } else {
      navigate('/fluxo-caixa', { replace: true });
    }
  };

  const getValueColorClass = (lancamento: typeof fluxoComSaldo[0]) => {
    if (lancamento.realizado > 0) return 'text-success';
    if (lancamento.aReceber > 0) return 'text-blue-400';
    if (lancamento.pago > 0) return 'text-destructive';
    if (lancamento.aPagar > 0) return 'text-purple-400';
    return 'text-foreground';
  };

  const getDisplayValue = (lancamento: typeof fluxoComSaldo[0]) => {
    if (lancamento.realizado > 0) return lancamento.realizado;
    if (lancamento.aReceber > 0) return lancamento.aReceber;
    if (lancamento.pago > 0) return lancamento.pago;
    if (lancamento.aPagar > 0) return lancamento.aPagar;
    return Number(lancamento.valor);
  };

  const getStatusLabel = (lancamento: LancamentoExtendido) => {
    const status = lancamento.status as string;
    const statusMap: Record<string, { label: string; className: string }> = {
      a_receber: { label: 'A Receber', className: 'text-blue-400 bg-blue-500/10' },
      recebido: { label: 'Recebido', className: 'text-success bg-success/10' },
      a_pagar: { label: 'A Pagar', className: 'text-purple-400 bg-purple-500/10' },
      pago: { label: 'Pago', className: 'text-success bg-success/10' },
      parcial: { label: 'Parcial', className: 'text-warning bg-warning/10' },
      atrasado: { label: 'Atrasado', className: 'text-destructive bg-destructive/10' },
      vencida: { label: 'Vencida', className: 'text-destructive bg-destructive/10' },
      transferencia: { label: 'Transferência', className: 'text-muted-foreground bg-muted' },
    };
    const config = statusMap[status] || { label: status, className: '' };
    return (
      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', config.className)}>
        {config.label}
      </span>
    );
  };

  const selectedBancoName = selectedBancoId
    ? bancos.find(b => b.id === selectedBancoId)?.nome
    : null;

  return (
    <div className="flex-1 p-3 md:p-6 space-y-4 md:space-y-6 overflow-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4"
      >
        <div className="pl-10 md:pl-0">
          <h1 className="text-lg md:text-2xl font-bold text-foreground flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 md:w-7 md:h-7 text-primary" />
            Fluxo de Caixa
            {selectedBancoName && (
              <span className="text-muted-foreground font-normal text-lg">
                - {selectedBancoName}
              </span>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">
            Visualize todas as movimentações de entrada e saída
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Select
            value={selectedBancoId || 'all'}
            onValueChange={handleBancoChange}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos os bancos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os bancos</SelectItem>
              {bancos.map((banco) => (
                <SelectItem key={banco.id} value={banco.id}>
                  {banco.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DatePickerWithRange date={date} onDateChange={setDate} />
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        <KpiCard
          title="Saldo Realizado"
          badgeLabel="Realizado"
          mainValue={saldoRealizado}
          stats={[
            { label: 'Recebidos', value: totals.realizado, colorClass: 'text-success', barColorClass: 'bg-success' },
            { label: 'Pagos', value: totals.pago, colorClass: 'text-destructive', barColorClass: 'bg-destructive' },
          ]}
          delay={0.1}
        />
        <KpiCard
          title="Saldo Futuro"
          badgeLabel="Projetado"
          mainValue={saldoFuturo}
          stats={[
            { label: 'A Receber', value: totals.aReceber, colorClass: 'text-blue-400', barColorClass: 'bg-blue-500' },
            { label: 'A Pagar', value: totals.aPagar, colorClass: 'text-purple-400', barColorClass: 'bg-purple-500' },
          ]}
          delay={0.15}
        />
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card rounded-xl overflow-x-auto"
      >
        <Table className="text-xs md:text-sm">
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/50">
              <TableHead className="text-muted-foreground">Data</TableHead>
              <TableHead className="text-muted-foreground">Descrição</TableHead>
              <TableHead className="text-muted-foreground">Banco</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                </TableCell>
              </TableRow>
            ) : fluxoComSaldo.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhuma movimentação encontrada para o período.
                </TableCell>
              </TableRow>
            ) : (
              fluxoComSaldo.map((lancamento, index) => (
                <motion.tr
                  key={lancamento.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="table-row-hover border-border/30"
                >
                  <TableCell className="font-medium">
                    {format(parseISO(lancamento.data_pagamento || lancamento.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell>{lancamento.cliente_credor}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {lancamento.bancos?.nome || '-'}
                  </TableCell>
                  <TableCell>{getStatusLabel(lancamento)}</TableCell>
                  <TableCell className={cn('text-right font-bold', getValueColorClass(lancamento))}>
                    {formatCurrency(getDisplayValue(lancamento))}
                  </TableCell>
                </motion.tr>
              ))
            )}
          </TableBody>
        </Table>
      </motion.div>
    </div>
  );
}
