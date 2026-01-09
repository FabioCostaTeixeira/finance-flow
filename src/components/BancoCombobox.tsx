import { useState } from 'react';
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
import { useBancos, useCreateBanco } from '@/hooks/useBancos';
import { toast } from '@/hooks/use-toast';

interface BancoComboboxProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function BancoCombobox({ value, onChange }: BancoComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data: bancos = [] } = useBancos();
  const createBanco = useCreateBanco();

  const selectedBanco = bancos.find((b) => b.id === value);

  const handleCreateBanco = async () => {
    if (!search.trim()) return;

    try {
      const newBanco = await createBanco.mutateAsync(search.trim());
      onChange(newBanco.id);
      setOpen(false);
      setSearch('');
      toast({
        title: 'Banco criado',
        description: `"${search}" foi adicionado à lista.`,
      });
    } catch (error) {
      toast({
        title: 'Erro ao criar banco',
        description: 'Não foi possível criar o banco.',
        variant: 'destructive',
      });
    }
  };

  const filteredBancos = bancos.filter((b) =>
    b.nome.toLowerCase().includes(search.toLowerCase())
  );

  const showCreateOption =
    search.trim() && !filteredBancos.some((b) => b.nome.toLowerCase() === search.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between input-glass"
        >
          {selectedBanco?.nome || 'Selecione o banco...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput
            placeholder="Buscar ou criar banco..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty className="py-2">
              {showCreateOption ? (
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2"
                  onClick={handleCreateBanco}
                >
                  <Plus className="h-4 w-4" />
                  Criar "{search}"
                </Button>
              ) : (
                <span className="text-sm text-muted-foreground px-2">
                  Nenhum banco encontrado
                </span>
              )}
            </CommandEmpty>
            <CommandGroup>
              {filteredBancos.map((banco) => (
                <CommandItem
                  key={banco.id}
                  value={banco.nome}
                  onSelect={() => {
                    onChange(banco.id === value ? null : banco.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === banco.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {banco.nome}
                </CommandItem>
              ))}
              {showCreateOption && filteredBancos.length > 0 && (
                <CommandItem onSelect={handleCreateBanco} className="text-primary">
                  <Plus className="mr-2 h-4 w-4" />
                  Criar "{search}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
