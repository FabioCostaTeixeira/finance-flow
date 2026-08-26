import { Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FloatingActionButtonProps {
  onClick: () => void;
  variant?: 'receita' | 'despesa' | 'default';
}

export function FloatingActionButton({ onClick, variant = 'default' }: FloatingActionButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        'fab-button cursor-pointer',
        variant === 'receita' && 'bg-gradient-to-r from-blue-500 to-accent-vibrant',
        variant === 'despesa' && 'bg-gradient-to-r from-destructive to-rose-600',
        variant === 'default' && 'bg-gradient-to-r from-primary to-accent-vibrant'
      )}
    >
      <Plus className="w-6 h-6 text-white" />
    </motion.button>
  );
}
