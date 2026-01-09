import { useState } from 'react';
import { motion } from 'framer-motion';
import { Landmark, Plus, Pencil, Trash2, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
  useBancos,
  useBancosComSaldos,
  useCreateBanco,
  useUpdateBanco,
  useDeleteBanco,
} from '@/hooks/useBancos';
import { formatCurrency } from '@/lib/recurrence';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function BancosPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBanco, setSelectedBanco] = useState<{ id: string; nome: string } | null>(null);
  const [bancoNome, setBancoNome] = useState('');

  const { data: bancos = [] } = useBancos();
  const { data: saldos = [], isLoading } = useBancosComSaldos(dateRange?.from, dateRange?.to);
  const createBanco = useCreateBanco();
  const updateBanco = useUpdateBanco();
  const deleteBanco = useDeleteBanco();

  const handleOpenModal = (banco?: { id: string; nome: string }) => {
    if (banco) {
      setSelectedBanco(banco);
      setBancoNome(banco.nome);
    } else {
      setSelectedBanco(null);
      setBancoNome('');
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!bancoNome.trim()) return;

    try {
      if (selectedBanco) {
        await updateBanco.mutateAsync({ id: selectedBanco.id, nome: bancoNome.trim() });
        toast({ title: 'Banco atualizado', description: 'O nome do banco foi alterado.' });
      } else {
        await createBanco.mutateAsync(bancoNome.trim());
        toast({ title: 'Banco criado', description: 'O novo banco foi adicionado.' });
      }
      setModalOpen(false);
      setBancoNome('');
      setSelectedBanco(null);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar o banco.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedBanco) return;

    try {
      await deleteBanco.mutateAsync(selectedBanco.id);
      toast({ title: 'Banco excluído', description: 'O banco foi removido.' });
      setDeleteDialogOpen(false);
      setSelectedBanco(null);
    } catch (error) {
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o banco. Verifique se há lançamentos vinculados.',
        variant: 'destructive',
      });
    }
  };

  const totalEntradas = saldos.reduce((acc, s) => acc + Number(s.total_entradas), 0);
  const totalSaidas = saldos.reduce((acc, s) => acc + Number(s.total_saidas), 0);
  const saldoTotal = saldos.reduce((acc, s) => acc + Number(s.saldo), 0);

  return (
    <div className="flex-1 p-6 overflow-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Landmark className="w-7 h-7 text-primary" />
              Bancos
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie seus bancos e visualize saldos
            </p>
          </div>
          <Button onClick={() => handleOpenModal()} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Banco
          </Button>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-80">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
          {dateRange && (
            <Button variant="ghost" size="sm" onClick={() => setDateRange(undefined)}>
              Limpar filtro
            </Button>
          )}
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Entradas</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(totalEntradas)}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Saídas</p>
              <p className="text-xl font-bold text-destructive">{formatCurrency(totalSaidas)}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              saldoTotal >= 0 ? 'bg-primary/10' : 'bg-destructive/10'
            )}>
              <Wallet className={cn('w-5 h-5', saldoTotal >= 0 ? 'text-primary' : 'text-destructive')} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Saldo Total</p>
              <p className={cn(
                'text-xl font-bold',
                saldoTotal >= 0 ? 'text-primary' : 'text-destructive'
              )}>
                {formatCurrency(saldoTotal)}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Saldos Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card rounded-xl overflow-hidden"
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/50">
              <TableHead className="text-muted-foreground">Banco</TableHead>
              <TableHead className="text-muted-foreground text-right">Entradas</TableHead>
              <TableHead className="text-muted-foreground text-right">Saídas</TableHead>
              <TableHead className="text-muted-foreground text-right">Saldo</TableHead>
              <TableHead className="text-muted-foreground text-right">Ações</TableHead>
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
            ) : saldos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhum banco cadastrado
                </TableCell>
              </TableRow>
            ) : (
              saldos.map((saldo, index) => (
                <motion.tr
                  key={saldo.banco_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="table-row-hover border-border/30"
                >
                  <TableCell className="font-medium">{saldo.banco_nome}</TableCell>
                  <TableCell className="text-right text-primary font-semibold">
                    {formatCurrency(Number(saldo.total_entradas))}
                  </TableCell>
                  <TableCell className="text-right text-destructive font-semibold">
                    {formatCurrency(Number(saldo.total_saidas))}
                  </TableCell>
                  <TableCell className={cn(
                    'text-right font-bold',
                    Number(saldo.saldo) >= 0 ? 'text-primary' : 'text-destructive'
                  )}>
                    {formatCurrency(Number(saldo.saldo))}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenModal({ id: saldo.banco_id, nome: saldo.banco_nome })}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setSelectedBanco({ id: saldo.banco_id, nome: saldo.banco_nome });
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </motion.tr>
              ))
            )}
          </TableBody>
        </Table>
      </motion.div>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[400px] glass-card">
          <DialogHeader>
            <DialogTitle>
              {selectedBanco ? 'Editar Banco' : 'Novo Banco'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Banco</Label>
              <Input
                id="nome"
                value={bancoNome}
                onChange={(e) => setBancoNome(e.target.value)}
                placeholder="Ex: Nubank, Itaú, etc."
                className="input-glass"
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={!bancoNome.trim() || createBanco.isPending || updateBanco.isPending}
              >
                {createBanco.isPending || updateBanco.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir banco?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o banco "{selectedBanco?.nome}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
