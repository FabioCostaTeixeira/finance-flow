import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useCategorias, useCreateCategoria, Categoria } from '@/hooks/useCategorias';
import { toast } from '@/hooks/use-toast';
import { fuzzySearch } from '@/lib/recurrence';

interface SubcategoriaComboboxProps {
  tipo: 'receita' | 'despesa';
  categoriaPaiId: string | null;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

export function SubcategoriaCombobox({ 
  tipo, 
  categoriaPaiId, 
  value, 
  onChange,
  disabled 
}: SubcategoriaComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newSubcategoriaName, setNewSubcategoriaName] = useState('');

  const { data: allCategorias = [] } = useCategorias(tipo);
  const createCategoria = useCreateCategoria();

  // Filter subcategories of the selected parent category
  const subcategorias = useMemo(() => {
    if (!categoriaPaiId) return [];
    return allCategorias.filter((c) => c.categoria_pai_id === categoriaPaiId);
  }, [allCategorias, categoriaPaiId]);

  const filteredSubcategorias = useMemo(() => {
    if (!searchQuery) return subcategorias;
    return fuzzySearch(subcategorias, searchQuery);
  }, [subcategorias, searchQuery]);

  const selectedSubcategoria = useMemo(() => {
    return allCategorias.find((c) => c.id === value);
  }, [allCategorias, value]);

  const handleSearch = (search: string) => {
    setSearchQuery(search);
  };

  const handleNotFound = () => {
    if (searchQuery.trim() && filteredSubcategorias.length === 0) {
      setNewSubcategoriaName(searchQuery.trim());
      setShowCreateDialog(true);
    }
  };

  const handleCreateSubcategoria = async () => {
    if (!categoriaPaiId) return;
    
    try {
      const newSubcategoria = await createCategoria.mutateAsync({
        nome: newSubcategoriaName,
        tipo,
        categoria_pai_id: categoriaPaiId,
      });
      onChange(newSubcategoria.id);
      setShowCreateDialog(false);
      setSearchQuery('');
      setOpen(false);
      toast({
        title: 'Subcategoria criada',
        description: `A subcategoria "${newSubcategoriaName}" foi criada com sucesso.`,
      });
    } catch (error) {
      toast({
        title: 'Erro ao criar subcategoria',
        description: 'Não foi possível criar a subcategoria.',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between input-glass"
            disabled={disabled || !categoriaPaiId}
          >
            {selectedSubcategoria?.nome || 'Selecione uma subcategoria...'}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar subcategoria..."
              value={searchQuery}
              onValueChange={handleSearch}
            />
            <CommandList>
              <CommandEmpty>
                <div className="py-2 px-3">
                  <p className="text-sm text-muted-foreground mb-2">
                    Subcategoria não encontrada.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNotFound}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Cadastrar "{searchQuery}"
                  </Button>
                </div>
              </CommandEmpty>
              <CommandGroup>
                {filteredSubcategorias.map((subcategoria) => (
                  <CommandItem
                    key={subcategoria.id}
                    value={subcategoria.id}
                    onSelect={() => {
                      onChange(subcategoria.id === value ? null : subcategoria.id);
                      setOpen(false);
                      setSearchQuery('');
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === subcategoria.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {subcategoria.nome}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <AlertDialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cadastrar nova subcategoria</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja cadastrar a subcategoria "{newSubcategoriaName}" agora?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateSubcategoria}>
              Cadastrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
