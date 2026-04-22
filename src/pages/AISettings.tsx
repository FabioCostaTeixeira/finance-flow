import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, Save, Eye, EyeOff, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAISettings, useUpdateAISettings, PROVIDER_MODELS, type AIProvider } from '@/hooks/useAISettings';
import { toast } from '@/hooks/use-toast';

const PROVIDER_HELP: Record<AIProvider, { url: string; help: string }> = {
  lovable: { url: '', help: 'Já configurado automaticamente. Sem necessidade de API key.' },
  openai: { url: 'https://platform.openai.com/api-keys', help: 'Crie uma chave em platform.openai.com/api-keys (precisa de créditos na sua conta OpenAI).' },
  anthropic: { url: 'https://console.anthropic.com/settings/keys', help: 'Crie uma chave em console.anthropic.com (precisa de créditos na conta Anthropic).' },
  google: { url: 'https://aistudio.google.com/apikey', help: 'Crie uma chave em aistudio.google.com/apikey (gratuito até cota mensal).' },
};

export default function AISettingsPage() {
  const { data: settings, isLoading } = useAISettings();
  const update = useUpdateAISettings();

  const [provider, setProvider] = useState<AIProvider>('lovable');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (settings) {
      setProvider(settings.provider);
      setModel(settings.model);
      setApiKey(settings.api_key || '');
      setSystemPrompt(settings.system_prompt_override || '');
      setEnabled(settings.enabled);
    }
  }, [settings]);

  const models = PROVIDER_MODELS[provider]?.models || [];
  const help = PROVIDER_HELP[provider];

  const handleProviderChange = (next: AIProvider) => {
    setProvider(next);
    const first = PROVIDER_MODELS[next].models[0]?.value;
    if (first) setModel(first);
  };

  const handleSave = async () => {
    if (provider !== 'lovable' && !apiKey.trim()) {
      toast({ title: 'API Key obrigatória', description: 'Cole a chave de API para usar este provedor.', variant: 'destructive' });
      return;
    }
    try {
      await update.mutateAsync({
        provider,
        model,
        api_key: provider === 'lovable' ? null : apiKey.trim(),
        system_prompt_override: systemPrompt.trim() || null,
        enabled,
      });
      toast({ title: 'Salvo!', description: 'Configurações de IA atualizadas.' });
    } catch (e) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Falha ao salvar', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return <div className="p-6">Carregando…</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="pl-10 md:pl-0">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Brain className="w-7 h-7 text-primary" />
            Configurações de IA
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Escolha o provedor de IA e modelo usados pelo agente do sistema (chat web e Telegram).</p>
        </div>
      </motion.div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Provedor ativo
          </CardTitle>
          <CardDescription>A configuração é global — todos os usuários e o bot do Telegram usam o mesmo provedor.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
            <div>
              <Label className="text-base">IA habilitada</Label>
              <p className="text-xs text-muted-foreground">Desligar interrompe o chat de Insights e o bot do Telegram.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="space-y-2">
            <Label>Provedor</Label>
            <Select value={provider} onValueChange={(v) => handleProviderChange(v as AIProvider)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PROVIDER_MODELS) as AIProvider[]).map((p) => (
                  <SelectItem key={p} value={p}>{PROVIDER_MODELS[p].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Modelo</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger><SelectValue placeholder="Selecione um modelo" /></SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {provider !== 'lovable' && (
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex gap-2">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="font-mono text-xs"
                />
                <Button type="button" variant="outline" size="icon" onClick={() => setShowKey(!showKey)}>
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {help.help}{' '}
                {help.url && <a href={help.url} target="_blank" rel="noreferrer" className="text-primary underline">Abrir painel</a>}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Prompt de sistema customizado (opcional)</Label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Deixe em branco para usar o prompt padrão do sistema (recomendado)."
              rows={4}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">⚠️ Sobrescrever o prompt padrão pode quebrar comandos de criação de lançamentos. Use com cuidado.</p>
          </div>

          {provider === 'anthropic' && (
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription className="text-xs">
                Anthropic Claude ainda não suporta tool-calling no formato do nosso agente. Por ora, ele responderá em texto mas <strong>não conseguirá criar/editar lançamentos</strong>. Use OpenAI, Google ou Lovable para funcionalidade completa.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={update.isPending} className="gap-2">
              <Save className="w-4 h-4" />
              {update.isPending ? 'Salvando…' : 'Salvar configurações'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}