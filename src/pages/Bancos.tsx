import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Landmark } from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { formatCurrency } from '@/lib/recurrence';
import { useBancosComSaldos, useBancos } from '@/hooks/useBancos';
import { DateRange } from 'react-day-picker';
import { startOfMonth, endOfMonth } from 'date-fns';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { GerenciarBancosDialog } from '@/components/GerenciarBancosDialog';


export default function BancosPage() {
  const navigate = useNavigate();
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [selectedBancoId, setSelectedBancoId] = useState<string | undefined>(undefined);

  const { data: bancosComSaldo = [], isLoading } = useBancosComSaldos(date?.from, date?.to);
  const { data: bancosList = [] } = useBancos();

  // Filtrar bancos se um banco específico foi selecionado
  const filteredBancos = useMemo(() => {
    if (!selectedBancoId) return bancosComSaldo;
    return bancosComSaldo.filter(banco => banco.id === selectedBancoId);
  }, [bancosComSaldo, selectedBancoId]);

  // Calcular totais dos cards baseado nos bancos filtrados
  const totals = useMemo(() => {
    return filteredBancos.reduce((acc, banco) => ({
      entradasProjetado: acc.entradasProjetado + banco.total_entradas,
      entradasRecebido: acc.entradasRecebido + banco.entradas_recebidas,
      saidasAPagar: acc.saidasAPagar + banco.saidas_a_pagar,
      saidasPago: acc.saidasPago + banco.saidas_pagas,
      saldoProjetado: acc.saldoProjetado + banco.saldo,
      saldoAtual: acc.saldoAtual + (banco.entradas_recebidas - banco.saidas_pagas),
    }), {
      entradasProjetado: 0,
      entradasRecebido: 0,
      saidasAPagar: 0,
      saidasPago: 0,
      saldoProjetado: 0,
      saldoAtual: 0,
    });
  }, [filteredBancos]);

  const saldoRealizado = totals.entradasRecebido - totals.saidasPago;
  const saldoFuturo = (totals.entradasProjetado - totals.entradasRecebido) - (totals.saidasAPagar - totals.saidasPago) + saldoRealizado;

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
            <Landmark className="w-5 h-5 md:w-7 md:h-7 text-primary" />
            Bancos e Saldos
          </h1>
          <p className="text-muted-foreground mt-1 text-xs md:text-base">
            Visualize o fluxo de caixa por banco em um período.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Select
            value={selectedBancoId || "all"}
            onValueChange={(value) => setSelectedBancoId(value === "all" ? undefined : value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todos os bancos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os bancos</SelectItem>
              {bancosList.map((banco) => (
                <SelectItem key={banco.id} value={banco.id}>
                  {banco.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DatePickerWithRange date={date} onDateChange={setDate} />
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="min-h-[44px]">Gerenciar Nomes</Button>
            </DialogTrigger>
            <GerenciarBancosDialog />
          </Dialog>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        <KpiCard
          title="Saldo Realizado"
          badgeLabel="Realizado"
          mainValue={saldoRealizado}
          stats={[
            { label: 'Recebidos', value: totals.entradasRecebido, colorClass: 'text-success', barColorClass: 'bg-success' },
            { label: 'Pagos', value: totals.saidasPago, colorClass: 'text-destructive', barColorClass: 'bg-destructive' },
          ]}
          delay={0.1}
        />
        <KpiCard
          title="Saldo Futuro"
          badgeLabel="Projetado"
          mainValue={saldoFuturo}
          stats={[
            { label: 'A Receber', value: totals.entradasProjetado - totals.entradasRecebido, colorClass: 'text-blue-400', barColorClass: 'bg-blue-500' },
            { label: 'A Pagar', value: totals.saidasAPagar - totals.saidasPago, colorClass: 'text-purple-400', barColorClass: 'bg-purple-500' },
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
              <TableHead className="text-muted-foreground" rowSpan={2}>Banco</TableHead>
              {/* Grupo: Saldo Atual */}
              <TableHead className="text-center border-l border-border/30 bg-emerald-950/30 text-emerald-400/90 text-xs font-semibold" colSpan={1}>Saldo Atual</TableHead>
              {/* Grupo: Realizado */}
              <TableHead className="text-center border-l border-border/30 bg-blue-950/30 text-blue-400/90 text-xs font-semibold" colSpan={2}>Realizado</TableHead>
              {/* Grupo: Projetado */}
              <TableHead className="text-center border-l border-border/30 bg-purple-950/30 text-purple-400/90 text-xs font-semibold" colSpan={2}>Projetado</TableHead>
              {/* Grupo: Saldo Projetado */}
              <TableHead className="text-center border-l border-border/30 bg-amber-950/30 text-amber-400/90 text-xs font-semibold" colSpan={1}>Saldo Projetado</TableHead>
            </TableRow>
            <TableRow className="hover:bg-transparent border-border/50">
              <TableHead className="text-right text-xs border-l border-border/30 bg-emerald-950/20 text-emerald-400/70">Atual</TableHead>
              <TableHead className="text-right text-xs border-l border-border/30 bg-blue-950/20 text-blue-400/70">Recebido</TableHead>
              <TableHead className="text-right text-xs bg-blue-950/20 text-blue-400/70">Pago</TableHead>
              <TableHead className="text-right text-xs border-l border-border/30 bg-purple-950/20 text-purple-400/70">A Receber</TableHead>
              <TableHead className="text-right text-xs bg-purple-950/20 text-purple-400/70">A Pagar</TableHead>
              <TableHead className="text-right text-xs border-l border-border/30 bg-amber-950/20 text-amber-400/70">Projetado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">Carregando dados...</TableCell></TableRow>
            ) : filteredBancos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhum dado encontrado para o período.
                </TableCell>
              </TableRow>
            ) : (
                filteredBancos.map((banco, index) => {
                  const saldoAtual = banco.entradas_recebidas - banco.saidas_pagas;
                  return (
                    <Tooltip key={banco.id}>
                      <TooltipTrigger asChild>
                        <motion.tr
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: Math.min(index, 12) * 0.03, ease: 'easeOut' }}
                          className="table-row-hover border-border/30 cursor-pointer"
                          onClick={() => navigate(`/fluxo-caixa?bancoId=${banco.id}`)}
                        >
                          <TableCell className="font-medium">{banco.nome}</TableCell>
                          {/* Saldo Atual */}
                          <TableCell className={cn(
                            "text-right font-bold border-l border-border/30 bg-emerald-950/10",
                            saldoAtual >= 0 ? "text-emerald-400" : "text-amber-500"
                          )}>
                            {formatCurrency(saldoAtual)}
                          </TableCell>
                          {/* Realizado */}
                          <TableCell className="text-right text-blue-400 font-semibold border-l border-border/30 bg-blue-950/10">{formatCurrency(banco.entradas_recebidas)}</TableCell>
                          <TableCell className="text-right text-blue-300/70 bg-blue-950/10">{formatCurrency(banco.saidas_pagas)}</TableCell>
                          {/* Projetado */}
                          <TableCell className="text-right text-purple-400 border-l border-border/30 bg-purple-950/10">{formatCurrency(banco.entradas_a_receber)}</TableCell>
                          <TableCell className="text-right text-purple-300/70 bg-purple-950/10">{formatCurrency(banco.saidas_a_pagar)}</TableCell>
                          {/* Saldo Projetado */}
                          <TableCell className={cn(
                            "text-right border-l border-border/30 bg-amber-950/10",
                            banco.saldo >= 0 ? "text-amber-400" : "text-red-400"
                          )}>
                            {formatCurrency(banco.saldo)}
                          </TableCell>
                        </motion.tr>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Clique para ver o fluxo de caixa deste banco</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })
            )}
          </TableBody>
        </Table>
      </motion.div>
    </div>
  );
}
