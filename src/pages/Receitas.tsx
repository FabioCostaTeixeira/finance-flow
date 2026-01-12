import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, CheckCircle, Clock } from 'lucide-react';
import { parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { LancamentosTable } from '@/components/LancamentosTable';
import { LancamentoForm } from '@/components/LancamentoForm';
import { FloatingActionButton } from '@/components/FloatingActionButton';
import { useLancamentos } from '@/hooks/useLancamentos';
import { useCategorias } from '@/hooks/useCategorias';
import { formatCurrency } from '@/lib/recurrence';
import { LancamentosFiltersState } from '@/components/LancamentosFilters';
import { getComputedStatus } from '@/lib/statusUtils';

export default function ReceitasPage() {
  const [formOpen, setFormOpen] = useState(false);
  const { data: lancamentos = [], isLoading } = useLancamentos('receita');
  const { data: categorias = [] } = useCategorias('receita');

  const [filters, setFilters] = useState<LancamentosFiltersState>({
    dataInicio: undefined,
    dataFim: undefined,
    categoriaId: undefined,
    subcategoriaId: undefined,
    status: undefined,
  });

  const getParentCategoryId = (categoriaId: string | null): string | null => {
    if (!categoriaId) return null;
    const cat = categorias.find((c) => c.id === categoriaId);
    return cat?.categoria_pai_id || null;
  };

  const filteredLancamentos = useMemo(() => {
    return lancamentos.filter((lancamento) => {
      if (filters.dataInicio) {
        const lancDate = parseISO(lancamento.data_vencimento);
        if (isBefore(lancDate, startOfDay(filters.dataInicio))) return false;
      }
      if (filters.dataFim) {
        const lancDate = parseISO(lancamento.data_vencimento);
        if (isAfter(lancDate, endOfDay(filters.dataFim))) return false;
      }
      if (filters.categoriaId) {
        const lancCatId = lancamento.categoria_id;
        const lancParentId = getParentCategoryId(lancCatId);
        if (lancCatId !== filters.categoriaId && lancParentId !== filters.categoriaId) {
          return false;
        }
      }
      if (filters.subcategoriaId) {
        if (lancamento.categoria_id !== filters.subcategoriaId) return false;
      }
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
  
  // Calcular totais usando os dados filtrados
  const totalReceitas = filteredLancamentos.reduce((acc, l) => acc + Number(l.valor), 0);
  const totalRecebido = filteredLancamentos
    .filter((l) => l.status === 'recebido')
    .reduce((acc, l) => acc + Number(l.valor), 0);
  const totalAReceber = filteredLancamentos
    .filter((l) => ['a_receber', 'parcial'].includes(l.status))
    .reduce((acc, l) => acc + Number(l.valor) - Number(l.valor_pago || 0), 0);

  const stats = [
    {
      label: 'Total de Receitas (Filtrado)',
      value: formatCurrency(totalReceitas),
      icon: TrendingUp,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Recebido (Filtrado)',
      value: formatCurrency(totalRecebido),
      icon: CheckCircle,
      color: 'text-success',
      bg: 'bg-success/10',
    },
    {
      label: 'A Receber (Filtrado)',
      value: formatCurrency(totalAReceber),
      icon: Clock,
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
  ];

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
            <TrendingUp className="w-7 h-7 text-primary" />
            Receitas
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie suas entradas financeiras
          </p>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + index * 0.05 }}
            className="glass-card rounded-xl p-5"
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
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
      >
        <LancamentosTable
          tipo="receita"
          lancamentos={filteredLancamentos}
          isLoading={isLoading}
          filters={filters}
          onFiltersChange={setFilters}
        />
      </motion.div>

      {/* FAB */}
      <FloatingActionButton onClick={() => setFormOpen(true)} variant="receita" />

      {/* Form Modal */}
      <LancamentoForm tipo="receita" open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
