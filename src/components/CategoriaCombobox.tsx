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
import { useCategoriasWithSearch, useCreateCategoria, Categoria } from '@/hooks/useCategorias';
import { toast } from '@/hooks/use-toast';

interface CategoriaComboboxProps {
  tipo: 'receita' | 'despesa';
  value: string | null;
  onChange: (value: string | null) => void;
}

export function CategoriaCombobox({ tipo, value, onChange }: CategoriaComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCategoriaName, setNewCategoriaName] = useState('');

  const { data: filteredCategorias = [], allCategorias = [] } = useCategoriasWithSearch(tipo, searchQuery);
  const createCategoria = useCreateCategoria();

  const selectedCategoria = useMemo(() => {
    return allCategorias.find((c) => c.id === value);
  }, [allCategorias, value]);

  const handleSearch = (search: string) => {
    setSearchQuery(search);
  };

  const handleNotFound = () => {
    if (searchQuery.trim() && filteredCategorias.length === 0) {
      setNewCategoriaName(searchQuery.trim());
      setShowCreateDialog(true);
    }
  };

  const handleCreateCategoria = async () => {
    try {
      const newCategoria = await createCategoria.mutateAsync({
        nome: newCategoriaName,
        tipo,
      });
      onChange(newCategoria.id);
      setShowCreateDialog(false);
      setSearchQuery('');
      setOpen(false);
      toast({
        title: 'Categoria criada',
        description: `A categoria "${newCategoriaName}" foi criada com sucesso.`,
      });
    } catch (error) {
      toast({
        title: 'Erro ao criar categoria',
        description: 'Não foi possível criar a categoria.',
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
          >
            {selectedCategoria?.nome || 'Selecione uma categoria...'}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar categoria..."
              value={searchQuery}
              onValueChange={handleSearch}
            />
            <CommandList>
              <CommandEmpty>
                <div className="py-2 px-3">
                  <p className="text-sm text-muted-foreground mb-2">
                    Categoria não encontrada.
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
                {filteredCategorias.map((categoria) => (
                  <CommandItem
                    key={categoria.id}
                    value={categoria.id}
                    onSelect={() => {
                      onChange(categoria.id === value ? null : categoria.id);
                      setOpen(false);
                      setSearchQuery('');
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === categoria.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {categoria.nome}
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
            <AlertDialogTitle>Cadastrar nova categoria</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja cadastrar a categoria "{newCategoriaName}" agora?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateCategoria}>
              Cadastrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
