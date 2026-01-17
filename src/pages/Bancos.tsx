import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Landmark, TrendingUp, TrendingDown, Scale, Edit, Trash2, Plus, CheckCircle, Clock, Wallet, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/recurrence';
import { useBancosComSaldos, useBancos, useCreateBanco, useUpdateBanco, useDeleteBanco } from '@/hooks/useBancos';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Small component to manage bank names
function GerenciarBancosDialog() {
  const { data: bancos = [], isLoading } = useBancos();
  const createBanco = useCreateBanco();
  const updateBanco = useUpdateBanco();
  const deleteBanco = useDeleteBanco();

  const [newBankName, setNewBankName] = useState('');
  const [editingBank, setEditingBank] = useState<{ id: string, nome: string } | null>(null);

  const handleCreate = async () => {
    if (!newBankName.trim()) return;
    try {
      await createBanco.mutateAsync(newBankName.trim());
      toast({ title: 'Banco criado com sucesso!' });
      setNewBankName('');
    } catch (error) {
      toast({ title: 'Erro ao criar banco', variant: 'destructive' });
    }
  };

  const handleUpdate = async () => {
    if (!editingBank || !editingBank.nome.trim()) return;
    try {
      await updateBanco.mutateAsync({ id: editingBank.id, nome: editingBank.nome.trim() });
      toast({ title: 'Banco atualizado com sucesso!' });
      setEditingBank(null);
    } catch (error) {
      toast({ title: 'Erro ao atualizar banco', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBanco.mutateAsync(id);
      toast({ title: 'Banco excluído com sucesso!' });
    } catch (error) {
      toast({ title: 'Erro ao excluir banco', description: 'Verifique se não há lançamentos associados a este banco.', variant: 'destructive' });
    }
  };

  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Gerenciar Bancos</DialogTitle>
        <DialogDescription>Adicione, edite ou remova os nomes dos seus bancos.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="flex gap-2">
          <Input
            placeholder="Nome do novo banco"
            value={newBankName}
            onChange={(e) => setNewBankName(e.target.value)}
          />
          <Button onClick={handleCreate} disabled={createBanco.isPending}>
            <Plus className="w-4 h-4 mr-2" /> Adicionar
          </Button>
        </div>
        <div className="max-h-60 overflow-y-auto pr-2 space-y-2">
          {isLoading ? <p>Carregando...</p> : bancos.map(banco => (
            <div key={banco.id} className="flex items-center gap-2">
              {editingBank?.id === banco.id ? (
                <Input
                  value={editingBank.nome}
                  onChange={(e) => setEditingBank({ ...editingBank, nome: e.target.value })}
                  className="flex-1"
                />
              ) : (
                <p className="flex-1 p-2">{banco.nome}</p>
              )}
              {editingBank?.id === banco.id ? (
                <Button size="sm" onClick={handleUpdate} disabled={updateBanco.isPending}>Salvar</Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setEditingBank(banco)}>
                  <Edit className="w-4 h-4" />
                </Button>
              )}
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(banco.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </DialogContent>
  );
}


export default function BancosPage() {
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

  const stats = [
    {
      label: 'Entradas - Projetado',
      value: formatCurrency(totals.entradasProjetado),
      icon: TrendingUp,
      color: 'text-primary/70',
      bg: 'bg-primary/10',
    },
    {
      label: 'Entradas - Recebido',
      value: formatCurrency(totals.entradasRecebido),
      icon: CheckCircle,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Saídas - A Pagar',
      value: formatCurrency(totals.saidasAPagar),
      icon: Clock,
      color: 'text-destructive/70',
      bg: 'bg-destructive/10',
    },
    {
      label: 'Saídas - Pago',
      value: formatCurrency(totals.saidasPago),
      icon: ArrowDownCircle,
      color: 'text-destructive',
      bg: 'bg-destructive/10',
    },
    {
      label: 'Saldo - Projetado',
      value: formatCurrency(totals.saldoProjetado),
      icon: Scale,
      color: totals.saldoProjetado >= 0 ? 'text-success/70' : 'text-amber-500/70',
      bg: totals.saldoProjetado >= 0 ? 'bg-success/10' : 'bg-amber-500/10',
    },
    {
      label: 'Saldo - Atual',
      value: formatCurrency(totals.saldoAtual),
      icon: Wallet,
      color: totals.saldoAtual >= 0 ? 'text-success' : 'text-amber-500',
      bg: totals.saldoAtual >= 0 ? 'bg-success/10' : 'bg-amber-500/10',
    },
  ];

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
            <Landmark className="w-7 h-7 text-primary" />
            Bancos e Saldos
          </h1>
          <p className="text-muted-foreground mt-1">
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
              <Button variant="outline">Gerenciar Nomes</Button>
            </DialogTrigger>
            <GerenciarBancosDialog />
          </Dialog>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4"
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
              <TableHead className="text-muted-foreground" rowSpan={2}>Banco</TableHead>
              <TableHead className="text-muted-foreground text-center border-l border-border/30" colSpan={2}>Entradas</TableHead>
              <TableHead className="text-muted-foreground text-center border-l border-border/30" colSpan={2}>Saídas</TableHead>
              <TableHead className="text-muted-foreground text-center border-l border-border/30" colSpan={2}>Saldo</TableHead>
            </TableRow>
            <TableRow className="hover:bg-transparent border-border/50">
              <TableHead className="text-muted-foreground text-right text-xs border-l border-border/30">Projetado</TableHead>
              <TableHead className="text-muted-foreground text-right text-xs">Recebido</TableHead>
              <TableHead className="text-muted-foreground text-right text-xs border-l border-border/30">A Pagar</TableHead>
              <TableHead className="text-muted-foreground text-right text-xs">Pago</TableHead>
              <TableHead className="text-muted-foreground text-right text-xs border-l border-border/30">Projetado</TableHead>
              <TableHead className="text-muted-foreground text-right text-xs">Atual</TableHead>
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
                    <motion.tr
                      key={banco.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="table-row-hover border-border/30"
                    >
                      <TableCell className="font-medium">{banco.nome}</TableCell>
                      {/* Entradas */}
                      <TableCell className="text-right text-primary/70 border-l border-border/30">{formatCurrency(banco.total_entradas)}</TableCell>
                      <TableCell className="text-right text-primary font-semibold">{formatCurrency(banco.entradas_recebidas)}</TableCell>
                      {/* Saídas */}
                      <TableCell className="text-right text-destructive/70 border-l border-border/30">{formatCurrency(banco.saidas_a_pagar)}</TableCell>
                      <TableCell className="text-right text-destructive font-semibold">{formatCurrency(banco.saidas_pagas)}</TableCell>
                      {/* Saldo */}
                      <TableCell className={cn(
                        "text-right border-l border-border/30",
                        banco.saldo >= 0 ? "text-success/70" : "text-amber-500/70"
                      )}>
                        {formatCurrency(banco.saldo)}
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-bold",
                        saldoAtual >= 0 ? "text-success" : "text-amber-500"
                      )}>
                        {formatCurrency(saldoAtual)}
                      </TableCell>
                    </motion.tr>
                  );
                })
            )}
          </TableBody>
        </Table>
      </motion.div>
    </div>
  );
}
