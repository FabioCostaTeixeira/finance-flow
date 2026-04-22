import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Tags,
  Landmark,
  Key,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Users,
  ArrowLeftRight,
  Menu,
  X,
  Send,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMyPermissions, hasModuleAccess, ROUTE_TO_MODULE } from '@/hooks/useUserPermissions';
import logo from '@/assets/logo.jpg';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const menuItems = [
  { path: '/insights', label: 'Insights IA', icon: Brain },
  { path: '/receitas', label: 'Receitas', icon: TrendingUp },
  { path: '/despesas', label: 'Despesas', icon: TrendingDown },
  { path: '/categorias', label: 'Categorias', icon: Tags },
  { path: '/bancos', label: 'Bancos', icon: Landmark },
  { path: '/fluxo-caixa', label: 'Fluxo de Caixa', icon: ArrowLeftRight },
  { path: '/api', label: 'API', icon: Key },
  { path: '/telegram', label: 'Bot Telegram', icon: Send },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, role, userName } = useAuth();
  const { data: permissions } = useMyPermissions();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const baseItems = role === 'master'
    ? [...menuItems, { path: '/ai-settings', label: 'Config. de IA', icon: Settings }, { path: '/usuarios', label: 'Usuários', icon: Users }]
    : menuItems;

  const allMenuItems = baseItems.filter(item => {
    const moduleKey = ROUTE_TO_MODULE[item.path];
    if (!moduleKey) return true;
    return hasModuleAccess(permissions || [], moduleKey, role);
  });

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-20 flex items-center px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Mary Personal" className="h-12 w-12 object-cover rounded-full" />
          <div className="flex flex-col">
            <span className="font-semibold text-foreground text-sm">Financeiro MarySysten</span>
            {userName && (
              <span className="text-xs text-muted-foreground">Bem Vindo {userName}</span>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto scrollbar-thin">
        {allMenuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={cn(
                'sidebar-item',
                isActive && 'sidebar-item-active'
              )}
            >
              <Icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-primary')} />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );
}

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();
  const { userName } = useAuth();

  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <button className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-sidebar border border-sidebar-border text-foreground">
            <Menu className="w-6 h-6" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-[260px] bg-sidebar border-sidebar-border">
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 260 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="h-screen bg-sidebar border-r border-sidebar-border flex flex-col sticky top-0"
    >
      {/* Logo */}
      <div className="h-20 flex items-center justify-between px-4 border-b border-sidebar-border">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex items-center gap-3"
            >
              <img src={logo} alt="Mary Personal" className="h-12 w-12 object-cover rounded-full" />
              <div className="flex flex-col">
                <span className="font-semibold text-foreground text-sm">Financeiro MarySysten</span>
                {userName && (
                  <span className="text-xs text-muted-foreground">Bem Vindo {userName}</span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {collapsed && (
          <img src={logo} alt="Mary Personal" className="h-10 w-10 object-cover rounded-full mx-auto" />
        )}
      </div>

      {/* Navigation */}
      <DesktopNav collapsed={collapsed} />

      {/* Footer with Logout and Collapse */}
      <div className="p-3 border-t border-sidebar-border space-y-2">
        <DesktopLogout collapsed={collapsed} />
        
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span>Recolher</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  );
}

function DesktopNav({ collapsed }: { collapsed: boolean }) {
  const location = useLocation();
  const { role } = useAuth();
  const { data: permissions } = useMyPermissions();

  const baseItems = role === 'master'
    ? [...menuItems, { path: '/ai-settings', label: 'Config. de IA', icon: Settings }, { path: '/usuarios', label: 'Usuários', icon: Users }]
    : menuItems;

  const allMenuItems = baseItems.filter(item => {
    const moduleKey = ROUTE_TO_MODULE[item.path];
    if (!moduleKey) return true;
    return hasModuleAccess(permissions || [], moduleKey, role);
  });

  return (
    <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto scrollbar-thin">
      {allMenuItems.map((item) => {
        const isActive = location.pathname === item.path;
        const Icon = item.icon;

        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={cn(
              'sidebar-item',
              isActive && 'sidebar-item-active'
            )}
          >
            <Icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-primary')} />
            <AnimatePresence mode="wait">
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="truncate"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
          </NavLink>
        );
      })}
    </nav>
  );
}

function DesktopLogout({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate();
  const { signOut, userName } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <button
      onClick={handleLogout}
      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
    >
      <LogOut className="w-5 h-5" />
      {!collapsed && <span>Sair</span>}
    </button>
  );
}
