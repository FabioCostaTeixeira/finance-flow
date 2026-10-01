import { formatCurrency } from '@/lib/recurrence';
import type { PontoFluxo } from './types';

interface TooltipFluxoProps {
  active?: boolean;
  payload?: Array<{ payload?: PontoFluxo }>;
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

export function TooltipFluxo({ active, payload }: TooltipFluxoProps) {
  const ponto = payload?.[0]?.payload;

  if (!active || !ponto) {
    return null;
  }

  return (
    <div className="min-w-[15rem] rounded-lg border border-border/60 bg-popover px-3 py-2.5 text-popover-foreground shadow-xl">
      <p className="mb-3 text-sm font-semibold capitalize text-foreground">{ponto.rotuloCompleto}</p>
      <div className="space-y-2">
        <LinhaTooltip label="Entradas recebidas" valor={ponto.recebido} indicador="#2563EB" />
        <LinhaTooltip label="Entradas a receber" valor={ponto.aReceber} indicador="rgba(37, 99, 235, 0.38)" />
        <LinhaTooltip label="Saídas pagas" valor={ponto.pago} indicador="#8B0D16" />
        <LinhaTooltip label="Saídas a pagar" valor={ponto.aPagar} indicador="rgba(139, 13, 22, 0.38)" />
      </div>
      <div aria-hidden="true" className="my-2.5 border-t border-border/60" />
      <div className="space-y-2">
        <LinhaTooltip label="Saldo atual" valor={ponto.saldoAtual} destaque />
        <LinhaTooltip label="Saldo previsto" valor={ponto.saldoPrevisto} destaque />
        <LinhaTooltip
          label="Saldo acumulado"
          valor={ponto.saldoAcumulado}
          indicador="hsl(var(--chart-2))"
          destaque
        />
      </div>
    </div>
  );
}
