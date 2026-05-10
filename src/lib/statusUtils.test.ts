import { describe, it, expect } from 'vitest';
import { getStatusConfig, getComputedStatus } from './statusUtils';
import type { StatusLancamento } from './statusUtils';

describe('getStatusConfig', () => {
  const cases: StatusLancamento[] = [
    'a_receber', 'recebido', 'a_pagar', 'pago',
    'parcial', 'atrasado', 'vencida', 'transferencia',
  ];

  it.each(cases)('retorna label e className para status "%s"', (status) => {
    const config = getStatusConfig(status);
    expect(config.label).toBeTruthy();
    expect(config.className).toBeTruthy();
  });

  it('retorna fallback para status desconhecido', () => {
    const config = getStatusConfig('inexistente' as StatusLancamento);
    expect(config).toBeDefined();
    expect(config.label).toBeTruthy();
  });

  it('a_receber tem label "A Receber"', () => {
    expect(getStatusConfig('a_receber').label).toBe('A Receber');
  });

  it('pago tem label "Pago"', () => {
    expect(getStatusConfig('pago').label).toBe('Pago');
  });

  it('transferencia tem label "Transferência"', () => {
    expect(getStatusConfig('transferencia').label).toBe('Transferência');
  });
});

describe('getComputedStatus', () => {
  const hoje = new Date();
  const dataPassada = new Date(hoje);
  dataPassada.setDate(hoje.getDate() - 10);
  const dataFutura = new Date(hoje);
  dataFutura.setDate(hoje.getDate() + 10);

  const toISO = (d: Date) => d.toISOString().split('T')[0];

  it('despesa a_pagar com data vencida retorna atrasado', () => {
    const status = getComputedStatus({
      status: 'a_pagar',
      tipo: 'despesa',
      data_vencimento: toISO(dataPassada),
      valor: 100,
      valor_pago: null,
    });
    expect(status).toBe('atrasado');
  });

  it('despesa a_pagar com data futura mantém a_pagar', () => {
    const status = getComputedStatus({
      status: 'a_pagar',
      tipo: 'despesa',
      data_vencimento: toISO(dataFutura),
      valor: 100,
      valor_pago: null,
    });
    expect(status).toBe('a_pagar');
  });

  it('receita a_receber com data muito passada (>3 dias) retorna vencida', () => {
    const status = getComputedStatus({
      status: 'a_receber',
      tipo: 'receita',
      data_vencimento: toISO(dataPassada),
      valor: 100,
      valor_pago: null,
    });
    expect(status).toBe('vencida');
  });

  it('receita a_receber com data futura mantém a_receber', () => {
    const status = getComputedStatus({
      status: 'a_receber',
      tipo: 'receita',
      data_vencimento: toISO(dataFutura),
      valor: 100,
      valor_pago: null,
    });
    expect(status).toBe('a_receber');
  });

  it('status pago não é alterado mesmo com data passada', () => {
    const status = getComputedStatus({
      status: 'pago',
      tipo: 'despesa',
      data_vencimento: toISO(dataPassada),
      valor: 100,
      valor_pago: 100,
    });
    expect(status).toBe('pago');
  });

  it('status recebido não é alterado mesmo com data passada', () => {
    const status = getComputedStatus({
      status: 'recebido',
      tipo: 'receita',
      data_vencimento: toISO(dataPassada),
      valor: 100,
      valor_pago: 100,
    });
    expect(status).toBe('recebido');
  });

  it('status parcial não é alterado', () => {
    const status = getComputedStatus({
      status: 'parcial',
      tipo: 'despesa',
      data_vencimento: toISO(dataPassada),
      valor: 100,
      valor_pago: 50,
    });
    expect(status).toBe('parcial');
  });
});
