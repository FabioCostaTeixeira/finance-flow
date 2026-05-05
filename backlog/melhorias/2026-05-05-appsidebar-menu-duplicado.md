---
titulo: Lógica de filtro de menu duplicada entre SidebarContent e DesktopNav
tipo: melhoria
prioridade: media
esforco: rapido
arquivo: src/components/AppSidebar.tsx:50-58,196-204
origem: auditoria
data: 2026-05-05
---

## Descrição

Em `AppSidebar.tsx` existem dois componentes independentes (`SidebarContent` para mobile e `DesktopNav` para desktop) que constroem a lista de itens visíveis de forma idêntica:

```ts
// SidebarContent (linha 50-58)
const baseItems = role === 'master'
  ? [...menuItems, { path: '/ai-settings', ... }, { path: '/usuarios', ... }]
  : menuItems;

const allMenuItems = baseItems.filter(item => {
  const moduleKey = ROUTE_TO_MODULE[item.path];
  if (!moduleKey) return true;
  return hasModuleAccess(permissions || [], moduleKey, role);
});

// DesktopNav (linha 196-204) — código IDÊNTICO
const baseItems = role === 'master'
  ? [...menuItems, { path: '/ai-settings', ... }, { path: '/usuarios', ... }]
  : menuItems;

const allMenuItems = baseItems.filter(item => {
  const moduleKey = ROUTE_TO_MODULE[item.path];
  if (!moduleKey) return true;
  return hasModuleAccess(permissions || [], moduleKey, role);
});
```

Qualquer adição de item de menu ou nova role exige editar em dois lugares.

## Como resolver

Extrair para uma função pura antes dos componentes:

```ts
function buildMenuItems(role: string | null, permissions: Permission[]) {
  const base = role === 'master'
    ? [...menuItems, { path: '/ai-settings', label: 'Config. de IA', icon: Settings }, { path: '/usuarios', label: 'Usuários', icon: Users }]
    : menuItems;

  return base.filter(item => {
    const moduleKey = ROUTE_TO_MODULE[item.path];
    if (!moduleKey) return true;
    return hasModuleAccess(permissions, moduleKey, role);
  });
}
```

E nos dois componentes substituir o bloco duplicado por:
```ts
const allMenuItems = buildMenuItems(role, permissions || []);
```
