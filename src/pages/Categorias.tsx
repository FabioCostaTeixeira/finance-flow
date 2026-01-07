import { useState } from 'react';
import { motion } from 'framer-motion';
import { Tags, Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useCategorias, useCreateCategoria, useDeleteCategoria } from '@/hooks/useCategorias';
import { normalizarTexto } from '@/lib/recurrence';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function CategoriasPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<'receita' | 'despesa'>('receita');

  const { data: categorias = [], isLoading } = useCategorias();
  const createCategoria = useCreateCategoria();
  const deleteCategoria = useDeleteCategoria();

  const handleCreate = async () => {
    if (!nome.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Digite um nome para a categoria.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createCategoria.mutateAsync({ nome: nome.trim(), tipo });
      toast({
        title: 'Categoria criada',
        description: `A categoria "${nome}" foi criada com sucesso.`,
      });
      setNome('');
      setDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Erro ao criar categoria',
        description: 'Não foi possível criar a categoria.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string, nome: string) => {
    try {
      await deleteCategoria.mutateAsync(id);
      toast({
        title: 'Categoria excluída',
        description: `A categoria "${nome}" foi excluída.`,
      });
    } catch (error) {
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir a categoria.',
        variant: 'destructive',
      });
    }
  };

  const categoriasReceita = categorias.filter((c) => c.tipo === 'receita');
  const categoriasDespesa = categorias.filter((c) => c.tipo === 'despesa');

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Tags className="w-7 h-7 text-primary" />
            Categorias
          </h1>
          <p className="text-muted-foreground mt-1">
            Organize seus lançamentos por categoria
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nova Categoria
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card">
            <DialogHeader>
              <DialogTitle>Nova Categoria</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome da categoria"
                  className="input-glass"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={(v: 'receita' | 'despesa') => setTipo(v)}>
                  <SelectTrigger className="input-glass">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receita">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        Receita
                      </div>
                    </SelectItem>
                    <SelectItem value="despesa">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-destructive" />
                        Despesa
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreate}
                  disabled={createCategoria.isPending}
                >
                  {createCategoria.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Categorias de Receita</p>
              <p className="text-xl font-bold text-primary">{categoriasReceita.length}</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-destructive/10">
              <TrendingDown className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Categorias de Despesa</p>
              <p className="text-xl font-bold text-destructive">{categoriasDespesa.length}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Receitas */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-xl overflow-hidden"
        >
          <div className="p-4 border-b border-border/50 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-primary">Receitas</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nome</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoriasReceita.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                    Nenhuma categoria de receita
                  </TableCell>
                </TableRow>
              ) : (
                categoriasReceita.map((categoria) => (
                  <TableRow key={categoria.id} className="table-row-hover">
                    <TableCell>{categoria.nome}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(categoria.id, categoria.nome)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </motion.div>

        {/* Despesas */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-xl overflow-hidden"
        >
          <div className="p-4 border-b border-border/50 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-destructive" />
            <h2 className="font-semibold text-destructive">Despesas</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nome</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoriasDespesa.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                    Nenhuma categoria de despesa
                  </TableCell>
                </TableRow>
              ) : (
                categoriasDespesa.map((categoria) => (
                  <TableRow key={categoria.id} className="table-row-hover">
                    <TableCell>{categoria.nome}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(categoria.id, categoria.nome)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </motion.div>
      </div>
    </div>
  );
}
