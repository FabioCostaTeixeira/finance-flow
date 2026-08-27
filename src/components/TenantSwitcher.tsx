import { useState } from 'react';
import { Building2, Check, ChevronsUpDown, Pencil, Loader2 } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function TenantSwitcher() {
  const { tenants, activeTenant, setActiveTenant, role } = useTenant();
  const { refreshMe } = useAuth();
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [nome, setNome] = useState('');
  const [saving, setSaving] = useState(false);

  const handleOpenEdit = () => {
    if (!activeTenant) return;
    setNome(activeTenant.nome);
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !nome.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ nome: nome.trim() })
        .eq('id', activeTenant.id);

      if (error) throw error;

      toast({ title: 'Organização atualizada', description: 'O nome da empresa foi alterado com sucesso' });
      setIsEditing(false);
      await refreshMe();
    } catch (err) {
      toast({
        title: 'Erro ao atualizar',
        description: err instanceof Error ? err.message : 'Não foi possível alterar o nome',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const isMaster = role === 'master';

  return (
    <>
      <div className="flex items-center justify-between gap-1 w-full">
        {tenants.length <= 1 ? (
          <div className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium flex-1 truncate">
            <Building2 className="h-4 w-4 flex-shrink-0 text-primary" />
            <span className="truncate">{activeTenant?.nome ?? '—'}</span>
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex-1 justify-between px-2 cursor-pointer h-9">
                <span className="flex items-center gap-2 truncate">
                  <Building2 className="h-4 w-4 flex-shrink-0 text-primary" />
                  <span className="truncate">{activeTenant?.nome ?? 'Selecione'}</span>
                </span>
                <ChevronsUpDown className="h-4 w-4 flex-shrink-0 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[200px]">
              {tenants.map((t) => (
                <DropdownMenuItem key={t.id} onSelect={() => setActiveTenant(t.id)} className="cursor-pointer">
                  <Check className={cn("mr-2 h-4 w-4", t.id === activeTenant?.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{t.nome}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {isMaster && activeTenant && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleOpenEdit}
            title="Editar nome da organização"
            className="h-8 w-8 flex-shrink-0 cursor-pointer hover:bg-accent/50 text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Modal para Editar Nome do Tenant */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>Editar Nome da Empresa</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-2">
              <Label htmlFor="tenant-name">Nome da Organização</Label>
              <Input
                id="tenant-name"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome da sua empresa"
                disabled={saving}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditing(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || !nome.trim()}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
