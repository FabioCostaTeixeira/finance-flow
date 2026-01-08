import { addDays, addMonths } from 'date-fns';

export type Frequencia = 'semanal' | 'mensal' | 'trimestral' | 'semestral';

export interface RecorrenciaConfig {
  data_inicio: Date;
  frequencia: Frequencia;
  qtd_parcelas: number;
}

export interface ParcelaCalculada {
  data_vencimento: Date;
  parcela_atual: number;
  total_parcelas: number;
}

/**
 * Calcula as datas de vencimento para lançamentos recorrentes
 * 
 * @param data_inicio - Data do primeiro vencimento
 * @param frequencia - Frequência da recorrência (semanal, mensal, trimestral, semestral)
 * @param qtd_parcelas - Quantidade total de parcelas
 * @returns Array com as datas de vencimento calculadas
 */
export function calcularRecorrencia(
  data_inicio: Date,
  frequencia: Frequencia,
  qtd_parcelas: number
): ParcelaCalculada[] {
  const parcelas: ParcelaCalculada[] = [];
  let dataAtual = new Date(data_inicio);

  for (let i = 1; i <= qtd_parcelas; i++) {
    parcelas.push({
      data_vencimento: new Date(dataAtual),
      parcela_atual: i,
      total_parcelas: qtd_parcelas,
    });

    // Calcula a próxima data baseado na frequência
    switch (frequencia) {
      case 'semanal':
        dataAtual = addDays(dataAtual, 7);
        break;
      case 'mensal':
        dataAtual = addMonths(dataAtual, 1);
        break;
      case 'trimestral':
        dataAtual = addMonths(dataAtual, 3);
        break;
      case 'semestral':
        dataAtual = addMonths(dataAtual, 6);
        break;
    }
  }

  return parcelas;
}

/**
 * Gera um UUID v4 para identificar grupos de recorrência
 */
export function gerarRecorrenciaId(): string {
  return crypto.randomUUID();
}

/**
 * Normaliza texto removendo acentos e convertendo para minúsculas
 * Usado para busca fuzzy de categorias
 */
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Busca fuzzy em lista de itens
 */
export function fuzzySearch<T extends { nome_normalizado?: string; nome?: string }>(
  items: T[],
  query: string
): T[] {
  const normalizedQuery = normalizarTexto(query);
  
  if (!normalizedQuery) return items;

  return items.filter((item) => {
    const searchField = item.nome_normalizado || normalizarTexto(item.nome || '');
    return searchField.includes(normalizedQuery);
  });
}

/**
 * Formata valor como moeda brasileira
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formata data para exibição
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR').format(d);
}

/**
 * Mapeia status para labels amigáveis
 */
export const statusLabels: Record<string, string> = {
  a_receber: 'A Receber',
  recebido: 'Recebido',
  a_pagar: 'A Pagar',
  pago: 'Pago',
  parcial: 'Parcial',
  atrasado: 'Atrasado',
  vencida: 'Vencida',
};

/**
 * Mapeia frequência para labels amigáveis
 */
export const frequenciaLabels: Record<Frequencia, string> = {
  semanal: 'Semanal',
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
};
