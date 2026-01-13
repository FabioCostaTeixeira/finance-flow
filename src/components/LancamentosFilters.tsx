import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
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
import { Badge } from '@/components/ui/badge';
import { useCategorias } from '@/hooks/useCategorias';
import { useBancos } from '@/hooks/useBancos';
import { statusLabels } from '@/lib/recurrence';

export interface LancamentosFiltersState {
  dataInicio: Date | undefined;
  dataFim: Date | undefined;
  categoriaId: string | undefined;
  subcategoriaId: string | undefined;
  status: string | undefined;
  bancoId: string | undefined;
}

interface LancamentosFiltersProps {
  tipo: 'receita' | 'despesa';
  filters: LancamentosFiltersState;
  onFiltersChange: (filters: LancamentosFiltersState) => void;
}

export function LancamentosFilters({ tipo, filters, onFiltersChange }: LancamentosFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);
  const { data: categorias = [] } = useCategorias(tipo);
  const { data: bancos = [] } = useBancos();

  // Get parent categories (no parent)
  const parentCategorias = useMemo(() => {
    return categorias.filter((c) => !c.categoria_pai_id);
  }, [categorias]);

  // Get subcategories of selected parent
  const subcategorias = useMemo(() => {
    if (!filters.categoriaId) return [];
    return categorias.filter((c) => c.categoria_pai_id === filters.categoriaId);
  }, [categorias, filters.categoriaId]);

  const statusOptions = tipo === 'receita'
    ? ['a_receber', 'recebido', 'parcial', 'vencida']
    : ['a_pagar', 'pago', 'parcial', 'atrasado'];

  const activeFiltersCount = [
    filters.dataInicio,
    filters.dataFim,
    filters.categoriaId,
    filters.subcategoriaId,
    filters.status,
    filters.bancoId,
  ].filter(Boolean).length;

  const clearFilters = () => {
    onFiltersChange({
      dataInicio: undefined,
      dataFim: undefined,
      categoriaId: undefined,
      subcategoriaId: undefined,
      status: undefined,
      bancoId: undefined,
    });
  };

  const handleCategoriaChange = (value: string) => {
    onFiltersChange({
      ...filters,
      categoriaId: value === 'all' ? undefined : value,
      subcategoriaId: undefined, // Reset subcategory when category changes
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
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
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Categoria</label>
            <Select
              value={filters.categoriaId || 'all'}
              onValueChange={handleCategoriaChange}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {parentCategorias.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subcategoria */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Subcategoria</label>
            <Select
              value={filters.subcategoriaId || 'all'}
              onValueChange={(value) =>
                onFiltersChange({ ...filters, subcategoriaId: value === 'all' ? undefined : value })
              }
              disabled={!filters.categoriaId || subcategorias.length === 0}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {subcategorias.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    {sub.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select
              value={filters.status || 'all'}
              onValueChange={(value) =>
                onFiltersChange({ ...filters, status: value === 'all' ? undefined : value })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {statusLabels[status as keyof typeof statusLabels]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Banco */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Banco</label>
            <Select
              value={filters.bancoId || 'all'}
              onValueChange={(value) =>
                onFiltersChange({ ...filters, bancoId: value === 'all' ? undefined : value })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {bancos.map((banco) => (
                  <SelectItem key={banco.id} value={banco.id}>
                    {banco.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
