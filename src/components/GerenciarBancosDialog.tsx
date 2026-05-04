import { useState } from 'react';
import { Edit, Trash2, Plus } from 'lucide-react';
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { useBancos, useCreateBanco, useUpdateBanco, useDeleteBanco } from '@/hooks/useBancos';

export function GerenciarBancosDialog() {
  const { data: bancos = [], isLoading } = useBancos();
  const createBanco = useCreateBanco();
  const updateBanco = useUpdateBanco();
  const deleteBanco = useDeleteBanco();

  const [newBankName, setNewBankName] = useState('');
  const [editingBank, setEditingBank] = useState<{ id: string, nome: string } | null>(null);

  const handleCreate = async () => {
    if (!newBankName.trim()) return;
    try {
      await createBanco.mutateAsync(newBankName.trim());
      toast({ title: 'Banco criado com sucesso!' });
      setNewBankName('');
    } catch (error) {
      toast({ title: 'Erro ao criar banco', variant: 'destructive' });
    }
  };

  const handleUpdate = async () => {
    if (!editingBank || !editingBank.nome.trim()) return;
    try {
      await updateBanco.mutateAsync({ id: editingBank.id, nome: editingBank.nome.trim() });
      toast({ title: 'Banco atualizado com sucesso!' });
      setEditingBank(null);
    } catch (error) {
      toast({ title: 'Erro ao atualizar banco', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBanco.mutateAsync(id);
      toast({ title: 'Banco excluído com sucesso!' });
    } catch (error) {
      toast({ title: 'Erro ao excluir banco', description: 'Verifique se não há lançamentos associados a este banco.', variant: 'destructive' });
    }
  };

  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Gerenciar Bancos</DialogTitle>
        <DialogDescription>Adicione, edite ou remova os nomes dos seus bancos.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="flex gap-2">
          <Input
            placeholder="Nome do novo banco"
            value={newBankName}
            onChange={(e) => setNewBankName(e.target.value)}
          />
          <Button onClick={handleCreate} disabled={createBanco.isPending}>
            <Plus className="w-4 h-4 mr-2" /> Adicionar
          </Button>
        </div>
        <div className="max-h-60 overflow-y-auto pr-2 space-y-2">
          {isLoading ? <p>Carregando...</p> : bancos.map(banco => (
            <div key={banco.id} className="flex items-center gap-2">
              {editingBank?.id === banco.id ? (
                <Input
                  value={editingBank.nome}
                  onChange={(e) => setEditingBank({ ...editingBank, nome: e.target.value })}
                  className="flex-1"
                />
              ) : (
                <p className="flex-1 p-2">{banco.nome}</p>
              )}
              {editingBank?.id === banco.id ? (
                <Button size="sm" onClick={handleUpdate} disabled={updateBanco.isPending}>Salvar</Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setEditingBank(banco)}>
                  <Edit className="w-4 h-4" />
                </Button>
              )}
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(banco.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </DialogContent>
  );
}
