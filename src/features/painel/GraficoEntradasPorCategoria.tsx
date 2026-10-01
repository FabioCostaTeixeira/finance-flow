import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart';
import { formatCurrency } from '@/lib/recurrence';
import { TooltipCategoria } from './TooltipCategoria';
import type { CategoriaRanking } from './types';

interface GraficoEntradasPorCategoriaProps {
  ranking: CategoriaRanking[];
  periodoLabel: string;
  isLoading: boolean;
  error: Error | null;
}

const chartConfig = {
  recebido: { label: 'Recebido', color: '#2563EB' },
  aReceber: { label: 'A receber', color: 'rgba(37, 99, 235, 0.38)' },
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

export function GraficoEntradasPorCategoria({
  ranking,
  periodoLabel,
  isLoading,
  error,
}: GraficoEntradasPorCategoriaProps) {
  const altura = Math.max(20, ranking.length * 2.5) + 'rem';

  return (
    <section
      aria-labelledby="grafico-entradas-categoria-titulo"
      className="flex h-full min-h-0 flex-col rounded-lg border border-border/60 bg-card p-4 text-card-foreground shadow-sm sm:p-5"
    >
      <div className="mb-5">
        <h2 id="grafico-entradas-categoria-titulo" className="text-base font-semibold tracking-tight">
          Entradas por categoria
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{periodoLabel}</p>
      </div>

      {isLoading ? <EstadoGrafico>Carregando entradas por categoria...</EstadoGrafico> : null}
      {!isLoading && error ? (
        <EstadoGrafico tipo="alert">Não foi possível carregar as entradas por categoria.</EstadoGrafico>
      ) : null}
      {!isLoading && !error && ranking.length === 0 ? (
        <EstadoGrafico>Nenhuma entrada encontrada para os filtros selecionados.</EstadoGrafico>
      ) : null}
      {!isLoading && !error && ranking.length > 0 ? (
        <ChartContainer
          config={chartConfig}
          className="w-full flex-1 aspect-auto min-h-[20rem]"
          style={{ height: altura }}
        >
          <BarChart
            data={ranking}
            layout="vertical"
            margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
          >
            <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <XAxis
              type="number"
              tickFormatter={(value) => formatCurrency(Number(value))}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              dataKey="nome"
              type="category"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={112}
            />
            <ChartTooltip
              content={<TooltipCategoria />}
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="recebido"
              stackId="entradas"
              name="recebido"
              fill="#2563EB"
              radius={[4, 0, 0, 4]}
              maxBarSize={20}
            />
            <Bar
              dataKey="aReceber"
              stackId="entradas"
              name="aReceber"
              fill="rgba(37, 99, 235, 0.38)"
              radius={[0, 4, 4, 0]}
              maxBarSize={20}
            />
          </BarChart>
        </ChartContainer>
      ) : null}
    </section>
  );
}
