import { describe, it, expect } from 'vitest';
import { calcularRecorrencia } from './recurrence';

// Helper: formata data local (sem conversão UTC)
function toLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('calcularRecorrencia', () => {
  it('gera a quantidade correta de parcelas', () => {
    const parcelas = calcularRecorrencia(new Date(2026, 0, 1), 'mensal', 6);
    expect(parcelas).toHaveLength(6);
  });

  it('primeira parcela é na data de início', () => {
    const inicio = new Date(2026, 2, 15); // 15 Mar
    const parcelas = calcularRecorrencia(inicio, 'mensal', 3);
    expect(toLocalDate(parcelas[0].data_vencimento)).toBe('2026-03-15');
  });

  it('parcelas mensais avançam 1 mês cada', () => {
    const parcelas = calcularRecorrencia(new Date(2026, 0, 10), 'mensal', 3);
    expect(toLocalDate(parcelas[0].data_vencimento)).toBe('2026-01-10');
    expect(toLocalDate(parcelas[1].data_vencimento)).toBe('2026-02-10');
    expect(toLocalDate(parcelas[2].data_vencimento)).toBe('2026-03-10');
  });

  it('parcelas semanais avançam 7 dias cada', () => {
    const parcelas = calcularRecorrencia(new Date(2026, 0, 1), 'semanal', 4);
    expect(toLocalDate(parcelas[1].data_vencimento)).toBe('2026-01-08');
    expect(toLocalDate(parcelas[2].data_vencimento)).toBe('2026-01-15');
    expect(toLocalDate(parcelas[3].data_vencimento)).toBe('2026-01-22');
  });

  it('parcelas trimestrais avançam 3 meses cada', () => {
    const parcelas = calcularRecorrencia(new Date(2026, 0, 1), 'trimestral', 4);
    expect(toLocalDate(parcelas[1].data_vencimento)).toBe('2026-04-01');
    expect(toLocalDate(parcelas[2].data_vencimento)).toBe('2026-07-01');
    expect(toLocalDate(parcelas[3].data_vencimento)).toBe('2026-10-01');
  });

  it('parcelas semestrais avançam 6 meses cada', () => {
    const parcelas = calcularRecorrencia(new Date(2026, 0, 1), 'semestral', 2);
    expect(toLocalDate(parcelas[1].data_vencimento)).toBe('2026-07-01');
  });

  it('parcela_atual e total_parcelas estão corretos', () => {
    const parcelas = calcularRecorrencia(new Date(2026, 0, 1), 'mensal', 3);
    expect(parcelas[0].parcela_atual).toBe(1);
    expect(parcelas[1].parcela_atual).toBe(2);
    expect(parcelas[2].parcela_atual).toBe(3);
    parcelas.forEach(p => expect(p.total_parcelas).toBe(3));
  });

  it('mês de fevereiro — dia 31 de janeiro clampeia para 28 fev (não-bissexto)', () => {
    // date-fns addMonths clampeia para o último dia do mês
    const parcelas = calcularRecorrencia(new Date(2026, 0, 31), 'mensal', 2);
    expect(toLocalDate(parcelas[1].data_vencimento)).toBe('2026-02-28');
  });

  it('ano bissexto — dia 31 de janeiro clampeia para 29 fev', () => {
    // 2028 é ano bissexto — fevereiro tem 29 dias
    const parcelas = calcularRecorrencia(new Date(2028, 0, 31), 'mensal', 2);
    expect(toLocalDate(parcelas[1].data_vencimento)).toBe('2028-02-29');
  });

  it('retorna array vazio para 0 parcelas', () => {
    const parcelas = calcularRecorrencia(new Date(2026, 0, 1), 'mensal', 0);
    expect(parcelas).toHaveLength(0);
  });

  it('parcela única retorna 1 item com parcela_atual 1', () => {
    const parcelas = calcularRecorrencia(new Date(2026, 5, 15), 'mensal', 1);
    expect(parcelas).toHaveLength(1);
    expect(parcelas[0].parcela_atual).toBe(1);
    expect(parcelas[0].total_parcelas).toBe(1);
  });
});
