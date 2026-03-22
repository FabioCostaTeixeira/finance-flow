import { useState } from 'react';
import { Plus, X, TrendingUp, TrendingDown, ArrowRightLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FluxoCaixaFABProps {
  onReceita: () => void;
  onDespesa: () => void;
  onTransferencia: () => void;
}

export function FluxoCaixaFAB({ onReceita, onDespesa, onTransferencia }: FluxoCaixaFABProps) {
  const [open, setOpen] = useState(false);

  const actions = [
    { label: 'Transferência', icon: ArrowRightLeft, onClick: onTransferencia, className: 'bg-muted text-foreground' },
    { label: 'Despesa', icon: TrendingDown, onClick: onDespesa, className: 'bg-destructive text-destructive-foreground' },
    { label: 'Receita', icon: TrendingUp, onClick: onReceita, className: 'bg-primary text-primary-foreground' },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse items-end gap-3">
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className="fab-button"
      >
        <motion.div animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2 }}>
          <Plus className="w-6 h-6 text-foreground" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {open && actions.map((action, i) => (
          <motion.div
            key={action.label}
            initial={{ opacity: 0, scale: 0.3, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.3, y: 20 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-2"
          >
            <span className="text-xs font-medium bg-card text-card-foreground px-2 py-1 rounded-md shadow-md border border-border">
              {action.label}
            </span>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => { action.onClick(); setOpen(false); }}
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center shadow-lg',
                action.className
              )}
            >
              <action.icon className="w-5 h-5" />
            </motion.button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
