import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeftRight, TrendingUp, TrendingDown } from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { format, parseISO, startOfMonth, endOfMonth, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { LancamentoExtendido, useLancamentos } from '@/hooks/useLancamentos';
import { useBancos } from '@/hooks/useBancos';
import { formatCurrency } from '@/lib/recurrence';
import { cn } from '@/lib/utils';
import { getStatusConfig, StatusLancamento } from '@/lib/statusUtils';
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

function StatusLabel({ lancamento }: { lancamento: LancamentoExtendido }) {
  const config = getStatusConfig(lancamento.status as StatusLancamento);
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}

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

  // Extrato linha a linha, não agregado mensal: a policy `lancamentos_select`
  // libera SELECT para quem tem o módulo 'fluxo-caixa', então a tela mostra o
  // histórico real de entradas e saídas (coberto por src/test/rls/fluxo_caixa.test.ts).
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
      // Ordem cronológica (mais antigo primeiro): é o que faz o saldo acumulado
      // de cada linha significar "saldo até esta data", como num extrato.
      .sort((a, b) => getDataEfetiva(a).getTime() - getDataEfetiva(b).getTime());
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
        entrada: realizado + aReceber,
        saida: pago + aPagar,
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

  const selectedBancoName = selectedBancoId
    ? bancos.find(b => b.id === selectedBancoId)?.nome
    : null;

  return (
    <div className="flex-1 p-3 md:p-6 space-y-4 md:space-y-6 overflow-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
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
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
        className="glass-card rounded-xl overflow-x-auto"
      >
        <Table className="text-xs md:text-sm">
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/50">
              <TableHead className="text-muted-foreground">Data</TableHead>
              <TableHead className="text-muted-foreground">Descrição</TableHead>
              <TableHead className="text-muted-foreground">Banco</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground text-right">Entrada</TableHead>
              <TableHead className="text-muted-foreground text-right">Saída</TableHead>
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
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(index, 12) * 0.03, ease: 'easeOut' }}
                  className="table-row-hover border-border/30"
                >
                  <TableCell className="font-medium">
                    {format(parseISO(lancamento.data_pagamento || lancamento.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell>{lancamento.cliente_credor}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {lancamento.bancos?.nome || '-'}
                  </TableCell>
                  <TableCell><StatusLabel lancamento={lancamento} /></TableCell>
                  <TableCell className="text-right font-medium">
                    {lancamento.entrada > 0 ? (
                      <span className={lancamento.realizado > 0 ? 'text-success' : 'text-blue-400'}>
                        {formatCurrency(lancamento.entrada)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {lancamento.saida > 0 ? (
                      <span className={lancamento.pago > 0 ? 'text-destructive' : 'text-purple-400'}>
                        {formatCurrency(lancamento.saida)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-bold',
                      lancamento.saldoAcumulado < 0 ? 'text-destructive' : 'text-foreground'
                    )}
                  >
                    {formatCurrency(lancamento.saldoAcumulado)}
                  </TableCell>
                </motion.tr>
              ))
            )}
          </TableBody>
        </Table>
      </motion.div>

      <FluxoCaixaFAB
        onReceita={() => setReceitaFormOpen(true)}
        onDespesa={() => setDespesaFormOpen(true)}
        onTransferencia={() => setTransferenciaOpen(true)}
      />

      <LancamentoForm
        open={receitaFormOpen}
        onOpenChange={setReceitaFormOpen}
        tipo="receita"
      />

      <LancamentoForm
        open={despesaFormOpen}
        onOpenChange={setDespesaFormOpen}
        tipo="despesa"
      />

      <TransferenciaModal
        open={transferenciaOpen}
        onOpenChange={setTransferenciaOpen}
      />
    </div>
  );
}
