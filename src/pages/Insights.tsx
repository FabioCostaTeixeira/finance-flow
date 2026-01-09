import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Send, Trash2, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChatMessages, useAddChatMessage, useClearChatHistory } from '@/hooks/useChatMessages';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

type Msg = { role: 'user' | 'assistant'; content: string };

export default function InsightsPage() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading: messagesLoading } = useChatMessages();
  const addMessage = useAddChatMessage();
  const clearHistory = useClearChatHistory();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const streamChat = async (chatMessages: Msg[]) => {
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages: chatMessages }),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erro ao processar mensagem');
    }

    if (!resp.body) throw new Error('No response body');

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = '';
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') break;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            fullContent += content;
            setStreamingContent(fullContent);
          }
        } catch {
          textBuffer = line + '\n' + textBuffer;
          break;
        }
      }
    }

    return fullContent;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);
    setStreamingContent('');

    try {
      await addMessage.mutateAsync({ role: 'user', content: userMessage });

      const chatHistory: Msg[] = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: userMessage },
      ];

      const aiResponse = await streamChat(chatHistory);
      await addMessage.mutateAsync({ role: 'assistant', content: aiResponse });
      setStreamingContent('');
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível processar sua mensagem.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearHistory.mutateAsync();
      toast({ title: 'Histórico limpo', description: 'Todas as mensagens foram removidas.' });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível limpar o histórico.', variant: 'destructive' });
    }
  };

  const renderContent = (content: string) => {
    return content.split('**').map((part, i) =>
      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
    );
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="p-6 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Brain className="w-7 h-7 text-primary" />
              Insights por IA
            </h1>
            <p className="text-muted-foreground mt-1">Pergunte sobre suas finanças e receba insights inteligentes</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleClearHistory} className="gap-2">
            <Trash2 className="w-4 h-4" />
            Limpar histórico
          </Button>
        </div>
      </motion.div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 scrollbar-thin">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && !messagesLoading && !streamingContent && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card rounded-2xl p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Bem-vindo ao Insights IA</h2>
              <p className="text-muted-foreground mb-4">Faça perguntas sobre suas finanças e receba análises inteligentes baseadas nos seus dados reais.</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {['Qual minha maior despesa este mês?', 'Quanto tenho a receber?', 'Me dê um resumo financeiro'].map((suggestion) => (
                  <Button key={suggestion} variant="outline" size="sm" onClick={() => setInput(suggestion)} className="text-xs">
                    {suggestion}
                  </Button>
                ))}
              </div>
            </motion.div>
          )}

          <AnimatePresence mode="popLayout">
            {messages.map((message, index) => (
              <motion.div key={message.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(message.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant')}>
                  <p className="whitespace-pre-wrap text-sm">{renderContent(message.content)}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {streamingContent && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="chat-bubble-assistant">
                <p className="whitespace-pre-wrap text-sm">{renderContent(streamingContent)}</p>
              </div>
            </motion.div>
          )}

          {isLoading && !streamingContent && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="chat-bubble-assistant flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Analisando seus dados...</span>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 border-t border-border/50">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3">
            <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Pergunte sobre suas finanças..." className="input-glass" disabled={isLoading} />
            <Button onClick={handleSend} disabled={!input.trim() || isLoading} className="px-6">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">A IA analisa seus dados financeiros reais para fornecer insights personalizados.</p>
        </div>
      </motion.div>
    </div>
  );
}
