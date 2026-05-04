import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LancamentoExtendido, useBaixarLancamento } from '@/hooks/useLancamentos';
import { formatCurrency } from '@/lib/recurrence';
import { toast } from '@/hooks/use-toast';

const baixaSchema = z.object({
  valorPago: z.number().positive('Valor deve ser maior que zero'),
  dataPagamento: z.date().refine(
    (date) => date <= new Date(),
    'Data não pode ser no futuro'
  ),
});

type BaixaFormData = z.infer<typeof baixaSchema>;

interface BaixaModalProps {
  lancamento: LancamentoExtendido | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BaixaModal({ lancamento, open, onOpenChange }: BaixaModalProps) {
  const baixarLancamento = useBaixarLancamento();

  const valorRestante = lancamento
    ? Number(lancamento.valor) - (Number(lancamento.valor_pago) || 0)
    : 0;

  const form = useForm<BaixaFormData>({
    resolver: zodResolver(baixaSchema),
    defaultValues: {
      valorPago: valorRestante,
      dataPagamento: new Date(),
    },
  });

  useEffect(() => {
    if (lancamento) {
      form.reset({
        valorPago: valorRestante,
        dataPagamento: new Date(),
      });
    }
  }, [lancamento?.id]);

  const onSubmit = async (data: BaixaFormData) => {
    if (!lancamento) return;

    try {
      await baixarLancamento.mutateAsync({
        id: lancamento.id,
        valorPago: data.valorPago,
        dataPagamento: data.dataPagamento,
      });

      const isParcial = data.valorPago < valorRestante;

      toast({
        title: isParcial ? 'Baixa parcial realizada' : 'Baixa completa realizada',
        description: isParcial
          ? `Faltam ${formatCurrency(valorRestante - data.valorPago)} para quitar.`
          : 'Lançamento quitado com sucesso.',
      });

      form.reset();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Erro ao realizar baixa',
        description: 'Não foi possível realizar a baixa.',
        variant: 'destructive',
      });
    }
  };

  if (!lancamento) return null;

  const isReceita = lancamento.tipo === 'receita';
  const valorPagoAtual = form.watch('valorPago');
  const isParcial = valorPagoAtual < valorRestante;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] glass-card">
        <DialogHeader>
          <DialogTitle className={cn(isReceita ? 'text-primary' : 'text-destructive')}>
            {isReceita ? 'Receber Valor' : 'Pagar Valor'}
          </DialogTitle>
          <DialogDescription>
            {lancamento.cliente_credor} - {formatCurrency(Number(lancamento.valor))}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {lancamento.valor_pago > 0 && (
            <Alert className="bg-warning/10 border-warning/30">
              <AlertCircle className="h-4 w-4 text-warning" />
              <AlertDescription className="text-warning">
                Já pago: {formatCurrency(Number(lancamento.valor_pago))}
                <br />
                Restante: {formatCurrency(valorRestante)}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="valorPago">Valor a {isReceita ? 'Receber' : 'Pagar'}</Label>
            <Input
              id="valorPago"
              type="number"
              step="0.01"
              className="input-glass"
              {...form.register('valorPago', { valueAsNumber: true })}
            />
            {form.formState.errors.valorPago && (
              <p className="text-sm text-destructive">
                {form.formState.errors.valorPago.message}
              </p>
            )}
          </div>

          {isParcial && (
            <Alert className="bg-warning/10 border-warning/30">
              <AlertCircle className="h-4 w-4 text-warning" />
              <AlertDescription className="text-warning">
                Status será alterado para "Parcial"
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Data do Pagamento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal input-glass',
                    !form.watch('dataPagamento') && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.watch('dataPagamento')
                    ? format(form.watch('dataPagamento'), 'dd/MM/yyyy', { locale: ptBR })
                    : 'Selecione a data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={form.watch('dataPagamento')}
                  onSelect={(date) => date && form.setValue('dataPagamento', date)}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            {form.formState.errors.dataPagamento && (
              <p className="text-sm text-destructive">
                {form.formState.errors.dataPagamento.message}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className={cn(
                'flex-1',
                isReceita
                  ? 'bg-success hover:bg-success/90'
                  : 'bg-success hover:bg-success/90'
              )}
              disabled={baixarLancamento.isPending}
            >
              {baixarLancamento.isPending
                ? 'Processando...'
                : isReceita
                ? 'Receber'
                : 'Pagar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
