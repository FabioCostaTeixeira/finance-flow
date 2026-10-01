export interface IdentidadeBanco {
  marca: string;
  className: string;
  logoUrl?: string;
}

const IDENTIDADES_BANCOS: [RegExp, IdentidadeBanco][] = [
  [/\bita[uú]\b/i, { marca: 'Itaú', className: 'bg-[#ec7000] text-white' }],
  [/\bbradesco\b/i, { marca: 'Bradesco', className: 'bg-[#cc092f] text-white' }],
  [/\bsantander\b/i, { marca: 'Santander', className: 'bg-[#ec0000] text-white', logoUrl: '/bancos/santander.png' }],
  [/\bbanco\s+do\s+brasil\b|\bbb\b/i, { marca: 'BB', className: 'bg-[#f8d117] text-[#004f9f]' }],
  [/\bcaixa\b/i, { marca: 'CAIXA', className: 'bg-[#005ca9] text-white' }],
  [/\bnubank\b|\bnu\b/i, { marca: 'nu', className: 'bg-[#820ad1] text-white' }],
  [/\binter\b/i, { marca: 'Inter', className: 'bg-[#ff7a00] text-white' }],
  [/\b(stone|d[ií]zimo|d[ií]zimos)\b/i, { marca: 'Stone', className: 'bg-[#00a868] text-white' }],
  [/\buber\b/i, { marca: 'Uber', className: 'bg-black text-white border border-white/20' }],
  [/\bc6\b/i, { marca: 'C6', className: 'bg-foreground text-background' }],
  [/\bmercado\s*pago\b/i, { marca: 'MP', className: 'bg-[#009ee3] text-white' }],
];

export function obterIdentidadeBanco(nome: string): IdentidadeBanco | null {
  return IDENTIDADES_BANCOS.find(([padrao]) => padrao.test(nome))?.[1] ?? null;
}

export function obterIniciaisBanco(nome: string): string {
  const palavras = nome
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return palavras
    .slice(0, 2)
    .map((palavra) => palavra[0]?.toUpperCase())
    .join('') || 'B';
}
