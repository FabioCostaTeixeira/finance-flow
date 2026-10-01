# Painel de Controle — bloco de entradas e saídas

## Objetivo

Criar a nova página inicial `/painel` e entregar o primeiro bloco do dashboard: um gráfico combinado de entradas e saídas. O painel deve crescer bloco por bloco, com layout personalizável por usuário.

## Acesso e navegação

- Adicionar “Painel de Controle” como primeiro item da navegação.
- Tornar `/painel` a página inicial após login e o destino da rota raiz.
- Reutilizar a permissão existente `fluxo-caixa`; não criar módulo, policy ou RPC.
- Preservar `/receitas` e demais páginas atuais.

## Layout personalizável

- Usar React Grid Layout para mover e redimensionar blocos.
- O botão “Editar layout” habilita arraste e redimensionamento.
- Fora do modo de edição, os blocos permanecem fixos e seus controles funcionam normalmente.
- Persistir o layout no `localStorage`, separado por usuário e tenant.
- Oferecer ação para restaurar o layout padrão.
- Em telas pequenas, empilhar blocos; manter o gráfico legível e impedir rolagem horizontal da página.

## Filtros globais

A barra no topo controla todos os blocos do painel:

- período;
- categoria;
- subcategoria;
- banco;
- status.

Subcategorias dependem das categorias selecionadas. Alterar categoria limpa subcategorias incompatíveis. Todos os filtros aceitam múltiplas seleções, exceto o período.

A visão semanal controla o período com setas para semana anterior e próxima. Cada semana começa na segunda-feira e termina no domingo, incluindo datas futuras.

A visão mensal usa intervalo livre. O gráfico divide o intervalo em grupos consecutivos de segunda a domingo, rotulados `Semana 01`, `Semana 02` etc. Cada grupo soma somente lançamentos cuja data efetiva cai no intervalo escolhido.

## Semântica financeira

Usar data efetiva:

- lançamento realizado: `data_pagamento`;
- lançamento pendente: `data_vencimento`;
- lançamento parcial: parcela paga na `data_pagamento` e saldo pendente na `data_vencimento`.

Usar `calcularSaldoLancamento` como regra central para separar realizado e pendente.

Sem banco filtrado, excluir transferências dos totais. Com um ou mais bancos filtrados, incluir transferências referentes aos bancos selecionados.

O filtro de status usa status computado, incluindo situações vencidas e atrasadas.

## Gráfico

- Entradas: uma linha azul `#2563EB`, 3 px, curva suave. A linha soma valores recebidos e a receber.
- Saídas: barras empilhadas vermelho-sangue `#8B0D16`.
- Parcela paga: vermelho sólido.
- Parcela a pagar: mesmo vermelho com transparência moderada.
- Eixo único em reais.
- Legenda sempre visível.
- Na visão semanal, eixo X mostra segunda a domingo com data.
- Na visão mensal, eixo X mostra `Semana 01`, `Semana 02` etc.
- Estados de carregamento, erro e ausência de dados devem ocupar o próprio bloco sem alterar seu tamanho.

## Tooltip

O hover sobre linha ou barra abre um tooltip unificado com:

- data ou semana;
- entradas;
- pago;
- a pagar;
- saldo atual;
- saldo previsto.

Cálculos do ponto selecionado:

- `saldo atual = entradas - pago`;
- `saldo previsto = entradas - pago - a pagar`.

Esses saldos representam somente o dia ou a semana selecionada, sem acumular períodos anteriores. O tooltip separa movimentos e saldos com divisor visual, alinha valores à direita e formata todos os valores em `R$`.

## Componentes e fluxo de dados

- `PainelControle`: estado de filtros, visão semanal/mensal, modo de edição e grade.
- `PainelFiltros`: filtros globais e dependência categoria/subcategoria.
- `GraficoEntradasSaidas`: bloco autossuficiente, navegação temporal, gráfico, legenda e tooltip.
- Hook do painel: carrega lançamentos do tenant através da infraestrutura existente.
- Utilitário puro de agregação: filtra lançamentos, aplica data efetiva e produz os pontos do gráfico.
- Hook de layout: lê, valida e grava o layout no `localStorage` por usuário e tenant.

A primeira versão agrega no cliente para reutilizar leitura e RLS existentes. Não haverá alteração de schema, policy ou RPC. Se volume futuro causar lentidão, uma RPC agregada tenant-scoped será tratada em trabalho separado.

## Testes

- Agregação diária e semanal.
- Semana sempre de segunda a domingo, inclusive datas futuras.
- Separação de valores pagos, pendentes e parciais.
- Exclusão condicional de transferências.
- Filtros de categoria, subcategoria, banco e status computado.
- Cálculos de saldo atual e previsto.
- Persistência e restauração do layout por usuário e tenant.
- Renderização dos estados carregando, erro, vazio e com dados.
- Interação do tooltip e alternância Semana/Mês.
- Proteção da rota com permissão `fluxo-caixa`.

## Fora do escopo

- Novos indicadores além deste primeiro bloco.
- Sincronização do layout entre navegadores ou usuários.
- Alterações em RLS, roles, migrations ou tipos Supabase.
- Saldos acumulados de períodos anteriores no tooltip.
