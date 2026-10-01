import type { StatusLancamento } from '@/lib/statusUtils';

export type VisaoPainel = 'semana' | 'mes';

export interface FiltrosPainel {
  inicio: Date;
  fim: Date;
  categoriaIds: string[];
  subcategoriaIds: string[];
  bancoIds: string[];
  statusList: StatusLancamento[];
}

export interface PontoFluxo {
  chave: string;
  rotulo: string;
  rotuloCompleto: string;
  inicio: Date;
  fim: Date;
  recebido: number;
  aReceber: number;
  entradas: number;
  pago: number;
  aPagar: number;
  saldoAtual: number;
  saldoPrevisto: number;
  saldoAcumulado: number;
}

export interface CategoriaRanking {
  categoriaId: string;
  nome: string;
  recebido: number;
  aReceber: number;
  total: number;
}

export interface CategoriaDespesaRanking {
  categoriaId: string;
  nome: string;
  pago: number;
  aPagar: number;
  total: number;
}

export interface SaldoBancoPainel {
  bancoId: string;
  nome: string;
  recebido: number;
  pago: number;
  aReceber: number;
  aPagar: number;
  saldoAtual: number;
  saldoPrevisto: number;
}
