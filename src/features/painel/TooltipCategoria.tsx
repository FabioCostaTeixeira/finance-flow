import { formatCurrency } from '@/lib/recurrence';
import type { CategoriaRanking } from './types';

interface TooltipCategoriaProps {
  active?: boolean;
  payload?: Array<{ payload?: CategoriaRanking }>;
}

interface LinhaTooltipProps {
  label: string;
  valor: number;
  indicador?: string;
  destaque?: boolean;
}

function LinhaTooltip({ label, valor, indicador, destaque = false }: LinhaTooltipProps) {
  return (
    <div className="flex items-center justify-between gap-6 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        {indicador ? (
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: indicador }}
          />
        ) : null}
        {label}
      </span>
      <span className={destaque ? 'font-semibold tabular-nums text-foreground' : 'tabular-nums text-foreground'}>
        {formatCurrency(valor)}
      </span>
    </div>
  );
}

export function TooltipCategoria({ active, payload }: TooltipCategoriaProps) {
  const categoria = payload?.[0]?.payload;

  if (!active || !categoria) {
    return null;
  }

  return (
    <div className="min-w-[13rem] rounded-lg border border-border/60 bg-popover px-3 py-2.5 text-popover-foreground shadow-xl">
      <p className="mb-3 text-sm font-semibold text-foreground">{categoria.nome}</p>
      <div className="space-y-2">
        <LinhaTooltip label="Recebido" valor={categoria.recebido} indicador="#2563EB" />
        <LinhaTooltip label="A receber" valor={categoria.aReceber} indicador="rgba(37, 99, 235, 0.38)" />
      </div>
      <div aria-hidden="true" className="my-2.5 border-t border-border/60" />
      <LinhaTooltip label="Total" valor={categoria.total} destaque />
    </div>
  );
}
