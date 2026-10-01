import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { formatCurrency } from '@/lib/recurrence';
import { cn } from '@/lib/utils';
import { obterIdentidadeBanco, obterIniciaisBanco } from './bancoIdentidade';
import type { SaldoBancoPainel } from './types';

interface CardsSaldoBancosProps {
  saldos: SaldoBancoPainel[];
  bancoSelecionadoId: string | null;
  isLoading: boolean;
  error: Error | null;
  onBancoClick: (bancoId: string) => void;
}

export function CardsSaldoBancos({
  saldos,
  bancoSelecionadoId,
  isLoading,
  error,
  onBancoClick,
}: CardsSaldoBancosProps) {
  return (
    <section aria-label="Saldos por banco" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div>
          <h2 className="text-base font-semibold text-foreground">Saldos por banco</h2>
          <p className="text-xs text-muted-foreground">Clique ou deslize para navegar pelos bancos.</p>
        </div>
        {bancoSelecionadoId ? <span className="text-xs font-medium text-primary">Filtro de banco ativo</span> : null}
      </div>

      {isLoading ? (
        <div className="rounded-lg p-4 text-sm text-muted-foreground glass-card">Carregando saldos por banco...</div>
      ) : error ? (
        <div className="rounded-lg p-4 text-sm text-destructive glass-card">{error.message}</div>
      ) : saldos.length === 0 ? (
        <div className="rounded-lg p-4 text-sm text-muted-foreground glass-card">Nenhum banco cadastrado.</div>
      ) : (
        <Carousel
          opts={{ align: 'start', loop: true, slidesToScroll: 1 }}
          aria-label="Carrossel de saldos por banco"
          className="px-10 sm:px-11"
        >
          <CarouselContent>
            {saldos.map((saldo, index) => {
              const selecionado = bancoSelecionadoId === saldo.bancoId;
              const saldoNegativo = saldo.saldoAtual < 0;
              const identidade = obterIdentidadeBanco(saldo.nome);
              const iniciais = obterIniciaisBanco(saldo.nome);

              return (
                <CarouselItem
                  key={saldo.bancoId}
                  aria-label={`Banco ${index + 1} de ${saldos.length}`}
                  className="basis-[88%] sm:basis-1/2 lg:basis-1/4"
                >
                  <button
                    type="button"
                    aria-pressed={selecionado}
                    onClick={() => onBancoClick(saldo.bancoId)}
                    className={cn(
                      'group h-full w-full rounded-xl border p-4 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      selecionado
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card hover:border-primary/60 hover:bg-muted/50',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg text-xs font-bold',
                            identidade ? identidade.className : 'bg-muted text-muted-foreground',
                          )}
                          aria-hidden="true"
                        >
                          {identidade?.logoUrl ? (
                            <img src={identidade.logoUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            identidade?.marca ?? iniciais
                          )}
                        </span>
                        <span className="truncate text-sm font-semibold text-foreground">{saldo.nome}</span>
                      </div>
                    </div>

                    <p className="mt-4 text-xs font-medium text-muted-foreground">Saldo realizado</p>
                    <p className={cn('mt-1 text-xl font-bold tracking-tight', saldoNegativo ? 'text-destructive' : 'text-foreground')}>
                      {formatCurrency(saldo.saldoAtual)}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Saldo previsto {formatCurrency(saldo.saldoPrevisto)}
                    </p>
                    <p className="mt-3 text-xs font-medium text-primary">
                      {selecionado ? 'Clique para mostrar todos os bancos' : 'Clique para filtrar este banco'}
                    </p>
                  </button>
                </CarouselItem>
              );
            })}
          </CarouselContent>
          <CarouselPrevious className="left-0" aria-label="Ver bancos anteriores" />
          <CarouselNext className="right-0" aria-label="Ver próximos bancos" />
        </Carousel>
      )}
    </section>
  );
}
