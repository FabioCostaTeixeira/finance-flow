import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeftRight, TrendingUp, TrendingDown } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { useLancamentos, LancamentoExtendido } from '@/hooks/useLancamentos';
import { useBancos } from '@/hooks/useBancos';
import { formatCurrency } from '@/lib/recurrence';
import { cn } from '@/lib/utils';
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

  const { data: lancamentos = [], isLoading } = useLancamentos();
  const { data: bancos = [] } = useBancos();

  const filteredLancamentos = useMemo(() => {
    return lancamentos
      .filter((lancamento) => {
        if (date?.from) {
          const lancDate = parseISO(lancamento.data_vencimento);
          if (isBefore(lancDate, startOfDay(date.from))) return false;
        }
        if (date?.to) {
          const lancDate = parseISO(lancamento.data_vencimento);
          if (isAfter(lancDate, endOfDay(date.to))) return false;
        }
        if (selectedBancoId && lancamento.banco_id !== selectedBancoId) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = parseISO(a.data_vencimento);
        const dateB = parseISO(b.data_vencimento);
        return dateA.getTime() - dateB.getTime();
      });
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

  const saldoAtual = totals.realizado - totals.pago;

  const stats = [
    {
      label: 'A Receber',
      value: formatCurrency(totals.aReceber),
      icon: TrendingUp,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    {
      label: 'Realizado',
      value: formatCurrency(totals.realizado),
      icon: TrendingUp,
      color: 'text-success',
      bg: 'bg-success/10',
      border: 'border-success/20',
    },
    {
      label: 'A Pagar',
      value: formatCurrency(totals.aPagar),
      icon: TrendingDown,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
    },
    {
      label: 'Pago',
      value: formatCurrency(totals.pago),
      icon: TrendingDown,
      color: 'text-destructive',
      bg: 'bg-destructive/10',
      border: 'border-destructive/20',
    },
  ];

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
    if (lancamento.realizado > 0) return 'text-success'; // verde - realizado
    if (lancamento.aReceber > 0) return 'text-blue-400'; // azul - a receber
    if (lancamento.pago > 0) return 'text-destructive'; // vermelho - pago
    if (lancamento.aPagar > 0) return 'text-purple-400'; // lilás - a pagar
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

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-4"
      >
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + index * 0.05 }}
            className={cn('glass-card rounded-xl p-2.5 md:p-4 border', stat.border)}
          >
            <div className="flex items-center gap-2 md:gap-3">
              <div className={`p-1.5 md:p-2.5 rounded-lg shrink-0 ${stat.bg}`}>
                <stat.icon className={`w-4 h-4 md:w-5 md:h-5 ${stat.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] md:text-xs text-muted-foreground truncate">{stat.label}</p>
                <p className={`text-sm md:text-lg font-bold ${stat.color} truncate`}>{stat.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Saldo Atual Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className={cn(
          'glass-card rounded-xl p-4 border flex items-center justify-between',
          saldoAtual >= 0 ? 'border-success/20' : 'border-destructive/20'
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn('p-2.5 rounded-lg', saldoAtual >= 0 ? 'bg-success/10' : 'bg-destructive/10')}>
            <ArrowLeftRight className={cn('w-5 h-5', saldoAtual >= 0 ? 'text-success' : 'text-destructive')} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Saldo Atual</p>
            <p className="text-sm text-muted-foreground">Realizado - Pago</p>
          </div>
        </div>
        <p className={cn('text-xl font-bold', saldoAtual >= 0 ? 'text-success' : 'text-destructive')}>
          {formatCurrency(saldoAtual)}
        </p>
      </motion.div>

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
                    {format(parseISO(lancamento.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })}
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
