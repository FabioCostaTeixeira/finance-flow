import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CategoriaCombobox } from './CategoriaCombobox';
import { SubcategoriaCombobox } from './SubcategoriaCombobox';
import { BancoCombobox } from './BancoCombobox';
import { CurrencyInput } from '@/components/CurrencyInput';
import { useCreateLancamento } from '@/hooks/useLancamentos';
import { frequenciaLabels, Frequencia } from '@/lib/recurrence';
import { toast } from '@/hooks/use-toast';

const lancamentoSchema = z.object({
  cliente_credor: z.string().min(1, 'Campo obrigatório'),
  valor: z.number().positive('Valor deve ser maior que zero'),
  data_vencimento: z.date(),
  banco_id: z.string().optional(),
  categoria_id: z.string().optional(),
  subcategoria_id: z.string().optional(),
  observacao: z.string().optional(),
  recorrente: z.boolean().default(false),
  frequencia: z.enum(['semanal', 'mensal', 'trimestral', 'semestral']).optional(),
  qtd_parcelas: z.number().min(1).max(120).optional(),
  lancar_como_pago: z.boolean().default(false),
  data_pagamento: z.date().optional(),
});

type LancamentoFormData = z.infer<typeof lancamentoSchema>;

interface LancamentoFormProps {
  tipo: 'receita' | 'despesa';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LancamentoForm({ tipo, open, onOpenChange }: LancamentoFormProps) {
  const [isRecorrente, setIsRecorrente] = useState(false);
  const [lancarComoPago, setLancarComoPago] = useState(false);
  const createLancamento = useCreateLancamento();

  const form = useForm<LancamentoFormData>({
    resolver: zodResolver(lancamentoSchema),
    defaultValues: {
      cliente_credor: '',
      valor: 0,
      data_vencimento: new Date(),
      banco_id: undefined,
      observacao: '',
      recorrente: false,
      qtd_parcelas: 1,
      lancar_como_pago: false,
      data_pagamento: new Date(),
    },
  });

  const onSubmit = async (data: LancamentoFormData) => {
    try {
      // Use subcategory if selected, otherwise use category
      const finalCategoriaId = data.subcategoria_id || data.categoria_id;
      
      await createLancamento.mutateAsync({
        data_vencimento: data.data_vencimento,
        cliente_credor: data.cliente_credor,
        valor: data.valor,
        banco_id: data.banco_id,
        categoria_id: finalCategoriaId,
        observacao: data.observacao,
        tipo,
        recorrente: isRecorrente,
        frequencia: isRecorrente ? data.frequencia : undefined,
        qtd_parcelas: isRecorrente ? data.qtd_parcelas : undefined,
        lancar_como_pago: lancarComoPago,
        data_pagamento: lancarComoPago ? data.data_pagamento : undefined,
      });

      toast({
        title: 'Lançamento criado',
        description: isRecorrente
          ? `${data.qtd_parcelas} parcelas criadas com sucesso.`
          : 'Lançamento criado com sucesso.',
      });

      form.reset({
        cliente_credor: '',
        valor: 0,
        data_vencimento: new Date(),
        banco_id: undefined,
        categoria_id: undefined,
        subcategoria_id: undefined,
        observacao: '',
        recorrente: false,
        qtd_parcelas: 1,
        lancar_como_pago: false,
        data_pagamento: new Date(),
      });
      setIsRecorrente(false);
      setLancarComoPago(false);
      // Modal stays open for new entries
    } catch (error) {
      toast({
        title: 'Erro ao criar lançamento',
        description: 'Não foi possível criar o lançamento.',
        variant: 'destructive',
      });
    }
  };

  const isReceita = tipo === 'receita';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] glass-card">
        <DialogHeader>
          <DialogTitle className={cn(isReceita ? 'text-primary' : 'text-destructive')}>
            Nova {isReceita ? 'Receita' : 'Despesa'}
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
                    disabled={createLancamento.isPending}
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
                tipo={tipo}
                value={form.watch('categoria_id') || null}
                onChange={(value) => {
                  form.setValue('categoria_id', value || undefined);
                  form.setValue('subcategoria_id', undefined); // Reset subcategory
                }}
                showOnlyParents
              />
            </div>

            <div className="space-y-2">
              <Label>Subcategoria</Label>
              <SubcategoriaCombobox
                tipo={tipo}
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

          <div className="flex items-center space-x-2">
            <Checkbox
              id="recorrente"
              checked={isRecorrente}
              onCheckedChange={(checked) => setIsRecorrente(checked as boolean)}
            />
            <Label htmlFor="recorrente" className="cursor-pointer">
              Lançamento recorrente
            </Label>
          </div>

          <AnimatePresence>
            {isRecorrente && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-2 gap-4 overflow-hidden"
              >
                <div className="space-y-2">
                  <Label>Frequência</Label>
                  <Select
                    value={form.watch('frequencia')}
                    onValueChange={(value: Frequencia) => form.setValue('frequencia', value)}
                  >
                    <SelectTrigger className="input-glass">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(frequenciaLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="qtd_parcelas">Parcelas</Label>
                  <Input
                    id="qtd_parcelas"
                    type="number"
                    min={1}
                    max={120}
                    className="input-glass"
                    {...form.register('qtd_parcelas', { valueAsNumber: true })}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Lançar como pago - apenas para despesas e quando não for recorrente */}
          {!isReceita && !isRecorrente && (
            <div className="space-y-3 p-3 rounded-lg bg-muted/30">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="lancar_como_pago"
                  checked={lancarComoPago}
                  onCheckedChange={(checked) => setLancarComoPago(checked as boolean)}
                />
                <Label htmlFor="lancar_como_pago" className="cursor-pointer text-sm">
                  Lançar como já pago
                </Label>
              </div>

              <AnimatePresence>
                {lancarComoPago && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2">
                      <Label>Data do Pagamento</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal input-glass',
                              !form.watch('data_pagamento') && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {form.watch('data_pagamento')
                              ? format(form.watch('data_pagamento')!, 'dd/MM/yyyy', { locale: ptBR })
                              : 'Selecione a data'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={form.watch('data_pagamento')}
                            onSelect={(date) => date && form.setValue('data_pagamento', date)}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Aviso para recorrência */}
          {!isReceita && isRecorrente && (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
              <p className="text-xs text-warning">
                Para lançamentos recorrentes, use a opção "Pagar" após criar para marcar as parcelas como pagas individualmente.
              </p>
            </div>
          )}

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
              disabled={createLancamento.isPending}
            >
              {createLancamento.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
