import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Filter, X, Search, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { useCategorias } from '@/hooks/useCategorias';
import { useBancos } from '@/hooks/useBancos';
import { statusLabels } from '@/lib/recurrence';

export interface LancamentosFiltersState {
  dataInicio: Date | undefined;
  dataFim: Date | undefined;
  categoriaIds: string[];
  subcategoriaIds: string[];
  statusList: string[];
  bancoIds: string[];
  searchTerm: string | undefined;
}

interface LancamentosFiltersProps {
  tipo: 'receita' | 'despesa';
  filters: LancamentosFiltersState;
  onFiltersChange: (filters: LancamentosFiltersState) => void;
}

interface MultiSelectFilterProps {
  label: string;
  placeholder: string;
  selectedValues: string[];
  options: { value: string; label: string }[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}

function MultiSelectFilter({ label, placeholder, selectedValues, options, onChange, disabled }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);

  const toggleValue = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((v) => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const displayText = selectedValues.length === 0
    ? placeholder
    : selectedValues.length === 1
      ? options.find((o) => o.value === selectedValues[0])?.label || placeholder
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
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              'w-full justify-between text-left font-normal h-9',
              selectedValues.length === 0 && 'text-muted-foreground'
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
                {options.map((option) => {
                  const isSelected = selectedValues.includes(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onSelect={() => toggleValue(option.value)}
                    >
                      <Checkbox
                        checked={isSelected}
                        className="mr-2 pointer-events-none"
                      />
                      {option.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function LancamentosFilters({ tipo, filters, onFiltersChange }: LancamentosFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);
  const { data: categorias = [] } = useCategorias(tipo);
  const { data: bancos = [] } = useBancos();

  const parentCategorias = useMemo(() => {
    return categorias.filter((c) => !c.categoria_pai_id);
  }, [categorias]);

  const subcategorias = useMemo(() => {
    if (filters.categoriaIds.length === 0) return [];
    return categorias.filter((c) => c.categoria_pai_id && filters.categoriaIds.includes(c.categoria_pai_id));
  }, [categorias, filters.categoriaIds]);

  const statusOptions = tipo === 'receita'
    ? ['a_receber', 'recebido', 'parcial', 'vencida']
    : ['a_pagar', 'pago', 'parcial', 'atrasado'];

  const activeFiltersCount = [
    filters.dataInicio,
    filters.dataFim,
    filters.categoriaIds.length > 0,
    filters.subcategoriaIds.length > 0,
    filters.statusList.length > 0,
    filters.bancoIds.length > 0,
    filters.searchTerm,
  ].filter(Boolean).length;

  const clearFilters = () => {
    onFiltersChange({
      dataInicio: undefined,
      dataFim: undefined,
      categoriaIds: [],
      subcategoriaIds: [],
      statusList: [],
      bancoIds: [],
      searchTerm: undefined,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={tipo === 'receita' ? 'Buscar por cliente...' : 'Buscar por credor...'}
            value={filters.searchTerm || ''}
            onChange={(e) => onFiltersChange({ ...filters, searchTerm: e.target.value || undefined })}
            className="pl-9 h-9"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'gap-2',
            activeFiltersCount > 0 && 'border-primary text-primary'
          )}
        >
          <Filter className="w-4 h-4" />
          Filtros
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>

        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
            Limpar
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 p-4 glass-card rounded-lg">
          {/* Data Início */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Data Início</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !filters.dataInicio && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dataInicio
                    ? format(filters.dataInicio, 'dd/MM/yyyy', { locale: ptBR })
                    : 'Selecione'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dataInicio}
                  onSelect={(date) => onFiltersChange({ ...filters, dataInicio: date })}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Data Fim */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Data Fim</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !filters.dataFim && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dataFim
                    ? format(filters.dataFim, 'dd/MM/yyyy', { locale: ptBR })
                    : 'Selecione'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dataFim}
                  onSelect={(date) => onFiltersChange({ ...filters, dataFim: date })}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Categoria */}
          <MultiSelectFilter
            label="Categoria"
            placeholder="Todas"
            selectedValues={filters.categoriaIds}
            options={parentCategorias.map((cat) => ({ value: cat.id, label: cat.nome }))}
            onChange={(values) => onFiltersChange({
              ...filters,
              categoriaIds: values,
              subcategoriaIds: [],
            })}
          />

          {/* Subcategoria */}
          <MultiSelectFilter
            label="Subcategoria"
            placeholder="Todas"
            selectedValues={filters.subcategoriaIds}
            options={subcategorias.map((sub) => ({ value: sub.id, label: sub.nome }))}
            onChange={(values) => onFiltersChange({ ...filters, subcategoriaIds: values })}
            disabled={filters.categoriaIds.length === 0 || subcategorias.length === 0}
          />

          {/* Status */}
          <MultiSelectFilter
            label="Status"
            placeholder="Todos"
            selectedValues={filters.statusList}
            options={statusOptions.map((s) => ({
              value: s,
              label: statusLabels[s as keyof typeof statusLabels],
            }))}
            onChange={(values) => onFiltersChange({ ...filters, statusList: values })}
          />

          {/* Banco */}
          <MultiSelectFilter
            label="Banco"
            placeholder="Todos"
            selectedValues={filters.bancoIds}
            options={bancos.map((b) => ({ value: b.id, label: b.nome }))}
            onChange={(values) => onFiltersChange({ ...filters, bancoIds: values })}
          />
        </div>
      )}
    </div>
  );
}
