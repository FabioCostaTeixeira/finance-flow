import { useState } from 'react';
import { motion } from 'framer-motion';
import { Tags, Plus, Trash2, TrendingUp, TrendingDown, ChevronRight, FolderOpen, Edit, Check, X } from 'lucide-react';
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
import { useCategorias, useCreateCategoria, useDeleteCategoria, Categoria } from '@/hooks/useCategorias';
import { useUpdateCategoria } from '@/hooks/useUpdateCategoria';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function CategoriasPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<'receita' | 'despesa'>('receita');
  const [categoriaPaiId, setCategoriaPaiId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const { data: categorias = [], isLoading } = useCategorias();
  const createCategoria = useCreateCategoria();
  const deleteCategoria = useDeleteCategoria();
  const updateCategoria = useUpdateCategoria();

  // Estado para edição inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNome, setEditingNome] = useState('');

  // Filter parent categories by selected type
  const categoriasPai = categorias.filter((c) => c.tipo === tipo && !c.categoria_pai_id);

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
      await createCategoria.mutateAsync({ 
        nome: nome.trim(), 
        tipo,
        categoria_pai_id: categoriaPaiId || undefined,
      });
      toast({
        title: categoriaPaiId ? 'Subcategoria criada' : 'Categoria criada',
        description: `A ${categoriaPaiId ? 'subcategoria' : 'categoria'} "${nome}" foi criada com sucesso.`,
      });
      setNome('');
      setCategoriaPaiId(null);
      setDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Erro ao criar',
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

  const handleStartEdit = (categoria: Categoria) => {
    setEditingId(categoria.id);
    setEditingNome(categoria.nome);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingNome('');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingNome.trim()) return;
    
    try {
      await updateCategoria.mutateAsync({ id: editingId, nome: editingNome.trim() });
      toast({
        title: 'Categoria atualizada',
        description: 'O nome foi alterado com sucesso.',
      });
      setEditingId(null);
      setEditingNome('');
    } catch (error) {
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar a categoria.',
        variant: 'destructive',
      });
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Get parent categories
  const getParentCategorias = (tipoFilter: 'receita' | 'despesa') => {
    return categorias.filter((c) => c.tipo === tipoFilter && !c.categoria_pai_id);
  };

  // Get subcategories for a parent
  const getSubcategorias = (parentId: string) => {
    return categorias.filter((c) => c.categoria_pai_id === parentId);
  };

  const categoriasReceita = getParentCategorias('receita');
  const categoriasDespesa = getParentCategorias('despesa');

  const renderCategoryRow = (categoria: Categoria, isSubcategory = false) => {
    const subcategorias = getSubcategorias(categoria.id);
    const hasSubcategorias = subcategorias.length > 0;
    const isExpanded = expandedCategories.has(categoria.id);

    return (
      <>
        <TableRow key={categoria.id} className="table-row-hover">
          <TableCell>
            <div className={cn("flex items-center gap-2", isSubcategory && "pl-6")}>
              {!isSubcategory && hasSubcategorias && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => toggleExpand(categoria.id)}
                >
                  <ChevronRight className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-90")} />
                </Button>
              )}
              {!isSubcategory && !hasSubcategorias && <div className="w-6" />}
              {isSubcategory && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              
              {editingId === categoria.id ? (
                <Input
                  value={editingNome}
                  onChange={(e) => setEditingNome(e.target.value)}
                  className="h-7 w-40"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                />
              ) : (
                <span>{categoria.nome}</span>
              )}
              
              {hasSubcategorias && editingId !== categoria.id && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {subcategorias.length} sub
                </Badge>
              )}
            </div>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-1">
              {editingId === categoria.id ? (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-primary hover:text-primary"
                    onClick={handleSaveEdit}
                    disabled={updateCategoria.isPending}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={handleCancelEdit}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleStartEdit(categoria)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(categoria.id, categoria.nome)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </TableCell>
        </TableRow>
        {isExpanded && subcategorias.map((sub) => renderCategoryRow(sub, true))}
      </>
    );
  };

  return (
    <div className="flex-1 p-3 md:p-6 space-y-4 md:space-y-6 overflow-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="pl-10 md:pl-0">
          <h1 className="text-lg md:text-2xl font-bold text-foreground flex items-center gap-2">
            <Tags className="w-5 h-5 md:w-7 md:h-7 text-primary" />
            Categorias
          </h1>
          <p className="text-muted-foreground mt-1 text-xs md:text-base">
            Organize seus lançamentos por categoria e subcategoria
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
              <DialogTitle>Nova Categoria / Subcategoria</DialogTitle>
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
                <Select 
                  value={tipo} 
                  onValueChange={(v: 'receita' | 'despesa') => {
                    setTipo(v);
                    setCategoriaPaiId(null); // Reset parent when type changes
                  }}
                >
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
              <div className="space-y-2">
                <Label>Categoria Pai (opcional - deixe vazio para categoria principal)</Label>
                <Select 
                  value={categoriaPaiId || "none"} 
                  onValueChange={(v) => setCategoriaPaiId(v === "none" ? null : v)}
                >
                  <SelectTrigger className="input-glass">
                    <SelectValue placeholder="Selecione uma categoria pai" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="w-4 h-4" />
                        Nenhuma (categoria principal)
                      </div>
                    </SelectItem>
                    {categoriasPai.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          <ChevronRight className="w-4 h-4" />
                          {cat.nome}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setDialogOpen(false);
                    setNome('');
                    setCategoriaPaiId(null);
                  }}
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
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4"
      >
        <div className="glass-card rounded-xl p-3 md:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 md:p-3 rounded-lg bg-primary/10 shrink-0">
              <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground">Categorias de Receita</p>
              <p className="text-sm md:text-xl font-bold text-primary truncate">
                {categoriasReceita.length} cat, {categorias.filter(c => c.tipo === 'receita' && c.categoria_pai_id).length} sub
              </p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-xl p-3 md:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 md:p-3 rounded-lg bg-destructive/10 shrink-0">
              <TrendingDown className="w-5 h-5 md:w-6 md:h-6 text-destructive" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground">Categorias de Despesa</p>
              <p className="text-sm md:text-xl font-bold text-destructive truncate">
                {categoriasDespesa.length} cat, {categorias.filter(c => c.tipo === 'despesa' && c.categoria_pai_id).length} sub
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
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
                categoriasReceita.map((categoria) => renderCategoryRow(categoria))
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
                categoriasDespesa.map((categoria) => renderCategoryRow(categoria))
              )}
            </TableBody>
          </Table>
        </motion.div>
      </div>
    </div>
  );
}
