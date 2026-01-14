import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Plus, Copy, Trash2, Eye, EyeOff, Power, Activity, Clock, Globe, Book } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useApiKeys, useCreateApiKey, useDeleteApiKey, useToggleApiKey, useApiAccessLogs } from '@/hooks/useApiKeys';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ApiKeysPage() {
  const [newKeyName, setNewKeyName] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);

  const { data: apiKeys = [], isLoading } = useApiKeys();
  const { data: accessLogs = [] } = useApiAccessLogs(selectedKeyId || undefined);
  const createKey = useCreateApiKey();
  const deleteKey = useDeleteApiKey();
  const toggleKey = useToggleApiKey();

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    await createKey.mutateAsync(newKeyName.trim());
    setNewKeyName('');
    setIsCreateOpen(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado!', description: 'Chave copiada para a área de transferência.' });
  };

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const maskKey = (key: string) => `${key.slice(0, 6)}${'•'.repeat(20)}${key.slice(-4)}`;

  const getLogsStats = (keyId: string) => {
    const keyLogs = accessLogs.filter(log => log.api_key_id === keyId);
    const today = new Date();
    const todayLogs = keyLogs.filter(log => {
      const logDate = new Date(log.created_at);
      return logDate.toDateString() === today.toDateString();
    });
    
    return {
      total: keyLogs.length,
      today: todayLogs.length,
    };
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="p-6 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Key className="w-7 h-7 text-primary" />
              Chaves de API
            </h1>
            <p className="text-muted-foreground mt-1">Gerencie suas chaves de acesso para integração com Power BI e outros serviços</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild className="gap-2">
              <Link to="/api/docs">
                <Book className="w-4 h-4" />
                Documentação
              </Link>
            </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Nova Chave
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Chave de API</DialogTitle>
                <DialogDescription>
                  Dê um nome para identificar esta chave. A chave será gerada automaticamente.
                </DialogDescription>
              </DialogHeader>
              <Input
                placeholder="Ex: Power BI Dashboard"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={!newKeyName.trim() || createKey.isPending}>
                  Criar Chave
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </motion.div>

      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Info Card */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Endpoint da API
              </CardTitle>
              <CardDescription>
                Use este endpoint para acessar seus dados financeiros
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 bg-muted/50 p-3 rounded-lg">
                <code className="text-sm flex-1 text-foreground">
                  {import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/lancamentos
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/lancamentos`)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Adicione o header <code className="bg-muted px-1 rounded">X-API-Key: sua_chave</code> em todas as requisições.
              </p>
            </CardContent>
          </Card>

          {/* API Keys List */}
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : apiKeys.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="py-12 text-center">
                <Key className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">Nenhuma chave de API criada ainda.</p>
                <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar primeira chave
                </Button>
              </CardContent>
            </Card>
          ) : (
            <AnimatePresence mode="popLayout">
              {apiKeys.map((key, index) => {
                const stats = selectedKeyId === key.id ? getLogsStats(key.id) : { total: 0, today: 0 };
                
                return (
                  <motion.div
                    key={key.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="glass-card">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-3">
                              <h3 className="font-semibold text-foreground">{key.nome}</h3>
                              <Badge variant={key.ativa ? 'default' : 'secondary'}>
                                {key.ativa ? 'Ativa' : 'Inativa'}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-lg">
                              <code className="text-sm flex-1 font-mono text-foreground">
                                {visibleKeys[key.id] ? key.chave : maskKey(key.chave)}
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleKeyVisibility(key.id)}
                              >
                                {visibleKeys[key.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(key.chave)}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>

                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Criada em {format(new Date(key.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </span>
                              {key.ultimo_acesso && (
                                <span className="flex items-center gap-1">
                                  <Activity className="w-3 h-3" />
                                  Último acesso: {format(new Date(key.ultimo_acesso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2">
                              <Power className="w-4 h-4 text-muted-foreground" />
                              <Switch
                                checked={key.ativa}
                                onCheckedChange={(checked) => toggleKey.mutate({ id: key.id, ativa: checked })}
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedKeyId(selectedKeyId === key.id ? null : key.id)}
                              className="gap-1"
                            >
                              <Activity className="w-4 h-4" />
                              Logs
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteKey.mutate(key.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Logs Section */}
                        <AnimatePresence>
                          {selectedKeyId === key.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-4 pt-4 border-t border-border/50"
                            >
                              <div className="flex items-center gap-4 mb-4">
                                <Badge variant="outline">Total: {stats.total} acessos</Badge>
                                <Badge variant="outline">Hoje: {stats.today} acessos</Badge>
                              </div>
                              
                              {accessLogs.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Nenhum acesso registrado ainda.</p>
                              ) : (
                                <div className="max-h-48 overflow-y-auto space-y-2">
                                  {accessLogs.slice(0, 10).map((log) => (
                                    <div key={log.id} className="flex items-center gap-4 text-xs bg-muted/30 p-2 rounded">
                                      <Badge variant={log.response_status === 200 ? 'default' : 'destructive'} className="text-xs">
                                        {log.response_status || '---'}
                                      </Badge>
                                      <span className="font-mono">{log.endpoint}</span>
                                      <span className="text-muted-foreground flex-1">{log.ip_address || 'IP desconhecido'}</span>
                                      <span className="text-muted-foreground">
                                        {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
