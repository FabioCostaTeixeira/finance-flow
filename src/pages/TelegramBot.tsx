import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Copy, RefreshCw, Trash2, CheckCircle2, Clock, XCircle, MessageCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMyChannels, useGenerateTelegramPairing, useDeleteChannel, useRevokeChannel } from '@/hooks/useTelegram';
import { toast } from '@/hooks/use-toast';

export default function TelegramBotPage() {
  const { data: channels = [], isLoading } = useMyChannels();
  const generate = useGenerateTelegramPairing();
  const del = useDeleteChannel();
  const revoke = useRevokeChannel();

  const [activeToken, setActiveToken] = useState<{ token: string; expires: string } | null>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    if (!activeToken) { setRemainingMs(null); return; }
    const tick = () => {
      const ms = new Date(activeToken.expires).getTime() - Date.now();
      setRemainingMs(ms);
      if (ms <= 0) setActiveToken(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeToken]);

  const handleGenerate = async () => {
    try {
      const res = await generate.mutateAsync();
      setActiveToken({ token: res.token, expires: res.expires_at });
    } catch (e) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Falha ao gerar token', variant: 'destructive' });
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado!', description: text });
  };

  const telegramChannels = channels.filter((c) => c.channel_type === 'telegram');
  const activeChannel = telegramChannels.find((c) => c.status === 'active');

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="pl-10 md:pl-0">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Send className="w-7 h-7 text-primary" />
            Bot Telegram
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Vincule sua conta ao bot do Telegram para conversar em linguagem natural e registrar lançamentos.</p>
        </div>
      </motion.div>

      <div className="space-y-4">
        {/* Conta ativa */}
        {activeChannel && (
          <Card className="glass-card border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                Conta vinculada
              </CardTitle>
              <CardDescription>Você já pode conversar com o bot no Telegram.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Telegram</p>
                <p className="font-medium">{activeChannel.display_name || `Chat ${activeChannel.channel_user_id}`}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => revoke.mutate(activeChannel.id)} className="gap-2">
                  <XCircle className="w-4 h-4" /> Revogar acesso
                </Button>
                <Button size="sm" variant="ghost" onClick={() => del.mutate(activeChannel.id)} className="gap-2 text-destructive">
                  <Trash2 className="w-4 h-4" /> Remover vínculo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pareamento */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">{activeChannel ? 'Vincular outra conta' : 'Vincular sua conta'}</CardTitle>
            <CardDescription>Gere um token e envie no Telegram para o bot.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-2 text-sm list-decimal list-inside text-muted-foreground">
              <li>
                Abra o bot no Telegram e envie <code className="bg-muted px-1 rounded">/start</code>.{' '}
                <span className="text-xs">(Pergunte ao admin do sistema o nome de usuário do bot.)</span>
              </li>
              <li>Clique em "Gerar token" abaixo.</li>
              <li>No Telegram, envie <code className="bg-muted px-1 rounded">/vincular SEU_TOKEN</code>.</li>
              <li>Pronto! O bot confirma o vínculo.</li>
            </ol>

            {activeToken && remainingMs !== null && remainingMs > 0 ? (
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/30 space-y-2">
                <p className="text-xs text-muted-foreground">Seu token (válido por {Math.ceil(remainingMs / 60000)} min):</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-2xl font-bold tracking-wider text-center py-2 bg-background rounded border border-border">
                    {activeToken.token}
                  </code>
                  <Button size="icon" variant="outline" onClick={() => copy(activeToken.token)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Envie no Telegram: <code className="bg-muted px-1 rounded">/vincular {activeToken.token}</code>
                </p>
                <Button size="sm" variant="ghost" onClick={() => copy(`/vincular ${activeToken.token}`)} className="gap-2 w-full">
                  <Copy className="w-3 h-3" /> Copiar comando completo
                </Button>
              </div>
            ) : (
              <Button onClick={handleGenerate} disabled={generate.isPending} className="w-full gap-2">
                <RefreshCw className={`w-4 h-4 ${generate.isPending ? 'animate-spin' : ''}`} />
                Gerar token de pareamento
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Histórico */}
        {telegramChannels.length > 0 && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Histórico de vínculos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {telegramChannels.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-3 min-w-0">
                      {c.status === 'active' && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                      {c.status === 'pending' && <Clock className="w-4 h-4 text-amber-500 shrink-0" />}
                      {c.status === 'revoked' && <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.display_name || c.channel_user_id || 'Pendente'}</p>
                        <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString('pt-BR')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="text-xs">{c.status}</Badge>
                      <Button size="icon" variant="ghost" onClick={() => del.mutate(c.id)} className="h-8 w-8">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Alert />
      </div>
    </div>
  );
}

function Alert() {
  return (
    <Card className="glass-card bg-muted/20">
      <CardContent className="pt-4">
        <div className="flex gap-2 items-start">
          <ExternalLink className="w-4 h-4 mt-1 shrink-0 text-muted-foreground" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Como o admin cria o bot:</strong> abra @BotFather no Telegram, envie <code>/newbot</code>, escolha nome e username. Cole o token retornado nas configurações de Connector do Lovable.</p>
            <p>Após o pareamento, o bot processa mensagens a cada ~1 minuto (long polling). Suporte a imagens, áudios e cupons fiscais será adicionado em próxima entrega.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}