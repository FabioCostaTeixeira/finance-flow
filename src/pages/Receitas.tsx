import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { LancamentosTable } from '@/components/LancamentosTable';
import { LancamentoForm } from '@/components/LancamentoForm';
import { FloatingActionButton } from '@/components/FloatingActionButton';
import { KpiCard } from '@/components/KpiCard';
import { useLancamentos } from '@/hooks/useLancamentos';
import { useCategorias } from '@/hooks/useCategorias';
import { useLancamentosFilter } from '@/hooks/useLancamentosFilter';
import { LancamentosFiltersState } from '@/components/LancamentosFilters';

export default function ReceitasPage() {
  const [formOpen, setFormOpen] = useState(false);
  const { data: lancamentos = [], isLoading } = useLancamentos('receita');
  const { data: categorias = [] } = useCategorias('receita');

  const [filters, setFilters] = useState<LancamentosFiltersState>({
    dataInicio: startOfMonth(new Date()),
    dataFim: endOfMonth(new Date()),
    categoriaIds: [],
    subcategoriaIds: [],
    statusList: [],
    bancoIds: [],
    searchTerm: undefined,
  });

  const { filteredLancamentos } = useLancamentosFilter(lancamentos, filters, categorias);
  
  const totalReceitas = filteredLancamentos.reduce((acc, l) => acc + Number(l.valor), 0);
  const totalRecebido = filteredLancamentos
    .filter((l) => l.status === 'recebido')
    .reduce((acc, l) => acc + Number(l.valor), 0);
  const totalAReceber = filteredLancamentos
    .filter((l) => ['a_receber', 'parcial'].includes(l.status))
    .reduce((acc, l) => acc + Number(l.valor) - Number(l.valor_pago || 0), 0);

  return (
    <div className="flex-1 p-3 md:p-6 space-y-4 md:space-y-6 overflow-auto">
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

      <FloatingActionButton onClick={() => setFormOpen(true)} variant="receita" />
      <LancamentoForm tipo="receita" open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
