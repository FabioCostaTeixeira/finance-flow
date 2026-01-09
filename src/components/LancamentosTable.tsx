import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
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
import { LancamentoWithCategoria, useLancamentos, useDeleteLancamento } from '@/hooks/useLancamentos';
import { useCategorias } from '@/hooks/useCategorias';
import { BaixaModal } from './BaixaModal';
import { LancamentosFilters, LancamentosFiltersState } from './LancamentosFilters';
import { formatCurrency } from '@/lib/recurrence';
import { getComputedStatus, getStatusConfig } from '@/lib/statusUtils';
import { toast } from '@/hooks/use-toast';

interface LancamentosTableProps {
  tipo: 'receita' | 'despesa';
}

export function LancamentosTable({ tipo }: LancamentosTableProps) {
  const { data: lancamentos = [], isLoading } = useLancamentos(tipo);
  const { data: categorias = [] } = useCategorias(tipo);
  const deleteLancamento = useDeleteLancamento();
  const [selectedLancamento, setSelectedLancamento] = useState<LancamentoWithCategoria | null>(null);
  const [baixaModalOpen, setBaixaModalOpen] = useState(false);
  const [filters, setFilters] = useState<LancamentosFiltersState>({
    dataInicio: undefined,
    dataFim: undefined,
    categoriaId: undefined,
    subcategoriaId: undefined,
    status: undefined,
  });

  const isReceita = tipo === 'receita';

  // Helper to find parent category of a subcategory
  const getParentCategoryId = (categoriaId: string | null): string | null => {
    if (!categoriaId) return null;
    const cat = categorias.find((c) => c.id === categoriaId);
    return cat?.categoria_pai_id || null;
  };

  // Filter lancamentos
  const filteredLancamentos = useMemo(() => {
    return lancamentos.filter((lancamento) => {
      // Date filter
      if (filters.dataInicio) {
        const lancDate = parseISO(lancamento.data_vencimento);
        if (isBefore(lancDate, startOfDay(filters.dataInicio))) return false;
      }
      if (filters.dataFim) {
        const lancDate = parseISO(lancamento.data_vencimento);
        if (isAfter(lancDate, endOfDay(filters.dataFim))) return false;
      }

      // Category filter - check if lancamento category matches OR is a subcategory of filtered category
      if (filters.categoriaId) {
        const lancCatId = lancamento.categoria_id;
        const lancParentId = getParentCategoryId(lancCatId);
        
        // Match if lancamento category equals filter category OR parent equals filter category
        if (lancCatId !== filters.categoriaId && lancParentId !== filters.categoriaId) {
          return false;
        }
      }

      // Subcategory filter
      if (filters.subcategoriaId) {
        if (lancamento.categoria_id !== filters.subcategoriaId) return false;
      }

      // Status filter (considering computed status)
      if (filters.status) {
        const computedStatus = getComputedStatus({
          status: lancamento.status,
          tipo: lancamento.tipo,
          data_vencimento: lancamento.data_vencimento,
          valor: lancamento.valor,
          valor_pago: lancamento.valor_pago,
        });
        if (computedStatus !== filters.status) return false;
      }

      return true;
    });
  }, [lancamentos, filters, categorias]);

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

  const getStatusBadge = (lancamento: LancamentoWithCategoria) => {
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

  const canBaixar = (lancamento: LancamentoWithCategoria) => {
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
  const getCategoryDisplay = (lancamento: LancamentoWithCategoria) => {
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
        onFiltersChange={setFilters}
      />

      <div className="glass-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/50">
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
            {filteredLancamentos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhum lançamento encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredLancamentos.map((lancamento, index) => (
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
    </div>
  );
}
