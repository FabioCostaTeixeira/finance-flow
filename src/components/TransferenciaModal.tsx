import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarIcon, ArrowRightLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { BancoCombobox } from './BancoCombobox';
import { CurrencyInput } from '@/components/CurrencyInput';
import { useCreateTransferencia } from '@/hooks/useTransferencia';
import { toast } from '@/hooks/use-toast';

const transferenciaSchema = z.object({
  data: z.date(),
  banco_origem_id: z.string().min(1, 'Selecione o banco de origem'),
  banco_destino_id: z.string().min(1, 'Selecione o banco de destino'),
  valor: z.number().positive('Valor deve ser maior que zero'),
}).refine((data) => data.banco_origem_id !== data.banco_destino_id, {
  message: 'O banco de origem deve ser diferente do banco de destino',
  path: ['banco_destino_id'],
});

type TransferenciaFormData = z.infer<typeof transferenciaSchema>;

interface TransferenciaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransferenciaModal({ open, onOpenChange }: TransferenciaModalProps) {
  const createTransferencia = useCreateTransferencia();

  const form = useForm<TransferenciaFormData>({
    resolver: zodResolver(transferenciaSchema),
    defaultValues: {
      data: new Date(),
      banco_origem_id: '',
      banco_destino_id: '',
      valor: 0,
    },
  });

  const onSubmit = async (data: TransferenciaFormData) => {
    try {
      await createTransferencia.mutateAsync({
        data: data.data,
        banco_origem_id: data.banco_origem_id,
        banco_destino_id: data.banco_destino_id,
        valor: data.valor,
      });

      toast({
        title: 'Transferência realizada',
        description: 'Transferência entre contas registrada com sucesso.',
      });

      form.reset({
        data: new Date(),
        banco_origem_id: '',
        banco_destino_id: '',
        valor: 0,
      });
      
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Erro ao realizar transferência',
        description: 'Não foi possível registrar a transferência.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] glass-card">
        <DialogHeader>
          <DialogTitle className="text-primary flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            Transferência entre Contas
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal input-glass',
                    !form.watch('data') && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.watch('data')
                    ? format(form.watch('data'), 'dd/MM/yyyy', { locale: ptBR })
                    : 'Selecione a data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={form.watch('data')}
                  onSelect={(date) => date && form.setValue('data', date)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Conta de Origem</Label>
            <BancoCombobox
              value={form.watch('banco_origem_id') || null}
              onChange={(value) => form.setValue('banco_origem_id', value || '')}
            />
            {form.formState.errors.banco_origem_id && (
              <p className="text-sm text-destructive">
                {form.formState.errors.banco_origem_id.message}
              </p>
            )}
          </div>

          <div className="flex items-center justify-center py-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-px w-12 bg-border" />
              <ArrowRightLeft className="w-4 h-4" />
              <div className="h-px w-12 bg-border" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Conta de Destino</Label>
            <BancoCombobox
              value={form.watch('banco_destino_id') || null}
              onChange={(value) => form.setValue('banco_destino_id', value || '')}
            />
            {form.formState.errors.banco_destino_id && (
              <p className="text-sm text-destructive">
                {form.formState.errors.banco_destino_id.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="valor">Valor (R$)</Label>
            <Controller
              name="valor"
              control={form.control}
              render={({ field }) => (
                <CurrencyInput
                  id="valor"
                  placeholder="0,00"
                  className="input-glass"
                  value={Number(field.value) || 0}
                  onValueChange={(v) => field.onChange(v)}
                  disabled={createTransferencia.isPending}
                />
              )}
            />
            {form.formState.errors.valor && (
              <p className="text-sm text-destructive">
                {form.formState.errors.valor.message}
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
              className="flex-1 bg-primary hover:bg-primary/90"
              disabled={createTransferencia.isPending}
            >
              {createTransferencia.isPending ? 'Transferindo...' : 'Transferir'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
