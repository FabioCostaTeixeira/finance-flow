import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MoreHorizontal, Trash2, CheckCircle, DollarSign, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { LancamentoExtendido, useDeleteLancamento } from '@/hooks/useLancamentos';
import { useDeleteLancamentosEmLote } from '@/hooks/useDeleteLancamentosEmLote';
import { useCategorias } from '@/hooks/useCategorias';
import { BaixaModal } from './BaixaModal';
import { LancamentosFilters, LancamentosFiltersState } from './LancamentosFilters';
import { formatCurrency } from '@/lib/recurrence';
import { getComputedStatus, getStatusConfig } from '@/lib/statusUtils';
import { toast } from '@/hooks/use-toast';

interface LancamentosTableProps {
  tipo: 'receita' | 'despesa';
  lancamentos: LancamentoExtendido[];
  isLoading: boolean;
  filters: LancamentosFiltersState;
  onFiltersChange: (filters: LancamentosFiltersState) => void;
}

export function LancamentosTable({
  tipo,
  lancamentos,
  isLoading,
  filters,
  onFiltersChange,
}: LancamentosTableProps) {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  
  const { data: categorias = [] } = useCategorias(tipo);
  const deleteLancamento = useDeleteLancamento();
  const deleteLancamentosEmLote = useDeleteLancamentosEmLote();
  
  const [selectedLancamento, setSelectedLancamento] = useState<LancamentoExtendido | null>(null);
  const [baixaModalOpen, setBaixaModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const isReceita = tipo === 'receita';

  // Scroll para o item destacado
  useEffect(() => {
    if (highlightId) {
      const element = document.getElementById(`lancamento-${highlightId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightId, lancamentos]);

  // Lançamentos que podem ser excluídos (não quitados)
  const lancamentosDeletaveis = lancamentos.filter((l) => 
    !['recebido', 'pago'].includes(l.status)
  );

  const handleBaixar = (lancamento: LancamentoExtendido) => {
    setSelectedLancamento(lancamento);
    setBaixaModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLancamento.mutateAsync(id);
      toast({
        title: 'Lançamento excluído',
        description: 'O lançamento foi excluído com sucesso.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o lançamento.',
        variant: 'destructive',
      });
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const deletaveisIds = new Set(lancamentosDeletaveis.map((l) => l.id));
      setSelectedIds(deletaveisIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDeleteSelected = async () => {
    try {
      await deleteLancamentosEmLote.mutateAsync(Array.from(selectedIds));
      toast({
        title: 'Lançamentos excluídos',
        description: `${selectedIds.size} lançamento(s) excluído(s) com sucesso.`,
      });
      setSelectedIds(new Set());
      setDeleteDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir os lançamentos.',
        variant: 'destructive',
      });
    }
  };

  const isSelectable = (lancamento: LancamentoExtendido) => {
    return !['recebido', 'pago'].includes(lancamento.status);
  };

  const allDeletaveisSelected = lancamentosDeletaveis.length > 0 && 
    lancamentosDeletaveis.every((l) => selectedIds.has(l.id));

  const getStatusBadge = (lancamento: LancamentoExtendido) => {
    const computedStatus = getComputedStatus({
      status: lancamento.status,
      tipo: lancamento.tipo,
      data_vencimento: lancamento.data_vencimento,
      valor: lancamento.valor,
      valor_pago: lancamento.valor_pago,
    });
    
    const config = getStatusConfig(computedStatus, tipo);

    return (
      <span className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        config.className
      )}>
        {config.label}
      </span>
    );
  };

  const canBaixar = (lancamento: LancamentoExtendido) => {
    const computedStatus = getComputedStatus({
      status: lancamento.status,
      tipo: lancamento.tipo,
      data_vencimento: lancamento.data_vencimento,
      valor: lancamento.valor,
      valor_pago: lancamento.valor_pago,
    });
    return ['a_receber', 'a_pagar', 'parcial', 'atrasado', 'vencida'].includes(computedStatus);
  };

  // Get category display name with parent if subcategory
  const getCategoryDisplay = (lancamento: LancamentoExtendido) => {
    const cat = categorias.find((c) => c.id === lancamento.categoria_id);
    if (!cat) return '-';
    
    if (cat.categoria_pai_id) {
      const parent = categorias.find((c) => c.id === cat.categoria_pai_id);
      if (parent) {
        return `${parent.nome} > ${cat.nome}`;
      }
    }
    return cat.nome;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <LancamentosFilters
        tipo={tipo}
        filters={filters}
        onFiltersChange={onFiltersChange}
      />

      {/* Barra de ações em lote */}
      {selectedIds.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 p-3 glass-card rounded-lg bg-destructive/5 border-destructive/20"
        >
          <span className="text-sm font-medium">
            {selectedIds.size} item(s) selecionado(s)
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Excluir Selecionados
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
          >
            Cancelar
          </Button>
        </motion.div>
      )}

      <div className="glass-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/50">
              <TableHead className="w-12">
                <Checkbox
                  checked={allDeletaveisSelected}
                  onCheckedChange={handleSelectAll}
                  disabled={lancamentosDeletaveis.length === 0}
                  aria-label="Selecionar todos"
                />
              </TableHead>
              <TableHead className="text-muted-foreground">Data</TableHead>
              <TableHead className="text-muted-foreground">
                {isReceita ? 'Cliente' : 'Credor'}
              </TableHead>
              <TableHead className="text-muted-foreground">Valor</TableHead>
              <TableHead className="text-muted-foreground">Banco</TableHead>
              <TableHead className="text-muted-foreground">Categoria</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground">Parcela</TableHead>
              <TableHead className="text-muted-foreground text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lancamentos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Nenhum lançamento encontrado
                </TableCell>
              </TableRow>
            ) : (
              lancamentos.map((lancamento, index) => {
                const isDeletavel = isSelectable(lancamento);
                const isHighlighted = lancamento.id === highlightId;

                return (
                  <motion.tr
                    key={lancamento.id}
                    id={`lancamento-${lancamento.id}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "table-row-hover border-border/30",
                      isHighlighted && "bg-primary/10 ring-2 ring-primary/50",
                      !isDeletavel && "opacity-70"
                    )}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(lancamento.id)}
                        onCheckedChange={(checked) => handleSelectOne(lancamento.id, checked as boolean)}
                        disabled={!isDeletavel}
                        aria-label={`Selecionar ${lancamento.cliente_credor}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {format(new Date(lancamento.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>{lancamento.cliente_credor}</TableCell>
                    <TableCell className={cn(
                      'font-semibold',
                      isReceita ? 'text-primary' : 'text-destructive'
                    )}>
                      {formatCurrency(Number(lancamento.valor))}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {lancamento.bancos?.nome || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {getCategoryDisplay(lancamento)}
                    </TableCell>
                    <TableCell>{getStatusBadge(lancamento)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {lancamento.total_parcelas > 1
                        ? `${lancamento.parcela_atual}/${lancamento.total_parcelas}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canBaixar(lancamento) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className={cn(
                              'gap-1',
                              isReceita
                                ? 'border-primary/50 text-primary hover:bg-primary/10'
                                : 'border-destructive/50 text-destructive hover:bg-destructive/10'
                            )}
                            onClick={() => handleBaixar(lancamento)}
                          >
                            {isReceita ? (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                Receber
                              </>
                            ) : (
                              <>
                                <DollarSign className="w-4 h-4" />
                                Pagar
                              </>
                            )}
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDelete(lancamento.id)}
                              disabled={!isDeletavel}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </motion.tr>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <BaixaModal
        lancamento={selectedLancamento}
        open={baixaModalOpen}
        onOpenChange={setBaixaModalOpen}
      />

      {/* Dialog de confirmação de exclusão em lote */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Confirmar Exclusão em Lote
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Você está prestes a excluir <strong>{selectedIds.size} lançamento(s)</strong>.
              </p>
              <p className="text-destructive font-medium">
                ⚠️ Esta ação não pode ser desfeita. Os dados excluídos não poderão ser recuperados.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleteLancamentosEmLote.isPending}
            >
              {deleteLancamentosEmLote.isPending ? 'Excluindo...' : 'Confirmar Exclusão'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}