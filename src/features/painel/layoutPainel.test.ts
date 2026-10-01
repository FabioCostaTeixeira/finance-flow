import { describe, expect, it, beforeEach } from 'vitest';
import {
  LAYOUT_PADRAO,
  chaveLayoutPainel,
  carregarLayoutPainel,
  salvarLayoutPainel,
  restaurarLayoutPainel,
} from './layoutPainel';

const fluxoValido = { i: 'fluxo', x: 0, y: 0, w: 8, h: 14, minW: 4, minH: 5 };
const entradasValido = { i: 'categorias-entradas', x: 8, y: 0, w: 4, h: 7, minW: 3, minH: 5 };
const despesasValido = { i: 'categorias-despesas', x: 8, y: 7, w: 4, h: 7, minW: 3, minH: 5 };

describe('layoutPainel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('gera chave de layout formatada por userId e tenantId', () => {
    expect(chaveLayoutPainel('u1', 't1')).toBe('finance-flow:painel-layout:u1:t1');
  });

  it('retorna LAYOUT_PADRAO quando não há nada no localStorage', () => {
    expect(carregarLayoutPainel('u1', 't1')).toEqual(LAYOUT_PADRAO);
  });

  it('salva e carrega layout personalizado corretamente', () => {
    const customLayout = [
      { i: 'fluxo', x: 1, y: 2, w: 8, h: 6 },
      { i: 'categorias-entradas', x: 8, y: 2, w: 4, h: 6 },
      { i: 'categorias-despesas', x: 8, y: 8, w: 4, h: 6 },
    ];
    salvarLayoutPainel('u1', 't1', customLayout);

    const carregado = carregarLayoutPainel('u1', 't1');
    expect(carregado[0].x).toBe(1);
    expect(carregado[0].y).toBe(2);
    expect(carregado[0].w).toBe(8);
    expect(carregado[0].h).toBe(6);
    expect(carregado[1].i).toBe('categorias-entradas');
    expect(carregado[1].x).toBe(8);
    expect(carregado[2].i).toBe('categorias-despesas');
  });

  it('isola layouts entre tenants diferentes', () => {
    salvarLayoutPainel('u1', 't1', [
      { i: 'fluxo', x: 1, y: 2, w: 8, h: 6 },
      { i: 'categorias-entradas', x: 8, y: 2, w: 4, h: 6 },
      { i: 'categorias-despesas', x: 8, y: 8, w: 4, h: 6 },
    ]);
    expect(carregarLayoutPainel('u1', 't2')).toEqual(LAYOUT_PADRAO);
  });

  it('retorna LAYOUT_PADRAO se o JSON for inválido', () => {
    localStorage.setItem(chaveLayoutPainel('u1', 't1'), '{inválido');
    expect(carregarLayoutPainel('u1', 't1')).toEqual(LAYOUT_PADRAO);
  });

  it.each([
    ['não é array', { not: 'an array' }],
    ['array vazio', []],
    ['apenas um widget', [fluxoValido]],
    ['apenas dois widgets', [fluxoValido, entradasValido]],
    ['widget a mais', [fluxoValido, entradasValido, despesasValido, { i: 'extra', x: 0, y: 14, w: 4, h: 5 }]],
    ['id ausente', [{ x: 0, y: 0, w: 8, h: 14 }, entradasValido, despesasValido]],
    ['id desconhecido', [{ i: 'outro', x: 0, y: 0, w: 8, h: 14 }, entradasValido, despesasValido]],
    ['id duplicado', [fluxoValido, entradasValido, { ...fluxoValido, y: 14 }]],
    ['coordenada negativa', [{ i: 'fluxo', x: -1, y: 0, w: 8, h: 14 }, entradasValido, despesasValido]],
    ['altura negativa', [{ i: 'fluxo', x: 0, y: 0, w: 8, h: -1 }, entradasValido, despesasValido]],
    ['largura zero', [{ i: 'fluxo', x: 0, y: 0, w: 0, h: 14 }, entradasValido, despesasValido]],
    ['altura zero', [{ i: 'fluxo', x: 0, y: 0, w: 8, h: 0 }, entradasValido, despesasValido]],
    ['largura abaixo do mínimo', [{ i: 'fluxo', x: 0, y: 0, w: 1, h: 14 }, entradasValido, despesasValido]],
    ['altura abaixo do mínimo', [{ i: 'fluxo', x: 0, y: 0, w: 8, h: 1 }, entradasValido, despesasValido]],
    ['largura e altura colapsadas', [{ i: 'fluxo', x: 0, y: 0, w: 1, h: 1 }, entradasValido, despesasValido]],
    ['overflow no desktop', [{ i: 'fluxo', x: 5, y: 0, w: 8, h: 14 }, entradasValido, despesasValido]],
    ['minW inválido', [{ i: 'fluxo', x: 0, y: 0, w: 8, h: 14, minW: 0 }, entradasValido, despesasValido]],
    ['minH inválido', [{ i: 'fluxo', x: 0, y: 0, w: 8, h: 14, minH: -1 }, entradasValido, despesasValido]],
    ['largura abaixo do mínimo específico do segundo widget', [fluxoValido, { i: 'categorias-entradas', x: 8, y: 0, w: 2, h: 7 }, despesasValido]],
  ])('retorna LAYOUT_PADRAO quando o layout é inválido: %s', (_, layoutInvalido) => {
    localStorage.setItem(chaveLayoutPainel('u1', 't1'), JSON.stringify(layoutInvalido));
    expect(carregarLayoutPainel('u1', 't1')).toEqual(LAYOUT_PADRAO);
  });

  it('restaura layout padrão removendo do localStorage e retornando LAYOUT_PADRAO', () => {
    salvarLayoutPainel('u1', 't1', [
      { i: 'fluxo', x: 1, y: 2, w: 8, h: 6 },
      { i: 'categorias-entradas', x: 8, y: 2, w: 4, h: 6 },
      { i: 'categorias-despesas', x: 8, y: 8, w: 4, h: 6 },
    ]);
    expect(restaurarLayoutPainel('u1', 't1')).toEqual(LAYOUT_PADRAO);
    expect(localStorage.getItem(chaveLayoutPainel('u1', 't1'))).toBeNull();
  });

  it('retorna cópias novas para os fallbacks de carregamento e restauração', () => {
    const fallbackCarregado = carregarLayoutPainel('u1', 't1');
    fallbackCarregado[0].x = 6;

    const fallbackRestaurado = restaurarLayoutPainel('u1', 't1');
    fallbackRestaurado[0].x = 4;

    expect(carregarLayoutPainel('u1', 't1')[0].x).toBe(0);
    expect(restaurarLayoutPainel('u1', 't1')[0].x).toBe(0);
  });

  it('mantém o fallback isolado de mutações no layout padrão exportado', () => {
    const posicaoOriginal = LAYOUT_PADRAO[0].x;

    try {
      LAYOUT_PADRAO[0].x = 6;

      expect(carregarLayoutPainel('u1', 't1')[0].x).toBe(0);
      expect(restaurarLayoutPainel('u1', 't1')[0].x).toBe(0);
    } finally {
      LAYOUT_PADRAO[0].x = posicaoOriginal;
    }
  });
});
