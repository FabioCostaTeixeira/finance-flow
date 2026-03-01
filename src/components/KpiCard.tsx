import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/recurrence';

interface KpiStatItem {
  label: string;
  value: number;
  colorClass: string; // tailwind text color class
  barColorClass: string; // tailwind bg color class
}

interface KpiCardProps {
  title: string;
  badgeLabel?: string;
  mainValue: number;
  stats: [KpiStatItem, KpiStatItem];
  delay?: number;
}

export function KpiCard({ title, badgeLabel, mainValue, stats, delay = 0 }: KpiCardProps) {
  const total = stats[0].value + stats[1].value;
  const pct0 = total > 0 ? (stats[0].value / total) * 100 : 0;
  const pct1 = total > 0 ? (stats[1].value / total) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay }}
      className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-4 md:p-6 flex flex-col justify-between gap-3 shadow-lg hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl transition-all duration-300"
    >
      {/* Rotating glow */}
      <div className="pointer-events-none absolute -top-1/2 -left-1/2 w-[200%] h-[200%] animate-[spin_12s_linear_infinite] opacity-30"
        style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.08) 0%, transparent 60%)' }}
      />

      {/* Header */}
      <div className="flex items-center justify-between relative z-10">
        <h2 className="text-xs md:text-sm text-muted-foreground font-normal">{title}</h2>
        {badgeLabel && (
          <span className="flex items-center gap-1 rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-[9px] md:text-[10px] font-bold text-success uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            {badgeLabel}
          </span>
        )}
      </div>

      {/* Main value */}
      <p className="relative z-10 text-2xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-transparent leading-tight">
        {formatCurrency(mainValue)}
      </p>

      {/* Divider */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* Stats grid */}
      <div className="relative z-10 grid grid-cols-2 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <span className="text-[9px] md:text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
              {stat.label}
            </span>
            <span className={cn('text-xs md:text-sm font-bold', stat.colorClass)}>
              {formatCurrency(stat.value)}
            </span>
            <div className="w-full h-1 rounded-full bg-muted/50 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${i === 0 ? pct0 : pct1}%` }}
                transition={{ duration: 1.2, ease: [0.65, 0, 0.35, 1], delay: delay + 0.3 }}
                className={cn('h-full rounded-full', stat.barColorClass)}
                style={{ boxShadow: `0 0 8px hsl(var(--primary) / 0.3)` }}
              />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
