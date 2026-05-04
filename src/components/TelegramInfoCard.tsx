import { ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function TelegramInfoCard() {
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
