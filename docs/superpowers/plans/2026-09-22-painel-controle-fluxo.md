# Painel de Controle — Entradas e Saídas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar `/painel` como página inicial e entregar primeiro bloco móvel/redimensionável com filtros globais e gráfico de entradas e saídas.

**Architecture:** Página usa hooks existentes para ler lançamentos, categorias e bancos sob RLS atual. Funções puras filtram e agregam lançamentos por data efetiva em pontos diários ou semanais; componentes focados renderizam filtros, gráfico e tooltip. React Grid Layout gerencia posição e tamanho, persistidos no `localStorage` por usuário e tenant.

**Tech Stack:** React 18, TypeScript, Vite, TanStack Query, React Router, Recharts 2.15, shadcn/ui, date-fns 3.6, Vitest, Testing Library, React Grid Layout 1.5.2.

## Global Constraints

- Não alterar schema, migrations, RLS, roles ou módulo de permissão; `/painel` reutiliza `fluxo-caixa`.
- Não editar `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts` ou componentes genéricos em `src/components/ui/`.
- Preservar mudanças locais já existentes em `useLancamentos.ts`, páginas financeiras, testes RLS, Edge Function, `src/lib/saldo.ts` e migrations não rastreadas.
- Reutilizar `calcularSaldoLancamento`; não duplicar semântica de realizado/pendente.
- Linha de entradas: `#2563EB`, 3 px, curva suave.
- Barras de saídas: `#8B0D16`; pago sólido e a pagar com transparência moderada.
- Semana sempre começa segunda e termina domingo, inclusive no futuro.
- Filtros globais: período, categoria, subcategoria dependente, banco e status computado.
- Sem banco filtrado, excluir transferências. Com banco filtrado, incluir transferências dos bancos selecionados.
- Tooltip mostra valores do ponto, não saldo acumulado anterior.
- Não commitar sem pedido explícito do usuário. Etapas de commit abaixo são pontos sugeridos; nesta execução, pare antes delas.

## File Structure

### Criar

- `src/features/painel/types.ts` — contratos compartilhados de filtros, visão e pontos do gráfico.
- `src/features/painel/agregacaoFluxo.ts` — datas efetivas, filtros e agregação pura.
- `src/features/painel/agregacaoFluxo.test.ts` — testes da semântica financeira e temporal.
- `src/features/painel/layoutPainel.ts` — chave, validação e persistência do grid por usuário/tenant.
- `src/features/painel/layoutPainel.test.ts` — testes de isolamento, restauração e fallback.
- `src/features/painel/PainelFiltros.tsx` — barra global de filtros e dependência categoria/subcategoria.
- `src/features/painel/PainelFiltros.test.tsx` — testes de interação dos filtros.
- `src/features/painel/TooltipFluxo.tsx` — tooltip unificado com movimentos e saldos.
- `src/features/painel/GraficoEntradasSaidas.tsx` — bloco de negócio Recharts, navegação temporal e estados.
- `src/features/painel/GraficoEntradasSaidas.test.tsx` — testes de renderização e interação.
- `src/pages/PainelControle.tsx` — composição da página, grid editável e integração dos hooks.
- `src/pages/PainelControle.test.tsx` — testes de modo editar, persistência e restore.

### Modificar

- `package.json` — adicionar React Grid Layout e tipos.
- `package-lock.json` — travar dependências instaladas.
- `src/index.css` — importar CSS de `react-grid-layout` e `react-resizable`; estilizar resize handle no tema.
- `src/App.tsx` — lazy route `/painel`, proteção `fluxo-caixa` e redirects iniciais.
- `src/pages/Auth.tsx` — redirects pós-login para `/painel`.
- `src/components/AppSidebar.tsx` — primeiro item “Painel de Controle”.
- `src/hooks/useUserPermissions.ts` — mapear `/painel` para módulo existente `fluxo-caixa` sem criar novo módulo.
- `.gitignore` — ignorar `.superpowers/` criado pelo companion visual.

---

### Task 1: Dependência e utilitário de agregação

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/features/painel/types.ts`
- Create: `src/features/painel/agregacaoFluxo.ts`
- Create: `src/features/painel/agregacaoFluxo.test.ts`

**Interfaces:**
- Consumes: `LancamentoExtendido` de `@/hooks/useLancamentos`, `StatusLancamento` e `getComputedStatus` de `@/lib/statusUtils`, `calcularSaldoLancamento` de `@/lib/saldo`.
- Produces:
  - `type VisaoPainel = 'semana' | 'mes'`
  - `interface FiltrosPainel { inicio: Date; fim: Date; categoriaIds: string[]; subcategoriaIds: string[]; bancoIds: string[]; statusList: StatusLancamento[] }`
  - `interface PontoFluxo { chave: string; rotulo: string; rotuloCompleto: string; inicio: Date; fim: Date; entradas: number; pago: number; aPagar: number; saldoAtual: number; saldoPrevisto: number }`
  - `obterIntervaloSemana(data: Date): { inicio: Date; fim: Date }`
  - `moverSemana(data: Date, quantidade: number): Date`
  - `agruparFluxo(lancamentos, filtros, visao): PontoFluxo[]`

- [ ] **Step 1: Instalar dependência do grid**

Run:

```powershell
npm --prefix "C:\Users\2P CONNECT\Desktop\Finance_Flow_Supabase\finance-flow" install react-grid-layout@1.5.2 @types/react-grid-layout@1.3.5
```

Expected: `package.json` e `package-lock.json` incluem versões fixadas; instalação termina sem conflito de peers.

- [ ] **Step 2: Criar contratos compartilhados**

Criar `src/features/painel/types.ts`:

```ts
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
  entradas: number;
  pago: number;
  aPagar: number;
  saldoAtual: number;
  saldoPrevisto: number;
}
```

- [ ] **Step 3: Escrever testes falhando para semana e data efetiva**

Criar `src/features/painel/agregacaoFluxo.test.ts` com factories tipadas e estes casos mínimos:

```ts
import { describe, expect, it, vi } from 'vitest';
import { format } from 'date-fns';
import type { LancamentoExtendido } from '@/hooks/useLancamentos';
import type { FiltrosPainel } from './types';
import { agruparFluxo, obterIntervaloSemana } from './agregacaoFluxo';

const lancamento = (override: Partial<LancamentoExtendido>): LancamentoExtendido => ({
  id: crypto.randomUUID(),
  data_vencimento: '2026-09-24',
  cliente_credor: 'Teste',
  valor: 100,
  valor_pago: 0,
  banco_id: 'b1',
  status: 'a_receber',
  tipo: 'receita',
  categoria_id: 'sub1',
  recorrencia_id: null,
  parcela_atual: 1,
  total_parcelas: 1,
  observacao: null,
  data_pagamento: null,
  transferencia_vinculo_id: null,
  frequencia: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  categorias: { id: 'sub1', nome: 'Sub', categoria_pai_id: 'cat1' },
  bancos: { id: 'b1', nome: 'Banco 1' },
  ...override,
});

const filtros = (override: Partial<FiltrosPainel> = {}): FiltrosPainel => ({
  inicio: new Date(2026, 8, 21),
  fim: new Date(2026, 8, 27),
  categoriaIds: [],
  subcategoriaIds: [],
  bancoIds: [],
  statusList: [],
  ...override,
});

describe('agregação do painel', () => {
  it('normaliza qualquer dia para segunda a domingo', () => {
    const periodo = obterIntervaloSemana(new Date(2026, 8, 24));
    expect(format(periodo.inicio, 'yyyy-MM-dd')).toBe('2026-09-21');
    expect(format(periodo.fim, 'yyyy-MM-dd')).toBe('2026-09-27');
  });

  it('coloca realizado no pagamento e pendente no vencimento', () => {
    const pontos = agruparFluxo([
      lancamento({ tipo: 'receita', status: 'recebido', valor: 8420, valor_pago: 8420, data_pagamento: '2026-09-24', data_vencimento: '2026-09-28' }),
      lancamento({ tipo: 'despesa', status: 'pago', valor: 4160, valor_pago: 4160, data_pagamento: '2026-09-24' }),
      lancamento({ tipo: 'despesa', status: 'a_pagar', valor: 1280, data_vencimento: '2026-09-24' }),
    ], filtros(), 'semana');

    expect(pontos[3]).toMatchObject({
      entradas: 8420,
      pago: 4160,
      aPagar: 1280,
      saldoAtual: 4260,
      saldoPrevisto: 2980,
    });
  });

  it('divide lançamento parcial entre pagamento e vencimento', () => {
    const pontos = agruparFluxo([
      lancamento({ tipo: 'despesa', status: 'parcial', valor: 1000, valor_pago: 400, data_pagamento: '2026-09-22', data_vencimento: '2026-09-26' }),
    ], filtros(), 'semana');

    expect(pontos[1].pago).toBe(400);
    expect(pontos[5].aPagar).toBe(600);
  });
});
```

- [ ] **Step 4: Rodar testes e confirmar falha**

Run:

```powershell
npm --prefix "C:\Users\2P CONNECT\Desktop\Finance_Flow_Supabase\finance-flow" run test:unit -- --run src/features/painel/agregacaoFluxo.test.ts
```

Expected: FAIL porque `./agregacaoFluxo` não existe.

- [ ] **Step 5: Implementar período e agregação mínima**

Criar `src/features/painel/agregacaoFluxo.ts` usando `startOfWeek(..., { weekStartsOn: 1 })`, `endOfWeek`, `eachDayOfInterval`, `parseISO`, `startOfDay` e `endOfDay`. Regras por lançamento:

```ts
const { realizado, pendente } = calcularSaldoLancamento(lancamento);
const dataRealizado = lancamento.data_pagamento ? parseISO(lancamento.data_pagamento) : parseISO(lancamento.data_vencimento);
const dataPendente = parseISO(lancamento.data_vencimento);

if (lancamento.tipo === 'receita') {
  adicionar(dataRealizado, { entradas: realizado });
  adicionar(dataPendente, { entradas: pendente });
} else {
  adicionar(dataRealizado, { pago: realizado });
  adicionar(dataPendente, { aPagar: pendente });
}
```

Para cada ponto, finalizar:

```ts
ponto.saldoAtual = ponto.entradas - ponto.pago;
ponto.saldoPrevisto = ponto.entradas - ponto.pago - ponto.aPagar;
```

Na visão semanal, sempre gerar sete pontos, mesmo zerados, com `rotulo` em `EEE dd` e `rotuloCompleto` em `EEEE, dd/MM` usando `ptBR`.

- [ ] **Step 6: Rodar testes básicos**

Run igual Step 4.

Expected: 3 testes PASS.

- [ ] **Step 7: Acrescentar testes falhando para filtros e visão mensal**

Adicionar casos que provem:

```ts
it('consolida categoria pai, subcategoria, banco e status computado');
it('exclui transferências sem banco e inclui com banco selecionado');
it('gera Semana 01, Semana 02 e Semana 03 em intervalo livre');
it('mantém sete dias quando semana contém datas futuras');
```

Casos exatos:

- categoria `cat1` inclui lançamento cuja categoria é filha `sub1` com `categoria_pai_id: 'cat1'`;
- `subcategoriaIds: ['sub2']` exclui `sub1`;
- mockar relógio com `vi.setSystemTime(new Date(2026, 8, 24))` e comprovar que despesa `a_pagar` vencida em 23/09 atende filtro `atrasado`;
- transferência sem `bancoIds` não soma; com `bancoIds: ['b1']` soma;
- intervalo 21/09–11/10 produz três pontos rotulados `Semana 01`, `Semana 02`, `Semana 03`;
- semana 28/09–04/10 continua com sete pontos mesmo se últimos dias forem futuros.

- [ ] **Step 8: Implementar filtros e agrupamento semanal mensal**

Antes de adicionar parcelas aos buckets:

```ts
const status = getComputedStatus(lancamento);
const categoriaPaiId = lancamento.categorias?.categoria_pai_id;
const correspondeCategoria = filtros.categoriaIds.length === 0 ||
  filtros.categoriaIds.includes(lancamento.categoria_id ?? '') ||
  (categoriaPaiId ? filtros.categoriaIds.includes(categoriaPaiId) : false);
const correspondeSubcategoria = filtros.subcategoriaIds.length === 0 ||
  filtros.subcategoriaIds.includes(lancamento.categoria_id ?? '');
const correspondeBanco = filtros.bancoIds.length === 0 ||
  filtros.bancoIds.includes(lancamento.banco_id ?? '');
const correspondeStatus = filtros.statusList.length === 0 || filtros.statusList.includes(status);
const incluirTransferencia = !lancamento.transferencia_vinculo_id || filtros.bancoIds.length > 0;
```

Na visão mensal, criar buckets consecutivos com `startOfWeek(filtros.inicio, { weekStartsOn: 1 })` e avançar de sete em sete dias até `endOfWeek(filtros.fim, { weekStartsOn: 1 })`. Manter cada bucket segunda-domingo, mas descartar parcelas com data fora de `filtros.inicio..filtros.fim`.

- [ ] **Step 9: Rodar suíte do agregador**

Run igual Step 4.

Expected: todos testes de `agregacaoFluxo.test.ts` PASS.

- [ ] **Step 10: Ponto sugerido de commit**

```bash
git add package.json package-lock.json src/features/painel/types.ts src/features/painel/agregacaoFluxo.ts src/features/painel/agregacaoFluxo.test.ts
git commit -m "feat: add dashboard cash flow aggregation"
```

Não executar commit nesta sessão sem novo pedido explícito.

---

### Task 2: Persistência do layout

**Files:**
- Create: `src/features/painel/layoutPainel.ts`
- Create: `src/features/painel/layoutPainel.test.ts`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `Layout` de `react-grid-layout`.
- Produces:
  - `const LAYOUT_PADRAO: Layout[]`
  - `chaveLayoutPainel(userId: string, tenantId: string): string`
  - `carregarLayoutPainel(userId: string, tenantId: string): Layout[]`
  - `salvarLayoutPainel(userId: string, tenantId: string, layout: Layout[]): void`
  - `restaurarLayoutPainel(userId: string, tenantId: string): Layout[]`

- [ ] **Step 1: Escrever testes falhando**

Criar testes que validem:

```ts
expect(chaveLayoutPainel('u1', 't1')).toBe('finance-flow:painel-layout:u1:t1');
expect(carregarLayoutPainel('u1', 't1')).toEqual(LAYOUT_PADRAO);
salvarLayoutPainel('u1', 't1', [{ i: 'fluxo', x: 1, y: 2, w: 8, h: 6 }]);
expect(carregarLayoutPainel('u1', 't1')[0].x).toBe(1);
expect(carregarLayoutPainel('u1', 't2')).toEqual(LAYOUT_PADRAO);
localStorage.setItem(chaveLayoutPainel('u1', 't1'), '{inválido');
expect(carregarLayoutPainel('u1', 't1')).toEqual(LAYOUT_PADRAO);
expect(restaurarLayoutPainel('u1', 't1')).toEqual(LAYOUT_PADRAO);
```

- [ ] **Step 2: Rodar teste e confirmar falha**

```powershell
npm --prefix "C:\Users\2P CONNECT\Desktop\Finance_Flow_Supabase\finance-flow" run test:unit -- --run src/features/painel/layoutPainel.test.ts
```

Expected: FAIL porque módulo não existe.

- [ ] **Step 3: Implementar persistência validada**

Definir layout padrão com bloco `fluxo` em 12 colunas:

```ts
export const LAYOUT_PADRAO: Layout[] = [
  { i: 'fluxo', x: 0, y: 0, w: 8, h: 7, minW: 4, minH: 5 },
];
```

Aceitar do JSON somente array cujos itens tenham `i` string e `x`, `y`, `w`, `h` numéricos finitos. Em qualquer erro, retornar cópia de `LAYOUT_PADRAO`. `restaurarLayoutPainel` remove chave e retorna padrão.

- [ ] **Step 4: Importar estilos do grid**

No topo de `src/index.css`, antes das regras locais:

```css
@import 'react-grid-layout/css/styles.css';
@import 'react-resizable/css/styles.css';
```

Adicionar estilo temático:

```css
.react-grid-item > .react-resizable-handle::after {
  border-color: hsl(var(--primary));
}
.react-grid-item.react-grid-placeholder {
  background: hsl(var(--primary) / 0.12);
  border: 1px dashed hsl(var(--primary) / 0.65);
  border-radius: 0.75rem;
}
```

- [ ] **Step 5: Rodar testes**

Run igual Step 2.

Expected: todos PASS.

- [ ] **Step 6: Ponto sugerido de commit**

```bash
git add src/features/painel/layoutPainel.ts src/features/painel/layoutPainel.test.ts src/index.css
git commit -m "feat: persist dashboard layout per user"
```

Não executar commit nesta sessão sem novo pedido explícito.

---

### Task 3: Filtros globais

**Files:**
- Create: `src/features/painel/PainelFiltros.tsx`
- Create: `src/features/painel/PainelFiltros.test.tsx`

**Interfaces:**
- Consumes: `FiltrosPainel`, `Categoria[]`, `Banco[]`, `getStatusConfig`.
- Produces:

```ts
interface PainelFiltrosProps {
  filtros: FiltrosPainel;
  categorias: Categoria[];
  bancos: Banco[];
  onChange: (filtros: FiltrosPainel) => void;
}
```

- [ ] **Step 1: Escrever testes falhando**

Renderizar com uma categoria pai, duas filhas e dois bancos. Testar:

```ts
expect(screen.getByLabelText('Categoria')).toBeInTheDocument();
expect(screen.getByLabelText('Subcategoria')).toBeDisabled();
await user.click(screen.getByLabelText('Categoria'));
await user.click(screen.getByText('Moradia'));
expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ categoriaIds: ['cat1'], subcategoriaIds: [] }));
```

Re-renderizar com `categoriaIds: ['cat1']`, abrir subcategoria e confirmar que só filhas de `cat1` aparecem. Confirmar controles Banco e Status e seleção múltipla.

- [ ] **Step 2: Rodar teste e confirmar falha**

```powershell
npm --prefix "C:\Users\2P CONNECT\Desktop\Finance_Flow_Supabase\finance-flow" run test:unit -- --run src/features/painel/PainelFiltros.test.tsx
```

Expected: FAIL porque componente não existe.

- [ ] **Step 3: Implementar filtro multiselect local**

Não editar `components/ui`. Copiar somente padrão necessário de `LancamentosFilters` para componente privado `FiltroMultiplo` dentro de `PainelFiltros.tsx`, com botão `aria-label={label}`. Usar `Popover`, `Command`, `Checkbox` e `Button` já existentes.

Categorias pai:

```ts
const categoriasPai = categorias.filter((categoria) => !categoria.categoria_pai_id);
const subcategorias = categorias.filter(
  (categoria) => categoria.categoria_pai_id && filtros.categoriaIds.includes(categoria.categoria_pai_id),
);
```

Ao alterar categoria, preservar só subcategorias ainda pertencentes às categorias selecionadas:

```ts
const validas = new Set(categorias
  .filter((categoria) => categoria.categoria_pai_id && values.includes(categoria.categoria_pai_id))
  .map((categoria) => categoria.id));

onChange({
  ...filtros,
  categoriaIds: values,
  subcategoriaIds: filtros.subcategoriaIds.filter((id) => validas.has(id)),
});
```

Status disponíveis: `a_receber`, `recebido`, `a_pagar`, `pago`, `parcial`, `atrasado`, `vencida`, `transferencia`.

Período mostra dois calendários simples (`inicio` e `fim`) e impede `fim < inicio` ajustando fim para nova data inicial.

- [ ] **Step 4: Rodar testes**

Run igual Step 2.

Expected: todos PASS.

- [ ] **Step 5: Ponto sugerido de commit**

```bash
git add src/features/painel/PainelFiltros.tsx src/features/painel/PainelFiltros.test.tsx
git commit -m "feat: add global dashboard filters"
```

Não executar commit nesta sessão sem novo pedido explícito.

---

### Task 4: Gráfico e tooltip

**Files:**
- Create: `src/features/painel/TooltipFluxo.tsx`
- Create: `src/features/painel/GraficoEntradasSaidas.tsx`
- Create: `src/features/painel/GraficoEntradasSaidas.test.tsx`

**Interfaces:**
- Consumes: `PontoFluxo[]`, `VisaoPainel`, `formatCurrency`, componentes de `@/components/ui/chart` e Recharts.
- Produces:

```ts
interface GraficoEntradasSaidasProps {
  pontos: PontoFluxo[];
  visao: VisaoPainel;
  periodoLabel: string;
  isLoading: boolean;
  error: Error | null;
  onVisaoChange: (visao: VisaoPainel) => void;
  onSemanaAnterior: () => void;
  onProximaSemana: () => void;
}
```

- [ ] **Step 1: Escrever testes falhando**

Mockar `ResponsiveContainer` para renderizar children. Testar:

```ts
expect(screen.getByText('Entradas e saídas')).toBeInTheDocument();
expect(screen.getByText('Entradas')).toBeInTheDocument();
expect(screen.getByText('Saídas pagas')).toBeInTheDocument();
expect(screen.getByText('Saídas a pagar')).toBeInTheDocument();
await user.click(screen.getByRole('button', { name: 'Próxima semana' }));
expect(onProximaSemana).toHaveBeenCalledOnce();
await user.click(screen.getByRole('button', { name: 'Visão mensal' }));
expect(onVisaoChange).toHaveBeenCalledWith('mes');
```

Testar loading, erro e vazio com textos:

- `Carregando fluxo financeiro...`
- `Não foi possível carregar o fluxo financeiro.`
- `Nenhum lançamento encontrado para os filtros selecionados.`

Renderizar `TooltipFluxo` ativo com ponto exemplo e confirmar `R$ 8.420,00`, `R$ 4.160,00`, `R$ 1.280,00`, `R$ 4.260,00`, `R$ 2.980,00`.

- [ ] **Step 2: Rodar teste e confirmar falha**

```powershell
npm --prefix "C:\Users\2P CONNECT\Desktop\Finance_Flow_Supabase\finance-flow" run test:unit -- --run src/features/painel/GraficoEntradasSaidas.test.tsx
```

Expected: FAIL porque componentes não existem.

- [ ] **Step 3: Implementar tooltip harmonizado**

`TooltipFluxo` recebe shape compatível com Recharts:

```ts
interface TooltipFluxoProps {
  active?: boolean;
  payload?: Array<{ payload: PontoFluxo }>;
}
```

Renderizar cabeçalho `rotuloCompleto`, três linhas de movimentos, divisor, `Saldo atual` e `Saldo previsto`. Usar `formatCurrency`; valores em coluna direita com `tabular-nums`. Não usar cores de série no texto principal; usar pequenos indicadores coloridos ao lado dos rótulos.

- [ ] **Step 4: Implementar gráfico combinado**

Usar:

```tsx
<ComposedChart data={pontos} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
  <CartesianGrid vertical={false} strokeDasharray="3 3" />
  <XAxis dataKey="rotulo" tickLine={false} axisLine={false} />
  <YAxis tickFormatter={(value) => formatCurrency(Number(value))} width={88} tickLine={false} axisLine={false} />
  <ChartTooltip content={<TooltipFluxo />} cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeDasharray: '4 4' }} />
  <ChartLegend content={<ChartLegendContent />} />
  <Bar dataKey="pago" stackId="saidas" name="pago" fill="#8B0D16" radius={[0, 0, 4, 4]} />
  <Bar dataKey="aPagar" stackId="saidas" name="aPagar" fill="rgba(139, 13, 22, 0.38)" radius={[4, 4, 0, 0]} />
  <Line dataKey="entradas" name="entradas" type="monotone" stroke="#2563EB" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
</ComposedChart>
```

Config:

```ts
const chartConfig = {
  entradas: { label: 'Entradas', color: '#2563EB' },
  pago: { label: 'Saídas pagas', color: '#8B0D16' },
  aPagar: { label: 'Saídas a pagar', color: 'rgba(139, 13, 22, 0.38)' },
} satisfies ChartConfig;
```

Botões de visão devem ter `aria-pressed`. Setas aparecem somente em visão semanal.

- [ ] **Step 5: Rodar testes**

Run igual Step 2.

Expected: todos PASS.

- [ ] **Step 6: Ponto sugerido de commit**

```bash
git add src/features/painel/TooltipFluxo.tsx src/features/painel/GraficoEntradasSaidas.tsx src/features/painel/GraficoEntradasSaidas.test.tsx
git commit -m "feat: add income and expense dashboard chart"
```

Não executar commit nesta sessão sem novo pedido explícito.

---

### Task 5: Página e grid editável

**Files:**
- Create: `src/pages/PainelControle.tsx`
- Create: `src/pages/PainelControle.test.tsx`

**Interfaces:**
- Consumes: `useAuth().user`, `useTenant().activeTenant`, `useLancamentos`, `useCategorias`, `useBancos`, agregador, filtros, gráfico e persistência do grid.
- Produces: página default `PainelControle`.

- [ ] **Step 1: Escrever teste de página falhando**

Mockar hooks com tenant `t1`, user `u1`, lançamentos vazios, categorias e bancos. Mockar `react-grid-layout` para expor props:

```tsx
vi.mock('react-grid-layout', () => ({
  WidthProvider: (Component: React.ComponentType<Record<string, unknown>>) => Component,
  Responsive: ({ children, isDraggable, isResizable, onLayoutChange }: Record<string, unknown>) => (
    <div data-testid="grid" data-draggable={String(isDraggable)} data-resizable={String(isResizable)}>
      {children as React.ReactNode}
      <button onClick={() => (onLayoutChange as (layout: unknown[]) => void)([{ i: 'fluxo', x: 1, y: 0, w: 8, h: 7 }])}>simular layout</button>
    </div>
  ),
}));
```

Testar:

```ts
expect(screen.getByTestId('grid')).toHaveAttribute('data-draggable', 'false');
await user.click(screen.getByRole('button', { name: 'Editar layout' }));
expect(screen.getByTestId('grid')).toHaveAttribute('data-draggable', 'true');
expect(screen.getByTestId('grid')).toHaveAttribute('data-resizable', 'true');
await user.click(screen.getByText('simular layout'));
expect(localStorage.getItem('finance-flow:painel-layout:u1:t1')).toContain('"x":1');
await user.click(screen.getByRole('button', { name: 'Restaurar layout padrão' }));
expect(localStorage.getItem('finance-flow:painel-layout:u1:t1')).toBeNull();
```

- [ ] **Step 2: Rodar e confirmar falha**

```powershell
npm --prefix "C:\Users\2P CONNECT\Desktop\Finance_Flow_Supabase\finance-flow" run test:unit -- --run src/pages/PainelControle.test.tsx
```

Expected: FAIL porque página não existe.

- [ ] **Step 3: Implementar estado temporal e filtros**

Inicializar semana atual:

```ts
const semanaAtual = obterIntervaloSemana(new Date());
const [visao, setVisao] = useState<VisaoPainel>('semana');
const [filtros, setFiltros] = useState<FiltrosPainel>({
  inicio: semanaAtual.inicio,
  fim: semanaAtual.fim,
  categoriaIds: [],
  subcategoriaIds: [],
  bancoIds: [],
  statusList: [],
});
```

`irParaSemana(delta)` move início em `delta * 7` dias e recalcula segunda-domingo. Ao trocar para mensal, manter intervalo atual e exibir controles livres no filtro. Ao trocar de mensal para semanal, normalizar `filtros.inicio` para segunda-domingo.

- [ ] **Step 4: Implementar grid**

Usar `Responsive` com `WidthProvider`, `cols={{ lg: 12, md: 10, sm: 6, xs: 1, xxs: 1 }}`, `rowHeight={52}`, `isDraggable={editandoLayout}`, `isResizable={editandoLayout}` e `draggableHandle=".painel-drag-handle"`.

No mobile (`xs`, `xxs`), layout deve usar `x: 0`, `w: 1`; desktop usa layout persistido. Salvar somente mudança desktop para não sobrescrever preferência com layout mobile empilhado.

Cabeçalho inclui:

- título `Painel de Controle`;
- botão `Editar layout` / `Concluir edição`;
- botão `Restaurar layout padrão` visível durante edição.

Bloco inclui alça visível somente durante edição, com `aria-label="Arrastar bloco Entradas e saídas"`.

- [ ] **Step 5: Integrar dados e estados**

```ts
const lancamentosQuery = useLancamentos();
const categoriasQuery = useCategorias();
const bancosQuery = useBancos();
const pontos = useMemo(
  () => agruparFluxo(lancamentosQuery.data ?? [], filtros, visao),
  [lancamentosQuery.data, filtros, visao],
);
```

Passar `lancamentosQuery.isLoading`, `lancamentosQuery.error`, pontos e callbacks ao gráfico. Mostrar filtros mesmo se dados estiverem vazios.

- [ ] **Step 6: Rodar testes da página**

Run igual Step 2.

Expected: todos PASS.

- [ ] **Step 7: Ponto sugerido de commit**

```bash
git add src/pages/PainelControle.tsx src/pages/PainelControle.test.tsx
git commit -m "feat: add customizable dashboard page"
```

Não executar commit nesta sessão sem novo pedido explícito.

---

### Task 6: Rota, sidebar e página inicial

**Files:**
- Modify: `src/App.tsx:16-27, 77-100, 117-124`
- Modify: `src/pages/Auth.tsx:44-48, 108-114, 156-162`
- Modify: `src/components/AppSidebar.tsx:4-16, 26-33`
- Modify: `src/hooks/useUserPermissions.ts:18-28`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: página default `PainelControle`.
- Produces: rota `/painel`, item de menu e redirects iniciais.

- [ ] **Step 1: Adicionar rota lazy e proteção existente**

Em `App.tsx`:

```ts
const PainelControle = lazy(() => import('./pages/PainelControle'));
```

Adicionar:

```tsx
<Route path="/painel" element={
  <ProtectedLayout>
    <PermissionRoute moduleKey="fluxo-caixa"><PainelControle /></PermissionRoute>
  </ProtectedLayout>
} />
```

Alterar redirects autenticados `/auth` e `/` para `/painel`. Alterar fallbacks de `MasterRoute` e `PermissionRoute` para `/painel` somente quando isso não puder criar loop; para negação do próprio `/painel`, manter fallback `/receitas` para usuários sem `fluxo-caixa`.

Implementação segura em `PermissionRoute`:

```ts
const location = useLocation();
const fallback = location.pathname === '/painel' ? '/receitas' : '/painel';
if (!hasModule(moduleKey)) return <Navigate to={fallback} replace />;
```

- [ ] **Step 2: Alterar redirects de autenticação**

Substituir três `navigate('/receitas')` em `Auth.tsx` por `navigate('/painel')`.

- [ ] **Step 3: Adicionar menu e mapeamento de permissão**

Importar `LayoutDashboard` em `AppSidebar.tsx` e adicionar como primeiro item:

```ts
{ path: '/painel', label: 'Painel de Controle', icon: LayoutDashboard },
```

Em `ROUTE_TO_MODULE`, adicionar:

```ts
'/painel': 'fluxo-caixa',
```

Não adicionar item em `ALL_MODULES`.

- [ ] **Step 4: Ignorar arquivos do companion**

Adicionar a `.gitignore`:

```gitignore
# Mockups locais do brainstorming
.superpowers/
```

- [ ] **Step 5: Rodar testes direcionados e build**

```powershell
npm --prefix "C:\Users\2P CONNECT\Desktop\Finance_Flow_Supabase\finance-flow" run test:unit -- --run src/features/painel src/pages/PainelControle.test.tsx
npm --prefix "C:\Users\2P CONNECT\Desktop\Finance_Flow_Supabase\finance-flow" run build
```

Expected: testes PASS; build termina sem erros TypeScript/Vite.

- [ ] **Step 6: Ponto sugerido de commit**

```bash
git add src/App.tsx src/pages/Auth.tsx src/components/AppSidebar.tsx src/hooks/useUserPermissions.ts .gitignore
git commit -m "feat: make dashboard the authenticated home"
```

Não executar commit nesta sessão sem novo pedido explícito.

---

### Task 7: Validação no navegador e acessibilidade

**Files:**
- Modify as needed: `src/features/painel/PainelFiltros.tsx`
- Modify as needed: `src/features/painel/GraficoEntradasSaidas.tsx`
- Modify as needed: `src/features/painel/TooltipFluxo.tsx`
- Modify as needed: `src/pages/PainelControle.tsx`
- Modify corresponding tests for any behavior changed.

**Interfaces:**
- Consumes: app completo em `/painel`.
- Produces: feature validada visualmente em desktop e mobile.

- [ ] **Step 1: Iniciar servidor Vite na pasta correta**

```powershell
npm --prefix "C:\Users\2P CONNECT\Desktop\Finance_Flow_Supabase\finance-flow" run dev
```

Expected: Vite escolhe porta livre e imprime URL local HTTP 200.

- [ ] **Step 2: Testar golden path no navegador**

Usar `agent-browser` ou ferramenta de browser disponível:

1. autenticar com ambiente local existente;
2. confirmar redirect para `/painel`;
3. confirmar filtro global visível;
4. selecionar categoria e validar subcategorias dependentes;
5. navegar semana anterior e próxima, incluindo semana futura;
6. trocar para Mês e selecionar intervalo livre;
7. passar mouse sobre linha e cada segmento da barra;
8. confirmar tooltip com entradas, pago, a pagar, saldo atual e previsto;
9. ativar Editar layout, mover e redimensionar bloco;
10. concluir edição e confirmar bloco fixo;
11. recarregar página e confirmar layout persistido;
12. restaurar layout padrão.

- [ ] **Step 3: Validar bordas e responsividade**

Testar pelo menos 1440×900 e 390×844. Confirmar:

- sem rolagem horizontal da página;
- filtros quebram em linhas legíveis;
- gráfico mantém eixo e tooltip dentro do viewport;
- mobile empilha bloco;
- teclado alcança filtros, visão, setas, Editar e Restaurar;
- `prefers-reduced-motion` não causa animações essenciais.

Capturar screenshots e olhar cada uma. Corrigir colisões, cortes ou contraste insuficiente.

- [ ] **Step 4: Rodar validação final**

```powershell
npm --prefix "C:\Users\2P CONNECT\Desktop\Finance_Flow_Supabase\finance-flow" run test:unit -- --run
npm --prefix "C:\Users\2P CONNECT\Desktop\Finance_Flow_Supabase\finance-flow" run lint
npm --prefix "C:\Users\2P CONNECT\Desktop\Finance_Flow_Supabase\finance-flow" run build
git -C "C:\Users\2P CONNECT\Desktop\Finance_Flow_Supabase\finance-flow" diff --check
```

Expected:

- unitários PASS;
- lint sem novos erros da feature;
- build PASS;
- `git diff --check` sem saída.

Se lint falhar por erros preexistentes, registrar caminhos e confirmar que nenhum está nos arquivos novos/modificados da feature.

- [ ] **Step 5: Revisar diff sem tocar mudanças preexistentes**

```powershell
git -C "C:\Users\2P CONNECT\Desktop\Finance_Flow_Supabase\finance-flow" status --short
git -C "C:\Users\2P CONNECT\Desktop\Finance_Flow_Supabase\finance-flow" diff -- src/features/painel src/pages/PainelControle.tsx src/pages/PainelControle.test.tsx src/App.tsx src/pages/Auth.tsx src/components/AppSidebar.tsx src/hooks/useUserPermissions.ts src/index.css package.json package-lock.json .gitignore
```

Expected: somente mudanças planejadas da feature nesses caminhos. Não incluir `.env`, backups, migrations ou mudanças financeiras preexistentes.

- [ ] **Step 6: Ponto sugerido de commit final**

```bash
git add package.json package-lock.json .gitignore src/index.css src/features/painel src/pages/PainelControle.tsx src/pages/PainelControle.test.tsx src/App.tsx src/pages/Auth.tsx src/components/AppSidebar.tsx src/hooks/useUserPermissions.ts
git commit -m "feat: add customizable finance dashboard"
```

Não executar commit nesta sessão sem novo pedido explícito.
