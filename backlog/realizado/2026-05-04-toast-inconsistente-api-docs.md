---
titulo: ApiDocumentation.tsx usa sonner em vez do useToast padrão do projeto
tipo: melhoria
prioridade: media
esforco: rapido
arquivo: src/components/ApiDocumentation.tsx:7
origem: auditoria
data: 2026-05-04
---

## Descrição

`ApiDocumentation.tsx` importa `toast` de `'sonner'` diretamente, enquanto o restante do projeto usa `import { toast } from '@/hooks/use-toast'` (wrapper sobre Radix Toast via shadcn). As duas bibliotecas têm APIs similares mas podem renderizar toasts em posições e estilos diferentes, gerando inconsistência visual.

## Como resolver

Substituir na linha 7:
```tsx
// antes
import { toast } from 'sonner'

// depois
import { toast } from '@/hooks/use-toast'
```

Verificar se a chamada `toast({ title: '...', description: '...' })` é compatível com o wrapper local — o padrão shadcn aceita objeto com `title` e `description`.
