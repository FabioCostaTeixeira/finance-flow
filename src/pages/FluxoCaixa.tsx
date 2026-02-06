import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeftRight, TrendingUp, TrendingDown, Scale } from 'lucide-react';
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

  const stats = [
    {
      label: 'Total Entradas',
      value: formatCurrency(totals.entradas),
      sub: `A Receber: ${formatCurrency(totals.aReceber)} | Realizado: ${formatCurrency(totals.realizado)}`,
      icon: TrendingUp,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Total Saídas',
      value: formatCurrency(totals.saidas),
      sub: `A Pagar: ${formatCurrency(totals.aPagar)} | Pago: ${formatCurrency(totals.pago)}`,
      icon: TrendingDown,
      color: 'text-destructive',
      bg: 'bg-destructive/10',
    },
    {
      label: 'Saldo do Período',
      value: formatCurrency(totals.saldo),
      sub: `Projetado: ${formatCurrency((totals.aReceber + totals.realizado) - (totals.aPagar + totals.pago))} | Atual: ${formatCurrency(totals.realizado - totals.pago)}`,
      icon: Scale,
      color: totals.saldo >= 0 ? 'text-success' : 'text-warning',
      bg: totals.saldo >= 0 ? 'bg-success/10' : 'bg-warning/10',
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

  const getStatusLabel = (lancamento: LancamentoExtendido) => {
    const status = lancamento.status as string;
    const statusMap: Record<string, { label: string; className: string }> = {
      a_receber: { label: 'A Receber', className: 'text-primary bg-primary/10' },
      recebido: { label: 'Recebido', className: 'text-success bg-success/10' },
      a_pagar: { label: 'A Pagar', className: 'text-warning bg-warning/10' },
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
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ArrowLeftRight className="w-7 h-7 text-primary" />
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
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + index * 0.05 }}
            className="glass-card rounded-xl p-4"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{stat.sub}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card rounded-xl overflow-hidden"
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/50">
              <TableHead className="text-muted-foreground">Data</TableHead>
              <TableHead className="text-muted-foreground">Descrição</TableHead>
              <TableHead className="text-muted-foreground">Banco</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground text-right text-primary">A Receber</TableHead>
              <TableHead className="text-muted-foreground text-right text-success">Realizado</TableHead>
              <TableHead className="text-muted-foreground text-right text-warning">A Pagar</TableHead>
              <TableHead className="text-muted-foreground text-right text-destructive">Pago</TableHead>
              <TableHead className="text-muted-foreground text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                </TableCell>
              </TableRow>
            ) : fluxoComSaldo.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Nenhuma movimentação encontrada para o período.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {fluxoComSaldo.map((lancamento, index) => (
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
                    <TableCell className="text-right text-primary font-medium">
                      {lancamento.aReceber > 0 ? formatCurrency(lancamento.aReceber) : '-'}
                    </TableCell>
                    <TableCell className="text-right text-success font-medium">
                      {lancamento.realizado > 0 ? formatCurrency(lancamento.realizado) : '-'}
                    </TableCell>
                    <TableCell className="text-right text-warning font-medium">
                      {lancamento.aPagar > 0 ? formatCurrency(lancamento.aPagar) : '-'}
                    </TableCell>
                    <TableCell className="text-right text-destructive font-medium">
                      {lancamento.pago > 0 ? formatCurrency(lancamento.pago) : '-'}
                    </TableCell>
                    <TableCell className={cn(
                      'text-right font-bold',
                      lancamento.saldoAcumulado >= 0 ? 'text-success' : 'text-warning'
                    )}>
                      {formatCurrency(lancamento.saldoAcumulado)}
                    </TableCell>
                  </motion.tr>
                ))}
                {/* Totals row */}
                <TableRow className="bg-accent/30 border-t-2 border-border font-bold">
                  <TableCell colSpan={4} className="text-foreground">Totais</TableCell>
                  <TableCell className="text-right text-primary">
                    {formatCurrency(totals.aReceber)}
                  </TableCell>
                  <TableCell className="text-right text-success">
                    {formatCurrency(totals.realizado)}
                  </TableCell>
                  <TableCell className="text-right text-warning">
                    {formatCurrency(totals.aPagar)}
                  </TableCell>
                  <TableCell className="text-right text-destructive">
                    {formatCurrency(totals.pago)}
                  </TableCell>
                  <TableCell className={cn(
                    'text-right',
                    totals.saldo >= 0 ? 'text-success' : 'text-warning'
                  )}>
                    {formatCurrency(totals.saldo)}
                  </TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </motion.div>
    </div>
  );
}
