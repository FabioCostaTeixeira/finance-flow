# Backlog — Finance Flow

Rastreamento de correções, melhorias e ideias do projeto. Cada item é um arquivo `.md` em uma das colunas abaixo.

## Colunas

| Pasta | Descrição |
|---|---|
| `ideias/` | Sugestões e explorações sem compromisso de execução |
| `correcoes/` | Bugs, falhas de segurança e violações de padrão a corrigir |
| `melhorias/` | Qualidade, refatorações e boas práticas a implementar |
| `fazendo/` | Itens em progresso ativamente |
| `realizado/` | Itens concluídos |
| `bloqueado/` | Itens que dependem de uma ação futura ou decisão externa |

## Frontmatter padrão

Cada item deve ter o seguinte cabeçalho:

```yaml
---
titulo: Título descritivo
tipo: correcao | melhoria | ideia
prioridade: alta | media | baixa
esforco: rapido | medio | grande
arquivo: src/caminho/para/arquivo.ts:linha   # opcional
origem: auditoria | manual
data: YYYY-MM-DD
---
```

## Mover entre colunas

Mova o arquivo `.md` para a pasta correspondente à nova coluna. Para itens bloqueados, adicione ao final:

```markdown
## Bloqueio

Aguardando: descrição do que está bloqueando.
```
