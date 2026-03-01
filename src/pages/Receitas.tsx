import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { parseISO, isAfter, isBefore, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { LancamentosTable } from '@/components/LancamentosTable';
import { LancamentoForm } from '@/components/LancamentoForm';
import { FloatingActionButton } from '@/components/FloatingActionButton';
import { KpiCard } from '@/components/KpiCard';
import { useLancamentos } from '@/hooks/useLancamentos';
import { useCategorias } from '@/hooks/useCategorias';
import { LancamentosFiltersState } from '@/components/LancamentosFilters';
import { getComputedStatus } from '@/lib/statusUtils';

export default function ReceitasPage() {
  const [formOpen, setFormOpen] = useState(false);
  const { data: lancamentos = [], isLoading } = useLancamentos('receita');
  const { data: categorias = [] } = useCategorias('receita');

  const [filters, setFilters] = useState<LancamentosFiltersState>({
    dataInicio: startOfMonth(new Date()),
    dataFim: endOfMonth(new Date()),
    categoriaId: undefined,
    subcategoriaId: undefined,
    status: undefined,
    bancoId: undefined,
    searchTerm: undefined,
  });

  const getParentCategoryId = (categoriaId: string | null): string | null => {
    if (!categoriaId) return null;
    const cat = categorias.find((c) => c.id === categoriaId);
    return cat?.categoria_pai_id || null;
  };

  const filteredLancamentos = useMemo(() => {
    return lancamentos.filter((lancamento) => {
      // Filtro por nome (cliente/credor)
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        if (!lancamento.cliente_credor.toLowerCase().includes(searchLower)) {
          return false;
        }
      }
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
      if (filters.bancoId) {
        if (lancamento.banco_id !== filters.bancoId) return false;
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

  return (
    <div className="flex-1 p-3 md:p-6 space-y-4 md:space-y-6 overflow-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="pl-10 md:pl-0">
          <h1 className="text-lg md:text-2xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5 md:w-7 md:h-7 text-primary" />
            Receitas
          </h1>
          <p className="text-muted-foreground mt-1 text-xs md:text-base">
            Gerencie suas entradas financeiras
          </p>
        </div>
      </motion.div>

      {/* KPI Card */}
      <div className="max-w-md">
        <KpiCard
          title="Total de Receitas"
          badgeLabel="Filtrado"
          mainValue={totalReceitas}
          stats={[
            { label: 'A Receber', value: totalAReceber, colorClass: 'text-blue-400', barColorClass: 'bg-blue-500' },
            { label: 'Recebido', value: totalRecebido, colorClass: 'text-success', barColorClass: 'bg-success' },
          ]}
          delay={0.1}
        />
      </div>

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
