import { useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MoreHorizontal, Trash2, CheckCircle, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
import { Badge } from '@/components/ui/badge';
import { LancamentoWithCategoria, useLancamentos, useDeleteLancamento } from '@/hooks/useLancamentos';
import { BaixaModal } from './BaixaModal';
import { formatCurrency, statusLabels } from '@/lib/recurrence';
import { toast } from '@/hooks/use-toast';

interface LancamentosTableProps {
  tipo: 'receita' | 'despesa';
}

export function LancamentosTable({ tipo }: LancamentosTableProps) {
  const { data: lancamentos = [], isLoading } = useLancamentos(tipo);
  const deleteLancamento = useDeleteLancamento();
  const [selectedLancamento, setSelectedLancamento] = useState<LancamentoWithCategoria | null>(null);
  const [baixaModalOpen, setBaixaModalOpen] = useState(false);

  const isReceita = tipo === 'receita';

  const handleBaixar = (lancamento: LancamentoWithCategoria) => {
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

  const getStatusBadge = (status: string) => {
    const statusClasses: Record<string, string> = {
      a_receber: 'status-a-receber',
      recebido: 'status-recebido',
      a_pagar: 'status-a-pagar',
      pago: 'status-pago',
      parcial: 'status-parcial',
    };

    return (
      <span className={cn('status-badge', statusClasses[status])}>
        {statusLabels[status]}
      </span>
    );
  };

  const canBaixar = (status: string) => {
    return ['a_receber', 'a_pagar', 'parcial'].includes(status);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="glass-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/50">
              <TableHead className="text-muted-foreground">Data</TableHead>
              <TableHead className="text-muted-foreground">
                {isReceita ? 'Cliente' : 'Credor'}
              </TableHead>
              <TableHead className="text-muted-foreground">Valor</TableHead>
              <TableHead className="text-muted-foreground">Categoria</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground">Parcela</TableHead>
              <TableHead className="text-muted-foreground text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lancamentos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhum lançamento encontrado
                </TableCell>
              </TableRow>
            ) : (
              lancamentos.map((lancamento, index) => (
                <motion.tr
                  key={lancamento.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="table-row-hover border-border/30"
                >
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
                    {lancamento.categorias?.nome || '-'}
                  </TableCell>
                  <TableCell>{getStatusBadge(lancamento.status)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {lancamento.total_parcelas > 1
                      ? `${lancamento.parcela_atual}/${lancamento.total_parcelas}`
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {canBaixar(lancamento.status) && (
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
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </motion.tr>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <BaixaModal
        lancamento={selectedLancamento}
        open={baixaModalOpen}
        onOpenChange={setBaixaModalOpen}
      />
    </>
  );
}
