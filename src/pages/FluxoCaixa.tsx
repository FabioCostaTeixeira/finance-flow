import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeftRight, TrendingUp, TrendingDown, Scale, Filter } from 'lucide-react';
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
import { Button } from '@/components/ui/button';

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

  // Filtrar e ordenar lançamentos
  const filteredLancamentos = useMemo(() => {
    return lancamentos
      .filter((lancamento) => {
        // Filtro por data
        if (date?.from) {
          const lancDate = parseISO(lancamento.data_vencimento);
          if (isBefore(lancDate, startOfDay(date.from))) return false;
        }
        if (date?.to) {
          const lancDate = parseISO(lancamento.data_vencimento);
          if (isAfter(lancDate, endOfDay(date.to))) return false;
        }
        // Filtro por banco
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

  // Calcular fluxo de caixa com saldo acumulado
  const fluxoComSaldo = useMemo(() => {
    let saldoAcumulado = 0;
    return filteredLancamentos.map((lancamento) => {
      const valor = Number(lancamento.valor);
      const valorPago = Number(lancamento.valor_pago) || 0;
      const isEntrada = lancamento.tipo === 'receita';
      
      // Usar valor pago se quitado, senão valor total
      const valorEfetivo = ['recebido', 'pago', 'transferencia'].includes(lancamento.status)
        ? valorPago
        : valor;
      
      saldoAcumulado += isEntrada ? valorEfetivo : -valorEfetivo;
      
      return {
        ...lancamento,
        entrada: isEntrada ? valorEfetivo : 0,
        saida: !isEntrada ? valorEfetivo : 0,
        saldoAcumulado,
      };
    });
  }, [filteredLancamentos]);

  // Calcular totais
  const totals = useMemo(() => {
    const totalEntradas = fluxoComSaldo.reduce((acc, l) => acc + l.entrada, 0);
    const totalSaidas = fluxoComSaldo.reduce((acc, l) => acc + l.saida, 0);
    return {
      entradas: totalEntradas,
      saidas: totalSaidas,
      saldo: totalEntradas - totalSaidas,
    };
  }, [fluxoComSaldo]);

  const stats = [
    {
      label: 'Total Entradas',
      value: formatCurrency(totals.entradas),
      icon: TrendingUp,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Total Saídas',
      value: formatCurrency(totals.saidas),
      icon: TrendingDown,
      color: 'text-destructive',
      bg: 'bg-destructive/10',
    },
    {
      label: 'Saldo do Período',
      value: formatCurrency(totals.saldo),
      icon: Scale,
      color: totals.saldo >= 0 ? 'text-success' : 'text-amber-500',
      bg: totals.saldo >= 0 ? 'bg-success/10' : 'bg-amber-500/10',
    },
  ];

  const handleBancoChange = (value: string) => {
    const newBancoId = value === 'all' ? undefined : value;
    setSelectedBancoId(newBancoId);
    
    // Atualizar URL
    if (newBancoId) {
      navigate(`/fluxo-caixa?bancoId=${newBancoId}`, { replace: true });
    } else {
      navigate('/fluxo-caixa', { replace: true });
    }
  };

  const getStatusLabel = (lancamento: LancamentoExtendido) => {
    const status = lancamento.status as string;
    const statusMap: Record<string, { label: string; className: string }> = {
      a_receber: { label: 'A Receber', className: 'text-warning bg-warning/10' },
      recebido: { label: 'Recebido', className: 'text-success bg-success/10' },
      a_pagar: { label: 'A Pagar', className: 'text-warning bg-warning/10' },
      pago: { label: 'Pago', className: 'text-success bg-success/10' },
      parcial: { label: 'Parcial', className: 'text-info bg-info/10' },
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
              <TableHead className="text-muted-foreground text-right text-primary">Entrada</TableHead>
              <TableHead className="text-muted-foreground text-right text-destructive">Saída</TableHead>
              <TableHead className="text-muted-foreground text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                </TableCell>
              </TableRow>
            ) : fluxoComSaldo.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                  <TableCell className="text-right text-primary font-medium">
                    {lancamento.entrada > 0 ? formatCurrency(lancamento.entrada) : '-'}
                  </TableCell>
                  <TableCell className="text-right text-destructive font-medium">
                    {lancamento.saida > 0 ? formatCurrency(lancamento.saida) : '-'}
                  </TableCell>
                  <TableCell className={cn(
                    'text-right font-bold',
                    lancamento.saldoAcumulado >= 0 ? 'text-success' : 'text-amber-500'
                  )}>
                    {formatCurrency(lancamento.saldoAcumulado)}
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
