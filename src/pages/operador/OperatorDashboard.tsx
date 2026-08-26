import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useOperatorTenants, useCreateTenant, useToggleTenantAtivo } from '@/hooks/useOperatorConsole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building2, Plus, LogOut } from 'lucide-react';

export default function OperatorDashboard() {
  const { signOut, userName } = useAuth();
  const { toast } = useToast();
  const { data: tenants, isLoading } = useOperatorTenants();
  const createTenant = useCreateTenant();
  const toggleAtivo = useToggleTenantAtivo();

  const [nome, setNome] = useState('');
  const [slug, setSlug] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !slug.trim()) return;
    setIsCreating(true);
    try {
      await createTenant.mutateAsync({ nome: nome.trim(), slug: slug.trim() });
      toast({ title: 'Tenant criado', description: `${nome} foi criado com sucesso` });
      setNome('');
      setSlug('');
    } catch (error) {
      toast({ title: 'Erro', description: error instanceof Error ? error.message : 'Erro ao criar tenant', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggle = async (tenantId: string, ativo: boolean) => {
    try {
      await toggleAtivo.mutateAsync({ tenant_id: tenantId, ativo });
    } catch (error) {
      toast({ title: 'Erro', description: error instanceof Error ? error.message : 'Erro ao atualizar tenant', variant: 'destructive' });
    }
  };

  return (
    <main className="min-h-screen w-full bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold text-gradient-brand">Console de Operador</h1>
            <p className="text-muted-foreground">
              Área interna de plataforma{userName ? ` — ${userName}` : ''}. Sem acesso a dados financeiros de tenants.
            </p>
          </div>
          <Button variant="outline" onClick={() => signOut()} className="cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Novo tenant
              </CardTitle>
              <CardDescription>Cria uma nova organização na plataforma.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} disabled={isCreating} placeholder="Nome da organização" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} disabled={isCreating} placeholder="minha-organizacao" />
                </div>
                <div className="flex items-end">
                  <Button type="submit" disabled={isCreating} className="w-full min-h-[44px]">
                    {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Criar tenant
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.16, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Tenants
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead>Nome</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="w-[80px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenants?.map((t, index) => (
                      <motion.tr
                        key={t.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: Math.min(index, 12) * 0.03, ease: 'easeOut' }}
                        className="table-row-hover border-border/30"
                      >
                        <TableCell className="font-medium">
                          <Link to={`/operador/tenants/${t.id}`} className="text-primary hover:underline cursor-pointer">
                            {t.nome}
                          </Link>
                        </TableCell>
                        <TableCell><Badge variant="secondary">{t.slug}</Badge></TableCell>
                        <TableCell>{t.plano}</TableCell>
                        <TableCell>
                          <Switch checked={t.ativo} onCheckedChange={(v) => handleToggle(t.id, v)} className="cursor-pointer" />
                        </TableCell>
                        <TableCell>{new Date(t.created_at).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild className="cursor-pointer">
                            <Link to={`/operador/tenants/${t.id}`}>Ver</Link>
                          </Button>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </main>
  );
}
