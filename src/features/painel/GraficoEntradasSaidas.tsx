import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart';
import { formatCurrency } from '@/lib/recurrence';
import { TooltipFluxo } from './TooltipFluxo';
import type { PontoFluxo, VisaoPainel } from './types';

interface GraficoEntradasSaidasProps {
  pontos: PontoFluxo[];
  visao: VisaoPainel;
  periodoLabel: string;
  isLoading: boolean;
  error: Error | null;
  onVisaoChange: (visao: VisaoPainel) => void;
  onSemanaAnterior: () => void;
  onProximaSemana: () => void;
}

const chartConfig = {
  recebido: { label: 'Entradas recebidas', color: '#2563EB' },
  aReceber: { label: 'Entradas a receber', color: 'rgba(37, 99, 235, 0.38)' },
  pago: { label: 'Saídas pagas', color: '#8B0D16' },
  aPagar: { label: 'Saídas a pagar', color: 'rgba(139, 13, 22, 0.38)' },
  saldoAcumulado: { label: 'Saldo acumulado', color: 'hsl(var(--chart-2))' },
} satisfies ChartConfig;

function EstadoGrafico({
  children,
  tipo = 'status',
}: {
  children: React.ReactNode;
  tipo?: 'status' | 'alert';
}) {
  return (
    <div
      role={tipo}
      className="flex h-[20rem] items-center justify-center rounded-lg border border-border/60 px-6 text-center text-sm text-muted-foreground"
    >
      {children}
    </div>
  );
}

export function GraficoEntradasSaidas({
  pontos,
  visao,
  periodoLabel,
  isLoading,
  error,
  onVisaoChange,
  onSemanaAnterior,
  onProximaSemana,
}: GraficoEntradasSaidasProps) {
  return (
    <section aria-labelledby="grafico-entradas-saidas-titulo" className="flex h-full min-h-0 flex-col rounded-lg border border-border/60 bg-card p-4 text-card-foreground shadow-sm sm:p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="grafico-entradas-saidas-titulo" className="text-base font-semibold tracking-tight">
            Entradas e saídas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{periodoLabel}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {visao === 'semana' ? (
            <div className="flex items-center rounded-md border border-input bg-background" aria-label="Navegação semanal">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Semana anterior"
                onClick={onSemanaAnterior}
              >
                <ChevronLeft />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Próxima semana"
                onClick={onProximaSemana}
              >
                <ChevronRight />
              </Button>
            </div>
          ) : null}
          <div className="inline-flex rounded-md bg-muted p-1" role="group" aria-label="Visão do gráfico">
            <Button
              type="button"
              variant={visao === 'semana' ? 'secondary' : 'ghost'}
              size="sm"
              aria-label="Visão semanal"
              aria-pressed={visao === 'semana'}
              onClick={() => onVisaoChange('semana')}
            >
              Semana
            </Button>
            <Button
              type="button"
              variant={visao === 'mes' ? 'secondary' : 'ghost'}
              size="sm"
              aria-label="Visão mensal"
              aria-pressed={visao === 'mes'}
              onClick={() => onVisaoChange('mes')}
            >
              Mês
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? <EstadoGrafico>Carregando fluxo financeiro...</EstadoGrafico> : null}
      {!isLoading && error ? (
        <EstadoGrafico tipo="alert">Não foi possível carregar o fluxo financeiro.</EstadoGrafico>
      ) : null}
      {!isLoading && !error && pontos.length === 0 ? (
        <EstadoGrafico>Nenhum lançamento encontrado para os filtros selecionados.</EstadoGrafico>
      ) : null}
      {!isLoading && !error && pontos.length > 0 ? (
        <ChartContainer config={chartConfig} className="h-[20rem] w-full flex-1 aspect-auto min-h-[20rem]">
          <ComposedChart data={pontos} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <XAxis
              dataKey="rotulo"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={([dataMin, dataMax]) => [
                Math.min(0, Number(dataMin)),
                Math.max(0, Number(dataMax)),
              ]}
              tickFormatter={(value) => formatCurrency(Number(value))}
              width={88}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip
              content={<TooltipFluxo />}
              cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeDasharray: '4 4' }}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="recebido"
              stackId="entradas"
              name="recebido"
              fill="#2563EB"
              radius={[0, 0, 4, 4]}
              maxBarSize={20}
            />
            <Bar
              dataKey="aReceber"
              stackId="entradas"
              name="aReceber"
              fill="rgba(37, 99, 235, 0.38)"
              radius={[4, 4, 0, 0]}
              maxBarSize={20}
            />
            <Bar
              dataKey="pago"
              stackId="saidas"
              name="pago"
              fill="#8B0D16"
              radius={[0, 0, 4, 4]}
              maxBarSize={20}
            />
            <Bar
              dataKey="aPagar"
              stackId="saidas"
              name="aPagar"
              fill="rgba(139, 13, 22, 0.38)"
              radius={[4, 4, 0, 0]}
              maxBarSize={20}
            />
            <Line
              dataKey="saldoAcumulado"
              name="saldoAcumulado"
              type="monotone"
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              strokeDasharray="6 4"
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={{ r: 4, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ChartContainer>
      ) : null}
    </section>
  );
}
