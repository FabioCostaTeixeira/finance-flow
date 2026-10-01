import type { Layout } from 'react-grid-layout';

const LAYOUT_PADRAO_FONTE: Layout[] = [
  { i: 'fluxo', x: 0, y: 0, w: 8, h: 14, minW: 4, minH: 5 },
  { i: 'categorias-entradas', x: 8, y: 0, w: 4, h: 7, minW: 3, minH: 5 },
  { i: 'categorias-despesas', x: 8, y: 7, w: 4, h: 7, minW: 3, minH: 5 },
];

const LIMITES_POR_ID = new Map(
  LAYOUT_PADRAO_FONTE.map((item) => [item.i, { minW: item.minW ?? 1, minH: item.minH ?? 1 }]),
);

export const LAYOUT_PADRAO: Layout[] = LAYOUT_PADRAO_FONTE.map((item) => ({ ...item }));

function criarLayoutPadrao(): Layout[] {
  return LAYOUT_PADRAO_FONTE.map((item) => ({ ...item }));
}

export function chaveLayoutPainel(userId: string, tenantId: string): string {
  return `finance-flow:painel-layout:${userId}:${tenantId}`;
}

export function isLayoutPainelValido(data: unknown): data is Layout[] {
  if (!Array.isArray(data) || data.length !== LAYOUT_PADRAO_FONTE.length) return false;

  const idsVistos = new Set<string>();

  return data.every((item) => {
    if (typeof item !== 'object' || item === null || typeof item.i !== 'string') return false;

    const limites = LIMITES_POR_ID.get(item.i);
    if (!limites || idsVistos.has(item.i)) return false;
    idsVistos.add(item.i);

    const { x, y, w, h, minW, minH } = item;
    return (
      Number.isFinite(x) && x >= 0 &&
      Number.isFinite(y) && y >= 0 &&
      Number.isFinite(w) && w >= limites.minW &&
      Number.isFinite(h) && h >= limites.minH &&
      x + w <= 12 &&
      (minW === undefined || (Number.isFinite(minW) && minW > 0)) &&
      (minH === undefined || (Number.isFinite(minH) && minH > 0))
    );
  });
}

export function carregarLayoutPainel(userId: string, tenantId: string): Layout[] {
  try {
    const chave = chaveLayoutPainel(userId, tenantId);
    const dados = localStorage.getItem(chave);
    if (!dados) return criarLayoutPadrao();

    const parsed = JSON.parse(dados);
    if (isLayoutPainelValido(parsed)) {
      return parsed;
    }
  } catch {
    // Retorna fallback padrão em qualquer erro de parsing ou armazenamento
  }
  return criarLayoutPadrao();
}

export function salvarLayoutPainel(userId: string, tenantId: string, layout: Layout[]): void {
  try {
    const chave = chaveLayoutPainel(userId, tenantId);
    localStorage.setItem(chave, JSON.stringify(layout));
  } catch {
    // Tratamento defensivo para erros de quota do localStorage ou ambiente sem acesso
  }
}

export function restaurarLayoutPainel(userId: string, tenantId: string): Layout[] {
  try {
    const chave = chaveLayoutPainel(userId, tenantId);
    localStorage.removeItem(chave);
  } catch {
    // Tratamento defensivo
  }
  return criarLayoutPadrao();
}
