import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Send, Trash2, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChatMessages, useAddChatMessage, useClearChatHistory } from '@/hooks/useChatMessages';
import { useLancamentos } from '@/hooks/useLancamentos';
import { formatCurrency, formatDate } from '@/lib/recurrence';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function InsightsPage() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading: messagesLoading } = useChatMessages();
  const { data: receitas = [] } = useLancamentos('receita');
  const { data: despesas = [] } = useLancamentos('despesa');
  const addMessage = useAddChatMessage();
  const clearHistory = useClearChatHistory();

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Calculate financial context
  const getFinancialContext = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const receitasMes = receitas.filter((l) => {
      const date = new Date(l.data_vencimento);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const despesasMes = despesas.filter((l) => {
      const date = new Date(l.data_vencimento);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const totalReceitasMes = receitasMes.reduce((acc, l) => acc + Number(l.valor), 0);
    const totalDespesasMes = despesasMes.reduce((acc, l) => acc + Number(l.valor), 0);

    const aReceber = receitas
      .filter((l) => ['a_receber', 'parcial'].includes(l.status))
      .reduce((acc, l) => acc + Number(l.valor) - Number(l.valor_pago || 0), 0);

    const aPagar = despesas
      .filter((l) => ['a_pagar', 'parcial'].includes(l.status))
      .reduce((acc, l) => acc + Number(l.valor) - Number(l.valor_pago || 0), 0);

    // Next week
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const aReceberProximaSemana = receitas
      .filter((l) => {
        const date = new Date(l.data_vencimento);
        return date >= now && date <= nextWeek && ['a_receber', 'parcial'].includes(l.status);
      })
      .reduce((acc, l) => acc + Number(l.valor) - Number(l.valor_pago || 0), 0);

    // Maior despesa do mês
    const maiorDespesa = despesasMes.reduce(
      (max, l) => (Number(l.valor) > max.valor ? { nome: l.cliente_credor, valor: Number(l.valor) } : max),
      { nome: '', valor: 0 }
    );

    return {
      totalReceitasMes,
      totalDespesasMes,
      saldo: totalReceitasMes - totalDespesasMes,
      aReceber,
      aPagar,
      aReceberProximaSemana,
      maiorDespesa,
      totalLancamentos: receitas.length + despesas.length,
    };
  };

  const generateAIResponse = (userMessage: string): string => {
    const context = getFinancialContext();
    const msg = userMessage.toLowerCase();

    // Simple pattern matching for common questions
    if (msg.includes('maior despesa') || msg.includes('despesa mais cara')) {
      if (context.maiorDespesa.valor > 0) {
        return `Sua maior despesa este mês é **${context.maiorDespesa.nome}** no valor de **${formatCurrency(context.maiorDespesa.valor)}**.`;
      }
      return 'Não encontrei despesas registradas para este mês.';
    }

    if (msg.includes('a receber') && msg.includes('semana')) {
      return `Você tem **${formatCurrency(context.aReceberProximaSemana)}** a receber na próxima semana.`;
    }

    if (msg.includes('a receber')) {
      return `Você tem um total de **${formatCurrency(context.aReceber)}** a receber.`;
    }

    if (msg.includes('a pagar')) {
      return `Você tem um total de **${formatCurrency(context.aPagar)}** a pagar.`;
    }

    if (msg.includes('saldo') || msg.includes('balanço')) {
      const saldoStr = context.saldo >= 0 
        ? `positivo de **${formatCurrency(context.saldo)}**` 
        : `negativo de **${formatCurrency(Math.abs(context.saldo))}**`;
      return `Seu saldo do mês está ${saldoStr}.\n\n- Receitas: ${formatCurrency(context.totalReceitasMes)}\n- Despesas: ${formatCurrency(context.totalDespesasMes)}`;
    }

    if (msg.includes('receita') && (msg.includes('mês') || msg.includes('mes'))) {
      return `Suas receitas deste mês totalizam **${formatCurrency(context.totalReceitasMes)}**.`;
    }

    if (msg.includes('despesa') && (msg.includes('mês') || msg.includes('mes'))) {
      return `Suas despesas deste mês totalizam **${formatCurrency(context.totalDespesasMes)}**.`;
    }

    if (msg.includes('resumo') || msg.includes('visão geral') || msg.includes('overview')) {
      return `📊 **Resumo Financeiro**\n\n` +
        `**Este Mês:**\n` +
        `- Receitas: ${formatCurrency(context.totalReceitasMes)}\n` +
        `- Despesas: ${formatCurrency(context.totalDespesasMes)}\n` +
        `- Saldo: ${formatCurrency(context.saldo)}\n\n` +
        `**Pendências:**\n` +
        `- A Receber: ${formatCurrency(context.aReceber)}\n` +
        `- A Pagar: ${formatCurrency(context.aPagar)}\n\n` +
        `Total de ${context.totalLancamentos} lançamentos registrados.`;
    }

    // Default response
    return `Entendi sua pergunta sobre "${userMessage}". Aqui está um resumo do seu momento financeiro:\n\n` +
      `- Saldo do mês: ${formatCurrency(context.saldo)}\n` +
      `- A receber: ${formatCurrency(context.aReceber)}\n` +
      `- A pagar: ${formatCurrency(context.aPagar)}\n\n` +
      `Posso ajudar com perguntas como:\n` +
      `• "Qual minha maior despesa este mês?"\n` +
      `• "Quanto tenho a receber na próxima semana?"\n` +
      `• "Qual meu saldo do mês?"\n` +
      `• "Me dê um resumo financeiro"`;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      // Add user message
      await addMessage.mutateAsync({ role: 'user', content: userMessage });

      // Simulate AI processing delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Generate and add AI response
      const aiResponse = generateAIResponse(userMessage);
      await addMessage.mutateAsync({ role: 'assistant', content: aiResponse });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível processar sua mensagem.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearHistory.mutateAsync();
      toast({
        title: 'Histórico limpo',
        description: 'Todas as mensagens foram removidas.',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível limpar o histórico.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 border-b border-border/50"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Brain className="w-7 h-7 text-primary" />
              Insights por IA
            </h1>
            <p className="text-muted-foreground mt-1">
              Pergunte sobre suas finanças e receba insights inteligentes
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearHistory}
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Limpar histórico
          </Button>
        </div>
      </motion.div>

      {/* Chat Area */}
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto p-6 scrollbar-thin"
      >
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && !messagesLoading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card rounded-2xl p-8 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Bem-vindo ao Insights IA</h2>
              <p className="text-muted-foreground mb-4">
                Faça perguntas sobre suas finanças e receba análises inteligentes.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  'Qual minha maior despesa este mês?',
                  'Quanto tenho a receber?',
                  'Me dê um resumo financeiro',
                ].map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    onClick={() => setInput(suggestion)}
                    className="text-xs"
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </motion.div>
          )}

          <AnimatePresence mode="popLayout">
            {messages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  'flex',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    message.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'
                  )}
                >
                  <p className="whitespace-pre-wrap text-sm">
                    {message.content.split('**').map((part, i) =>
                      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                    )}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="chat-bubble-assistant flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Analisando...</span>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 border-t border-border/50"
      >
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Pergunte sobre suas finanças..."
              className="input-glass"
              disabled={isLoading}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="px-6"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            As mensagens são salvas por 30 dias para manter o contexto das conversas.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
