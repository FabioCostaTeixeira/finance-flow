import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
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
import { useBancos } from '@/hooks/useBancos';

interface BancoComboboxProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function BancoCombobox({ value, onChange }: BancoComboboxProps) {
  const [open, setOpen] = useState(false);
  const { data: bancos = [], isLoading } = useBancos();

  const selectedBanco = bancos.find((b) => b.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between input-glass"
          disabled={isLoading}
        >
          {selectedBanco?.nome || 'Selecione um banco...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar banco..." />
          <CommandList>
            <CommandEmpty>Nenhum banco encontrado.</CommandEmpty>
            <CommandGroup>
              {bancos.map((banco) => (
                <CommandItem
                  key={banco.id}
                  value={banco.nome} // Command uses this for searching
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
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
