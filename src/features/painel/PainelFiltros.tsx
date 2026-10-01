import { useMemo, useState } from 'react';
import { format, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { Categoria } from '@/hooks/useCategorias';
import { getStatusConfig } from '@/lib/statusUtils';
import type { StatusLancamento } from '@/lib/statusUtils';
import { cn } from '@/lib/utils';
import type { FiltrosPainel } from './types';

interface PainelFiltrosProps {
  filtros: FiltrosPainel;
  categorias: Categoria[];
  onChange: (filtros: FiltrosPainel) => void;
}

interface FiltroMultiploProps {
  label: string;
  placeholder: string;
  selectedValues: string[];
  options: { value: string; label: string }[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}

const STATUS_DISPONIVEIS: StatusLancamento[] = [
  'a_receber',
  'recebido',
  'a_pagar',
  'pago',
  'parcial',
  'atrasado',
  'vencida',
  'transferencia',
];

function FiltroMultiplo({
  label,
  placeholder,
  selectedValues,
  options,
  onChange,
  disabled,
}: FiltroMultiploProps) {
  const [open, setOpen] = useState(false);

  const toggleValue = (value: string) => {
    onChange(
      selectedValues.includes(value)
        ? selectedValues.filter((selectedValue) => selectedValue !== value)
        : [...selectedValues, value],
    );
  };

  const displayText = selectedValues.length === 0
    ? placeholder
    : selectedValues.length === 1
      ? options.find((option) => option.value === selectedValues[0])?.label ?? placeholder
      : `${selectedValues.length} selecionados`;

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            role="combobox"
            aria-label={label}
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              'h-9 w-full justify-between text-left font-normal',
              selectedValues.length === 0 && 'text-muted-foreground',
            )}
          >
            <span className="truncate">{displayText}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          <Command>
            <CommandInput placeholder={`Buscar ${label.toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>Nenhum resultado.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    aria-selected={selectedValues.includes(option.value)}
                    onSelect={() => toggleValue(option.value)}
                  >
                    <Checkbox
                      checked={selectedValues.includes(option.value)}
                      aria-hidden="true"
                      tabIndex={-1}
                      className="mr-2 pointer-events-none"
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface FiltroDataProps {
  label: string;
  data: Date;
  onSelect: (data: Date) => void;
  disabled?: (data: Date) => boolean;
}

function FiltroData({ label, data, onSelect, disabled }: FiltroDataProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label={label}
            className="h-9 w-full justify-start text-left font-normal"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {format(data, 'dd/MM/yyyy', { locale: ptBR })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={data}
            onSelect={(nextData) => {
              if (nextData) onSelect(nextData);
            }}
            disabled={disabled}
            initialFocus
            locale={ptBR}
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function PainelFiltros({ filtros, categorias, onChange }: PainelFiltrosProps) {
  const categoriasPai = useMemo(
    () => categorias.filter((categoria) => !categoria.categoria_pai_id),
    [categorias],
  );

  const subcategorias = useMemo(
    () => categorias.filter(
      (categoria) => categoria.categoria_pai_id
        && filtros.categoriaIds.includes(categoria.categoria_pai_id),
    ),
    [categorias, filtros.categoriaIds],
  );

  const alterarCategorias = (categoriaIds: string[]) => {
    const subcategoriaIdsValidas = new Set(
      categorias
        .filter((categoria) => categoria.categoria_pai_id && categoriaIds.includes(categoria.categoria_pai_id))
        .map((categoria) => categoria.id),
    );

    onChange({
      ...filtros,
      categoriaIds,
      subcategoriaIds: filtros.subcategoriaIds.filter((id) => subcategoriaIdsValidas.has(id)),
    });
  };

  const alterarInicio = (inicio: Date) => {
    onChange({
      ...filtros,
      inicio,
      fim: isBefore(startOfDay(filtros.fim), startOfDay(inicio)) ? inicio : filtros.fim,
    });
  };

  return (
    <section aria-label="Filtros do painel" className="grid grid-cols-1 gap-3 rounded-lg p-4 glass-card sm:grid-cols-2 lg:grid-cols-5">
      <FiltroData
        label="Data inicial"
        data={filtros.inicio}
        onSelect={alterarInicio}
      />
      <FiltroData
        label="Data final"
        data={filtros.fim}
        onSelect={(fim) => onChange({ ...filtros, fim })}
        disabled={(data) => isBefore(startOfDay(data), startOfDay(filtros.inicio))}
      />
      <FiltroMultiplo
        label="Categoria"
        placeholder="Todas"
        selectedValues={filtros.categoriaIds}
        options={categoriasPai.map((categoria) => ({ value: categoria.id, label: categoria.nome }))}
        onChange={alterarCategorias}
      />
      <FiltroMultiplo
        label="Subcategoria"
        placeholder="Todas"
        selectedValues={filtros.subcategoriaIds}
        options={subcategorias.map((subcategoria) => ({ value: subcategoria.id, label: subcategoria.nome }))}
        onChange={(subcategoriaIds) => onChange({ ...filtros, subcategoriaIds })}
        disabled={filtros.categoriaIds.length === 0 || subcategorias.length === 0}
      />
      <FiltroMultiplo
        label="Status"
        placeholder="Todos"
        selectedValues={filtros.statusList}
        options={STATUS_DISPONIVEIS.map((status) => ({
          value: status,
          label: getStatusConfig(status).label,
        }))}
        onChange={(statusList) => onChange({
          ...filtros,
          statusList: statusList as StatusLancamento[],
        })}
      />
    </section>
  );
}
