import type { Database } from './types';

export type LancamentoInsertWithFrequencia = Database['public']['Tables']['lancamentos']['Insert'] & {
  frequencia?: string | null;
};

export type LancamentoRowWithFrequencia = Database['public']['Tables']['lancamentos']['Row'] & {
  frequencia: string | null;
};
