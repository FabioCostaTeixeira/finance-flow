import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarIcon, ArrowRightLeft } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
import { Label } from '@/components/ui/label';
import { BancoCombobox } from './BancoCombobox';
import { CurrencyInput } from '@/components/CurrencyInput';
import { useUpdateTransferencia } from '@/hooks/useTransferencia';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const transferenciaSchema = z.object({
  data: z.date(),
  banco_origem_id: z.string().min(1, 'Selecione o banco de origem'),
  banco_destino_id: z.string().min(1, 'Selecione o banco de destino'),
  valor: z.number().positive('Valor deve ser maior que zero'),
}).refine((data) => data.banco_origem_id !== data.banco_destino_id, {
  message: 'Os bancos de origem e destino devem ser diferentes',
  path: ['banco_destino_id'],
});

type TransferenciaFormData = z.infer<typeof transferenciaSchema>;

interface EditTransferenciaModalProps {
  vinculoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTransferenciaModal({ vinculoId, open, onOpenChange }: EditTransferenciaModalProps) {
  const updateTransferencia = useUpdateTransferencia();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<TransferenciaFormData>({
    resolver: zodResolver(transferenciaSchema),
    defaultValues: {
      data: new Date(),
      banco_origem_id: '',
      banco_destino_id: '',
      valor: 0,
    },
  });

  // Carregar dados da transferência
  useEffect(() => {
    if (vinculoId && open) {
      setIsLoading(true);
      supabase
        .from('lancamentos')
        .select('*')
        .eq('transferencia_vinculo_id', vinculoId)
        .then(({ data, error }) => {
          if (error || !data || data.length < 2) {
            toast({
              title: 'Erro',
              description: 'Não foi possível carregar os dados da transferência.',
              variant: 'destructive',
            });
            setIsLoading(false);
            return;
          }

          const saida = data.find((l) => l.tipo === 'despesa');
          const entrada = data.find((l) => l.tipo === 'receita');

          if (saida && entrada) {
            form.reset({
              data: parseISO(saida.data_vencimento),
              banco_origem_id: saida.banco_id || '',
              banco_destino_id: entrada.banco_id || '',
              valor: Number(saida.valor),
            });
          }
          setIsLoading(false);
        });
    }
  }, [vinculoId, open, form]);

  const onSubmit = async (data: TransferenciaFormData) => {
    if (!vinculoId) return;

    try {
      await updateTransferencia.mutateAsync({
        vinculo_id: vinculoId,
        data: data.data,
        banco_origem_id: data.banco_origem_id,
        banco_destino_id: data.banco_destino_id,
        valor: data.valor,
      });

      toast({
        title: 'Transferência atualizada',
        description: 'A transferência foi atualizada com sucesso.',
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar a transferência.',
        variant: 'destructive',
      });
    }
  };

  if (!vinculoId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] glass-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-purple-400">
            <ArrowRightLeft className="w-5 h-5" />
            Editar Transferência
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
          </div>
        ) : (
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
                    disabled={updateTransferencia.isPending}
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
                className="flex-1 bg-purple-600 hover:bg-purple-700"
                disabled={updateTransferencia.isPending}
              >
                {updateTransferencia.isPending ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
