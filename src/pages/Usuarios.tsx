import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfiles, useUserRoles, useCreateUsuario, useDeleteUsuario } from '@/hooks/useUsuarios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Trash2, Shield } from 'lucide-react';
import { UserPermissionsManager } from '@/components/UserPermissionsManager';
import { z } from 'zod';
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

const createUserSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
  nome: z.string().min(2, 'O nome deve ter no mínimo 2 caracteres'),
  role: z.enum(['admin', 'user']),
});

export default function Usuarios() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [isCreating, setIsCreating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const { data: profiles, isLoading: loadingProfiles } = useProfiles();
  const { data: roles } = useUserRoles();
  const createUserMutation = useCreateUsuario();
  const deleteUserMutation = useDeleteUsuario();

  const getUserRole = (userId: string) => roles?.find(r => r.user_id === userId)?.role || 'user';

  const validateForm = () => {
    try {
      createUserSchema.parse({ email, password, nome, role });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsCreating(true);
    try {
      await createUserMutation.mutateAsync({ email, password, nome, role });
      toast({ title: 'Sucesso!', description: 'Usuário criado com sucesso' });
      setEmail('');
      setPassword('');
      setNome('');
      setRole('user');
    } catch (error) {
      const message = error instanceof Error && error.message.includes('already registered')
        ? 'Este email já está cadastrado'
        : 'Erro ao criar usuário';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteUserMutation.mutateAsync(userId);
      toast({ title: 'Sucesso!', description: 'Usuário removido com sucesso' });
    } catch {
      toast({ title: 'Erro', description: 'Erro ao remover usuário', variant: 'destructive' });
    }
  };

  const getRoleBadge = (userRole: string) => {
    switch (userRole) {
      case 'master':
        return <Badge className="bg-purple-500 hover:bg-purple-600">Master</Badge>;
      case 'admin':
        return <Badge className="bg-blue-500 hover:bg-blue-600">Admin</Badge>;
      default:
        return <Badge variant="secondary">Usuário</Badge>;
    }
  };

  return (
    <main className="flex-1 p-6 overflow-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Gerenciamento de Usuários</h1>
          <p className="text-muted-foreground">Cadastre e gerencie os usuários do sistema</p>
        </div>

        {/* Create User Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Cadastrar Novo Usuário
            </CardTitle>
            <CardDescription>
              Preencha os dados para criar um novo usuário
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  placeholder="Nome do usuário"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  disabled={isCreating}
                  className={errors.nome ? 'border-destructive' : ''}
                />
                {errors.nome && <p className="text-sm text-destructive">{errors.nome}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isCreating}
                  className={errors.email ? 'border-destructive' : ''}
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isCreating}
                  className={errors.password ? 'border-destructive' : ''}
                />
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Perfil</Label>
                <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'user')} disabled={isCreating}>
                  <SelectTrigger className={errors.role ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Selecione o perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                {errors.role && <p className="text-sm text-destructive">{errors.role}</p>}
              </div>

              <div className="flex items-end">
                <Button type="submit" disabled={isCreating} className="w-full">
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Criar
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Usuários Cadastrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingProfiles ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles?.map((profile) => {
                    const userRole = getUserRole(profile.user_id);
                    const isCurrentUser = profile.user_id === currentUser?.id;
                    const isMaster = userRole === 'master';

                    return (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium">{profile.nome || '-'}</TableCell>
                        <TableCell>{profile.email}</TableCell>
                        <TableCell>{getRoleBadge(userRole)}</TableCell>
                        <TableCell>
                          {new Date(profile.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          {!isCurrentUser && !isMaster && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. O usuário {profile.nome || profile.email} será removido permanentemente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteUser(profile.user_id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Remover
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        {/* Permissions Manager */}
        <UserPermissionsManager />
      </div>
    </main>
  );
}
