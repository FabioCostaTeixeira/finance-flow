import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useOperatorTenants, useOperatorMembers, useAddMember, useUpdateMemberRole, useRemoveMember, type OperatorRole } from '@/hooks/useOperatorConsole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Trash2, Users, ArrowLeft } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function OperatorTenantDetail() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const { toast } = useToast();
  const { data: tenants } = useOperatorTenants();
  const tenant = tenants?.find((t) => t.id === tenantId);

  const { data: members, isLoading } = useOperatorMembers(tenantId);
  const addMember = useAddMember(tenantId);
  const updateRole = useUpdateMemberRole(tenantId);
  const removeMember = useRemoveMember(tenantId);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OperatorRole>('user');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsAdding(true);
    try {
      await addMember.mutateAsync({ email: email.trim(), role });
      toast({ title: 'Membro adicionado', description: `${email} foi vinculado ao tenant` });
      setEmail('');
      setRole('user');
    } catch (error) {
      toast({ title: 'Erro', description: error instanceof Error ? error.message : 'Erro ao adicionar membro', variant: 'destructive' });
    } finally {
      setIsAdding(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: OperatorRole) => {
    try {
      await updateRole.mutateAsync({ user_id: userId, role: newRole });
      toast({ title: 'Role atualizada' });
    } catch (error) {
      toast({ title: 'Erro', description: error instanceof Error ? error.message : 'Erro ao atualizar role', variant: 'destructive' });
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await removeMember.mutateAsync({ user_id: userId });
      toast({ title: 'Membro removido' });
    } catch (error) {
      toast({ title: 'Erro', description: error instanceof Error ? error.message : 'Erro ao remover membro', variant: 'destructive' });
    }
  };

  return (
    <main className="min-h-screen w-full bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link to="/operador"><ArrowLeft className="mr-2 h-4 w-4" />Tenants</Link>
          </Button>
          <h1 className="text-3xl font-bold">{tenant?.nome ?? 'Tenant'}</h1>
          {tenant && <p className="text-muted-foreground">{tenant.slug}</p>}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Adicionar membro
            </CardTitle>
            <CardDescription>
              Se o email já existe em outro cadastro, o usuário é apenas vinculado. Caso contrário, um convite é enviado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isAdding} placeholder="email@exemplo.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as OperatorRole)} disabled={isAdding}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="master">Master</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="user">Usuário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={isAdding} className="w-full">
                  {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  Adicionar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Membros
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
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Desde</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members?.map((m) => (
                    <TableRow key={m.user_id}>
                      <TableCell className="font-medium">{m.nome || '-'}</TableCell>
                      <TableCell>{m.email || '-'}</TableCell>
                      <TableCell>
                        <Select value={m.role} onValueChange={(v) => handleRoleChange(m.user_id, v as OperatorRole)}>
                          <SelectTrigger className="w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="master">Master</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="user">Usuário</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{new Date(m.created_at).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover membro?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {m.nome || m.email} será removido deste tenant. Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleRemove(m.user_id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                  {members?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                        Nenhum membro neste tenant.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
