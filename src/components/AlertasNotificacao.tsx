import { useState, useMemo, useCallback } from 'react';
import { Bell, AlertTriangle, Clock, ChevronRight, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { differenceInDays, parseISO, startOfDay, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLancamentos, LancamentoExtendido } from '@/hooks/useLancamentos';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/recurrence';

interface Alerta {
  id: string;
  tipo: 'despesa_atrasada' | 'receita_vencida' | 'despesa_vencer';
  lancamento: LancamentoExtendido;
  diasAtraso: number;
  mensagem: string;
}

const DISMISSED_KEY = 'alertas_dismissed';

/** Retorna o mapa de IDs dispensados hoje */
function getDismissedToday(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as { date: string; ids: string[] };
    const hoje = format(new Date(), 'yyyy-MM-dd');
    // Se a data salva não é hoje, limpa (lógica de recorrência diária)
    if (parsed.date !== hoje) {
      localStorage.removeItem(DISMISSED_KEY);
      return new Set();
    }
    return new Set(parsed.ids);
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  const hoje = format(new Date(), 'yyyy-MM-dd');
  localStorage.setItem(DISMISSED_KEY, JSON.stringify({ date: hoje, ids: Array.from(ids) }));
}

export function AlertasNotificacao() {
  const [open, setOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => getDismissedToday());
  const { data: lancamentos = [] } = useLancamentos();

  const todosAlertas = useMemo(() => {
    const hoje = startOfDay(new Date());
    const result: Alerta[] = [];

    lancamentos.forEach((lancamento) => {
      const dataVencimento = parseISO(lancamento.data_vencimento);
      const diasDiff = differenceInDays(hoje, dataVencimento);
      const jaQuitado = ['recebido', 'pago'].includes(lancamento.status);

      if (jaQuitado) return;

      if (lancamento.tipo === 'despesa' && diasDiff > 0) {
        result.push({
          id: lancamento.id,
          tipo: 'despesa_atrasada',
          lancamento,
          diasAtraso: diasDiff,
          mensagem: `Despesa em atraso há ${diasDiff} ${diasDiff === 1 ? 'dia' : 'dias'}`,
        });
      }

      if (lancamento.tipo === 'receita' && diasDiff > 0) {
        result.push({
          id: lancamento.id,
          tipo: 'receita_vencida',
          lancamento,
          diasAtraso: diasDiff,
          mensagem: `Receita vencida há ${diasDiff} ${diasDiff === 1 ? 'dia' : 'dias'}`,
        });
      }

      if (lancamento.tipo === 'despesa' && diasDiff <= 0 && diasDiff >= -7) {
        const diasParaVencer = Math.abs(diasDiff);
        result.push({
          id: lancamento.id,
          tipo: 'despesa_vencer',
          lancamento,
          diasAtraso: diasParaVencer,
          mensagem: diasParaVencer === 0
            ? 'Despesa vencendo hoje'
            : `Despesa vencendo em ${diasParaVencer} ${diasParaVencer === 1 ? 'dia' : 'dias'}`,
        });
      }
    });

    return result.sort((a, b) => {
      if (a.tipo === 'despesa_atrasada' && b.tipo !== 'despesa_atrasada') return -1;
      if (b.tipo === 'despesa_atrasada' && a.tipo !== 'despesa_atrasada') return 1;
      if (a.tipo === 'receita_vencida' && b.tipo !== 'receita_vencida') return -1;
      if (b.tipo === 'receita_vencida' && a.tipo !== 'receita_vencida') return 1;
      return b.diasAtraso - a.diasAtraso;
    });
  }, [lancamentos]);

  // Filtra os alertas removendo os dispensados hoje
  const alertas = useMemo(
    () => todosAlertas.filter((a) => !dismissedIds.has(a.id)),
    [todosAlertas, dismissedIds]
  );

  const despesasAtrasadas = alertas.filter(a => a.tipo === 'despesa_atrasada').length;
  const receitasVencidas = alertas.filter(a => a.tipo === 'receita_vencida').length;
  const totalUrgente = despesasAtrasadas + receitasVencidas;

  const dismissAlerta = useCallback((id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    const allIds = new Set(todosAlertas.map((a) => a.id));
    setDismissedIds(allIds);
    saveDismissed(allIds);
  }, [todosAlertas]);

  const handleNavigate = useCallback((alerta: Alerta) => {
    dismissAlerta(alerta.id);
    const rota = alerta.lancamento.tipo === 'receita' ? '/receitas' : '/despesas';
    window.location.href = `${rota}?highlight=${alerta.lancamento.id}`;
    setOpen(false);
  }, [dismissAlerta]);

  const getAlertaColor = (tipo: Alerta['tipo']) => {
    switch (tipo) {
      case 'despesa_atrasada':
        return 'text-destructive bg-destructive/10 border-destructive/30';
      case 'receita_vencida':
        return 'text-warning bg-warning/10 border-warning/30';
      case 'despesa_vencer':
        return 'text-primary bg-primary/10 border-primary/30';
    }
  };

  const getAlertaIcon = (tipo: Alerta['tipo']) => {
    switch (tipo) {
      case 'despesa_atrasada':
        return <AlertTriangle className="w-4 h-4" />;
      case 'receita_vencida':
      case 'despesa_vencer':
        return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full">
          <Bell className={cn("h-5 w-5", totalUrgente > 0 && "text-destructive animate-pulse")} />
          {alertas.length > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={cn(
                "absolute -top-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground",
                totalUrgente > 0 ? "bg-destructive" : "bg-primary"
              )}
            >
              {alertas.length > 99 ? '99+' : alertas.length}
            </motion.span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0 glass-card" sideOffset={8}>
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Notificações</h3>
            <div className="flex items-center gap-2">
              {despesasAtrasadas > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {despesasAtrasadas} atrasada{despesasAtrasadas > 1 ? 's' : ''}
                </Badge>
              )}
              {receitasVencidas > 0 && (
                <Badge className="bg-warning text-warning-foreground text-xs">
                  {receitasVencidas} vencida{receitasVencidas > 1 ? 's' : ''}
                </Badge>
              )}
              {alertas.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearAll();
                  }}
                  title="Limpar todas"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <ScrollArea className="max-h-80">
          <AnimatePresence>
            {alertas.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-8 text-center text-muted-foreground"
              >
                <Bell className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>Nenhuma notificação</p>
              </motion.div>
            ) : (
              <div className="p-2 space-y-2">
                {alertas.map((alerta, index) => (
                  <motion.div
                    key={alerta.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10, height: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleNavigate(alerta)}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-all hover:scale-[1.02]",
                      getAlertaColor(alerta.tipo)
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {getAlertaIcon(alerta.tipo)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {alerta.lancamento.cliente_credor}
                        </p>
                        <p className="text-xs opacity-80 mt-0.5">
                          {alerta.mensagem}
                        </p>
                        <p className="text-sm font-semibold mt-1">
                          {formatCurrency(Number(alerta.lancamento.valor))}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-50" />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
