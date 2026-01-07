import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { LancamentosTable } from '@/components/LancamentosTable';
import { LancamentoForm } from '@/components/LancamentoForm';
import { FloatingActionButton } from '@/components/FloatingActionButton';
import { useLancamentos } from '@/hooks/useLancamentos';
import { formatCurrency } from '@/lib/recurrence';

export default function ReceitasPage() {
  const [formOpen, setFormOpen] = useState(false);
  const { data: lancamentos = [] } = useLancamentos('receita');

  // Calcular totais
  const totalReceitas = lancamentos.reduce((acc, l) => acc + Number(l.valor), 0);
  const totalRecebido = lancamentos
    .filter((l) => l.status === 'recebido')
    .reduce((acc, l) => acc + Number(l.valor), 0);
  const totalAReceber = lancamentos
    .filter((l) => ['a_receber', 'parcial'].includes(l.status))
    .reduce((acc, l) => acc + Number(l.valor) - Number(l.valor_pago || 0), 0);

  const stats = [
    {
      label: 'Total de Receitas',
      value: formatCurrency(totalReceitas),
      icon: TrendingUp,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Recebido',
      value: formatCurrency(totalRecebido),
      icon: CheckCircle,
      color: 'text-success',
      bg: 'bg-success/10',
    },
    {
      label: 'A Receber',
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
        <LancamentosTable tipo="receita" />
      </motion.div>

      {/* FAB */}
      <FloatingActionButton onClick={() => setFormOpen(true)} variant="receita" />

      {/* Form Modal */}
      <LancamentoForm tipo="receita" open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
