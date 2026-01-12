import { useState } from 'react';
import { motion } from 'framer-motion';
import { Landmark, TrendingUp, TrendingDown, Scale, Edit, Trash2, Plus } from 'lucide-react';
import { formatCurrency } from '@/lib/recurrence';
import { useBancosComSaldos, useBancos, useCreateBanco, useUpdateBanco, useDeleteBanco } from '@/hooks/useBancos';
import { DateRange } from 'react-day-picker';
import { addDays, startOfMonth, endOfMonth } from 'date-fns';
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
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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

  const { data: bancosComSaldo = [], isLoading } = useBancosComSaldos(date?.from, date?.to);

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
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
        <div className="flex items-center gap-4">
            <DatePickerWithRange date={date} onDateChange={setDate} />
            <Dialog>
                <DialogTrigger asChild>
                    <Button variant="outline">Gerenciar Nomes</Button>
                </DialogTrigger>
                <GerenciarBancosDialog />
            </Dialog>
        </div>
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
              <TableHead className="text-muted-foreground">Banco</TableHead>
              <TableHead className="text-muted-foreground text-right">Entradas</TableHead>
              <TableHead className="text-muted-foreground text-right">Saídas</TableHead>
              <TableHead className="text-muted-foreground text-right">Saldo do Período</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8">Carregando dados...</TableCell></TableRow>
            ) : bancosComSaldo.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Nenhum dado encontrado para o período.
                </TableCell>
              </TableRow>
            ) : (
                bancosComSaldo.map((banco, index) => (
                <motion.tr
                  key={banco.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="table-row-hover border-border/30"
                >
                  <TableCell className="font-medium">{banco.nome}</TableCell>
                  <TableCell className="text-right text-primary font-semibold">{formatCurrency(banco.total_entradas)}</TableCell>
                  <TableCell className="text-right text-destructive font-semibold">{formatCurrency(banco.total_saidas)}</TableCell>
                  <TableCell className={cn(
                    "text-right font-bold",
                    banco.saldo >= 0 ? "text-success" : "text-amber-500"
                  )}>
                    {formatCurrency(banco.saldo)}
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
