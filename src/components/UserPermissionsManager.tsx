import { useAllPermissions, useTogglePermission, ALL_MODULES, hasModuleAccess } from '@/hooks/useUserPermissions';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type Profile = {
  id: string;
  user_id: string;
  email: string;
  nome: string | null;
};

type UserRole = {
  user_id: string;
  role: 'master' | 'admin' | 'user';
};

export function UserPermissionsManager() {
  const { user: currentUser } = useAuth();
  const { data: permissions, isLoading: loadingPerms } = useAllPermissions();
  const togglePermission = useTogglePermission();

  const { data: profiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: roles } = useQuery({
    queryKey: ['user_roles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_roles').select('user_id, role');
      if (error) throw error;
      return data as UserRole[];
    },
  });

  const getUserRole = (userId: string) => roles?.find(r => r.user_id === userId)?.role || 'user';

  // Filter out master users - they always have full access
  const nonMasterProfiles = profiles?.filter(p => getUserRole(p.user_id) !== 'master') || [];

  const parentModules = ALL_MODULES.filter(m => m.parent === null);
  const getChildren = (parentKey: string) => ALL_MODULES.filter(m => m.parent === parentKey);

  const isAllowed = (userId: string, moduleKey: string) => {
    return hasModuleAccess(permissions || [], moduleKey, getUserRole(userId));
  };

  const handleToggle = (userId: string, moduleKey: string, currentValue: boolean) => {
    togglePermission.mutate({ userId, moduleKey, allowed: !currentValue });
  };

  // Toggle all modules for a user
  const handleToggleAll = (userId: string) => {
    const allAllowed = ALL_MODULES.every(m => isAllowed(userId, m.key));
    ALL_MODULES.forEach(m => {
      togglePermission.mutate({ userId, moduleKey: m.key, allowed: !allAllowed });
    });
  };

  if (loadingPerms) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Gerenciamento de Acessos
        </CardTitle>
        <CardDescription>
          Defina quais páginas e módulos cada usuário pode acessar. Usuários Master têm acesso total.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {nonMasterProfiles.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhum usuário não-master cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px] sticky left-0 bg-background z-10">Usuário</TableHead>
                  <TableHead className="text-center min-w-[60px]">Todos</TableHead>
                  {ALL_MODULES.map(mod => (
                    <TableHead key={mod.key} className="text-center min-w-[90px]">
                      <div className="flex flex-col items-center gap-0.5">
                        {mod.parent && <span className="text-[10px] text-muted-foreground">↳</span>}
                        <span className={mod.parent ? 'text-xs' : 'text-xs font-semibold'}>{mod.label}</span>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {nonMasterProfiles.map(profile => {
                  const allChecked = ALL_MODULES.every(m => isAllowed(profile.user_id, m.key));
                  return (
                    <TableRow key={profile.id}>
                      <TableCell className="sticky left-0 bg-background z-10">
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{profile.nome || '-'}</span>
                          <span className="text-xs text-muted-foreground">{profile.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={allChecked}
                          onCheckedChange={() => handleToggleAll(profile.user_id)}
                        />
                      </TableCell>
                      {ALL_MODULES.map(mod => {
                        const allowed = isAllowed(profile.user_id, mod.key);
                        return (
                          <TableCell key={mod.key} className="text-center">
                            <Checkbox
                              checked={allowed}
                              onCheckedChange={() => handleToggle(profile.user_id, mod.key, allowed)}
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
