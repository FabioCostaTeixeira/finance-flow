import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { CategoriaCombobox } from './CategoriaCombobox';
import { SubcategoriaCombobox } from './SubcategoriaCombobox';
import { BancoCombobox } from './BancoCombobox';
import { CurrencyInput } from '@/components/CurrencyInput';
import { useUpdateLancamento, useUpdateRecurringLancamentos } from '@/hooks/useUpdateLancamento';
import { LancamentoExtendido } from '@/hooks/useLancamentos';
import { useCategorias } from '@/hooks/useCategorias';
import { toast } from '@/hooks/use-toast';

const editSchema = z.object({
  cliente_credor: z.string().min(1, 'Campo obrigatório'),
  valor: z.number().positive('Valor deve ser maior que zero'),
  data_vencimento: z.date(),
  banco_id: z.string().optional(),
  categoria_id: z.string().optional(),
  subcategoria_id: z.string().optional(),
  observacao: z.string().optional(),
});

type EditFormData = z.infer<typeof editSchema>;

interface EditLancamentoModalProps {
  lancamento: LancamentoExtendido | null;
  editScope?: 'single' | 'all';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditLancamentoModal({
  lancamento,
  editScope = 'single',
  open,
  onOpenChange,
}: EditLancamentoModalProps) {
  const updateLancamento = useUpdateLancamento();
  const updateRecurring = useUpdateRecurringLancamentos();
  const { data: categorias = [] } = useCategorias(lancamento?.tipo);

  const form = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      cliente_credor: '',
      valor: 0,
      data_vencimento: new Date(),
      banco_id: undefined,
      categoria_id: undefined,
      subcategoria_id: undefined,
      observacao: '',
    },
  });

  // Determinar se categoria atual é subcategoria
  useEffect(() => {
    if (lancamento && open) {
      const cat = categorias.find((c) => c.id === lancamento.categoria_id);
      let parentId: string | undefined;
      let subId: string | undefined;

      if (cat?.categoria_pai_id) {
        parentId = cat.categoria_pai_id;
        subId = cat.id;
      } else {
        parentId = lancamento.categoria_id || undefined;
        subId = undefined;
      }

      form.reset({
        cliente_credor: lancamento.cliente_credor,
        valor: Number(lancamento.valor),
        data_vencimento: parseISO(lancamento.data_vencimento),
        banco_id: lancamento.banco_id || undefined,
        categoria_id: parentId,
        subcategoria_id: subId,
        observacao: lancamento.observacao || '',
      });
    }
  }, [lancamento, open, categorias, form]);

  const onSubmit = async (data: EditFormData) => {
    if (!lancamento) return;

    try {
      const finalCategoriaId = data.subcategoria_id || data.categoria_id || null;

      if (editScope === 'all' && lancamento.recorrencia_id) {
        // Update all open lancamentos with the same recorrencia_id
        await updateRecurring.mutateAsync({
          recorrencia_id: lancamento.recorrencia_id,
          data_vencimento: data.data_vencimento,
          cliente_credor: data.cliente_credor,
          valor: data.valor,
          banco_id: data.banco_id || null,
          categoria_id: finalCategoriaId,
          observacao: data.observacao || null,
        });

        toast({
          title: 'Lançamentos atualizados',
          description: 'Todos os lançamentos em aberto da série foram atualizados.',
        });
      } else {
        await updateLancamento.mutateAsync({
          id: lancamento.id,
          data_vencimento: data.data_vencimento,
          cliente_credor: data.cliente_credor,
          valor: data.valor,
          banco_id: data.banco_id || null,
          categoria_id: finalCategoriaId,
          observacao: data.observacao || null,
        });

        toast({
          title: 'Lançamento atualizado',
          description: 'As alterações foram salvas com sucesso.',
        });
      }

      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar o lançamento.',
        variant: 'destructive',
      });
    }
  };

  if (!lancamento) return null;

  const isReceita = lancamento.tipo === 'receita';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] glass-card">
        <DialogHeader>
          <DialogTitle className={cn(isReceita ? 'text-primary' : 'text-destructive')}>
            Editar {isReceita ? 'Receita' : 'Despesa'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cliente_credor">
              {isReceita ? 'Cliente' : 'Credor'}
            </Label>
            <Input
              id="cliente_credor"
              placeholder={isReceita ? 'Nome do cliente' : 'Nome do credor'}
              className="input-glass"
              {...form.register('cliente_credor')}
            />
            {form.formState.errors.cliente_credor && (
              <p className="text-sm text-destructive">
                {form.formState.errors.cliente_credor.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
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
                    disabled={updateLancamento.isPending}
                  />
                )}
              />
              {form.formState.errors.valor && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.valor.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Data de Vencimento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal input-glass',
                      !form.watch('data_vencimento') && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch('data_vencimento')
                      ? format(form.watch('data_vencimento'), 'dd/MM/yyyy', { locale: ptBR })
                      : 'Selecione a data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.watch('data_vencimento')}
                    onSelect={(date) => date && form.setValue('data_vencimento', date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <CategoriaCombobox
                tipo={lancamento.tipo}
                value={form.watch('categoria_id') || null}
                onChange={(value) => {
                  form.setValue('categoria_id', value || undefined);
                  form.setValue('subcategoria_id', undefined);
                }}
                showOnlyParents
              />
            </div>

            <div className="space-y-2">
              <Label>Subcategoria</Label>
              <SubcategoriaCombobox
                tipo={lancamento.tipo}
                categoriaPaiId={form.watch('categoria_id') || null}
                value={form.watch('subcategoria_id') || null}
                onChange={(value) => form.setValue('subcategoria_id', value || undefined)}
                disabled={!form.watch('categoria_id')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="banco">Banco</Label>
            <BancoCombobox
              value={form.watch('banco_id') || null}
              onChange={(value) => form.setValue('banco_id', value || undefined)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea
              id="observacao"
              placeholder="Observações adicionais..."
              className="input-glass resize-none"
              rows={3}
              {...form.register('observacao')}
            />
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
                  ? 'bg-primary hover:bg-primary/90'
                  : 'bg-destructive hover:bg-destructive/90'
              )}
              disabled={updateLancamento.isPending || updateRecurring.isPending}
            >
              {(updateLancamento.isPending || updateRecurring.isPending) ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
