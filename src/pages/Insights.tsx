import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Send, Trash2, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useChatMessages, useAddChatMessage, useClearChatHistory } from '@/hooks/useChatMessages';
import { useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();

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
      
      // Invalidar queries caso a IA tenha criado novos lançamentos
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      queryClient.invalidateQueries({ queryKey: ['bancosComSaldos'] });
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
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="p-4 md:p-6 border-b border-border/50">
        <div className="flex items-center justify-between gap-2">
          <div className="pl-10 md:pl-0">
            <h1 className="text-lg md:text-2xl font-bold text-foreground flex items-center gap-2">
              <Brain className="w-5 h-5 md:w-7 md:h-7 text-primary" />
              Insights por IA
            </h1>
            <p className="text-muted-foreground mt-1 text-xs md:text-base">Pergunte sobre suas finanças e receba insights inteligentes</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleClearHistory} className="gap-2 shrink-0">
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Limpar histórico</span>
          </Button>
        </div>
      </motion.div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 md:p-6 scrollbar-thin">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && !messagesLoading && !streamingContent && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card rounded-2xl p-4 md:p-8 text-center">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-primary" />
              </div>
              <h2 className="text-lg md:text-xl font-semibold mb-2">Bem-vindo ao Insights IA</h2>
              <p className="text-muted-foreground mb-4 text-sm">Faça perguntas sobre suas finanças, peça análises ou registre novos lançamentos de forma conversacional.</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  'Qual minha maior despesa este mês?', 
                  'Quanto tenho a receber?', 
                  'Lançar receita de R$100 do Uber',
                  'Me dê um resumo financeiro'
                ].map((suggestion) => (
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

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-3 md:p-6 border-t border-border/50">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-2 md:gap-3 items-end">
            <Textarea 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  e.preventDefault();
                  handleSend();
                }
              }} 
              placeholder="Pergunte sobre suas finanças..." 
              className="input-glass min-h-[48px] md:min-h-[60px] max-h-[200px] resize-none text-sm" 
              disabled={isLoading}
              rows={2}
            />
            <Button onClick={handleSend} disabled={!input.trim() || isLoading} className="px-4 md:px-6 h-[48px] md:h-[60px]">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center hidden sm:block">A IA analisa seus dados e pode criar lançamentos diretamente. Exemplo: "Lançar despesa de R$50 da farmácia"</p>
        </div>
      </motion.div>
    </div>
  );
}
