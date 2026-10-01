import { describe, it, expect } from 'vitest';
import { calcularSaldoLancamento, isLiquidado } from './saldo';

describe('calcularSaldoLancamento', () => {
  it('liquidado com valor_pago zerado usa o valor previsto', () => {
    // A regressão que fez a aba Bancos mostrar 33,12 e o Fluxo de Caixa 101,42:
    // valor_pago é numeric DEFAULT 0, nunca NULL.
    expect(calcularSaldoLancamento({ status: 'recebido', valor: 101.42, valor_pago: 0 }))
      .toEqual({ realizado: 101.42, pendente: 0 });
  });

  it('liquidado com valor_pago preenchido usa o valor pago', () => {
    expect(calcularSaldoLancamento({ status: 'pago', valor: 100, valor_pago: 95 }))
      .toEqual({ realizado: 95, pendente: 0 });
  });

  it('trata valor_pago nulo igual a zero', () => {
    expect(calcularSaldoLancamento({ status: 'recebido', valor: 50, valor_pago: null }))
      .toEqual({ realizado: 50, pendente: 0 });
  });

  it('transferencia conta como liquidada', () => {
    expect(calcularSaldoLancamento({ status: 'transferencia', valor: 200, valor_pago: 200 }))
      .toEqual({ realizado: 200, pendente: 0 });
  });

  it('parcial separa o pago do que falta', () => {
    expect(calcularSaldoLancamento({ status: 'parcial', valor: 100, valor_pago: 30 }))
      .toEqual({ realizado: 30, pendente: 70 });
  });

  it('parcial sem valor_pago não vira liquidado', () => {
    // Aqui 0 significa mesmo "nada entrou ainda": o status já diz que é parcial.
    expect(calcularSaldoLancamento({ status: 'parcial', valor: 100, valor_pago: 0 }))
      .toEqual({ realizado: 0, pendente: 100 });
  });

  it('aberto fica todo pendente', () => {
    expect(calcularSaldoLancamento({ status: 'a_receber', valor: 80, valor_pago: 0 }))
      .toEqual({ realizado: 0, pendente: 80 });
    expect(calcularSaldoLancamento({ status: 'a_pagar', valor: 80, valor_pago: 0 }))
      .toEqual({ realizado: 0, pendente: 80 });
  });

  it('vencida e atrasado continuam pendentes, não realizados', () => {
    expect(calcularSaldoLancamento({ status: 'vencida', valor: 60, valor_pago: 0 }))
      .toEqual({ realizado: 0, pendente: 60 });
    expect(calcularSaldoLancamento({ status: 'atrasado', valor: 60, valor_pago: 0 }))
      .toEqual({ realizado: 0, pendente: 60 });
  });

  it('pendente nunca fica negativo', () => {
    expect(calcularSaldoLancamento({ status: 'parcial', valor: 100, valor_pago: 130 }))
      .toEqual({ realizado: 130, pendente: 0 });
  });

  it('aceita valores em string, como vêm do PostgREST', () => {
    expect(calcularSaldoLancamento({ status: 'parcial', valor: '100.00', valor_pago: '25.50' }))
      .toEqual({ realizado: 25.5, pendente: 74.5 });
  });

  it('isLiquidado cobre só os três status de quitação total', () => {
    expect(['recebido', 'pago', 'transferencia'].every(isLiquidado)).toBe(true);
    expect(['a_receber', 'a_pagar', 'parcial', 'vencida', 'atrasado'].some(isLiquidado)).toBe(false);
  });
});
