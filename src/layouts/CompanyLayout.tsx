import { useState } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../lib/useBranding';
import { PERMISSIONS } from '../lib/constants';
import { cn } from '../lib/utils';
import NotificationsBell from '../components/notifications/NotificationsBell';
import { Button } from '../components/ui/button';
import { ModeToggle } from '../components/mode-toggle';
import {
  LayoutDashboard, Package, Users, ShoppingBag, UserCog, TicketIcon,
  MessageCircle, CreditCard, Zap, LogOut, FolderTree, BadgePercent,
} from 'lucide-react';

const menuItems = [
  { label: 'Visão Geral', href: '/empresa', icon: LayoutDashboard, exact: true },
  { label: 'Catálogo', href: '/empresa/catalogo', icon: Package },
  { label: 'Categorias', href: '/empresa/categorias', icon: FolderTree, permission: PERMISSIONS.CATALOG_MANAGE },
  { label: 'Preços Especiais', href: '/empresa/precos', icon: BadgePercent, permission: PERMISSIONS.CATALOG_MANAGE },
  { label: 'Clientes', href: '/empresa/clientes', icon: Users },
  { label: 'Pedidos', href: '/empresa/pedidos', icon: ShoppingBag },
  { label: 'Equipe', href: '/empresa/equipe', icon: UserCog, permission: PERMISSIONS.USER_READ },
  { label: 'Tickets', href: '/empresa/tickets', icon: TicketIcon, permission: PERMISSIONS.TICKET_READ },
  { label: 'Chat', href: '/empresa/chat', icon: MessageCircle, permission: PERMISSIONS.CHAT_READ },
  { label: 'Financeiro', href: '/empresa/financeiro', icon: CreditCard, permission: PERMISSIONS.FINANCIAL_READ },
];

export default function CompanyLayout() {
  const { user, logout, hasPermission } = useAuth();
  const { branding, logoUrl } = useBranding();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const displayName = user?.full_name?.trim() || 'Usuário';
  const userInitial = displayName.charAt(0).toUpperCase();
  const visibleItems = menuItems.filter((item) => !item.permission || hasPermission(item.permission));

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header topo (logo + nome + ações) */}
      <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur">
        {/* Logo da empresa (cadastrada pelo Super Admin) no canto superior esquerdo (40px) */}
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt={branding?.name ?? 'nydB2B'} className="h-10 w-10 rounded-lg object-contain" referrerPolicy="no-referrer" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Zap className="h-6 w-6 text-primary-foreground" />
            </div>
          )}
          <span className="hidden text-sm font-bold sm:block">{branding?.name ?? 'nydB2B'}</span>
        </div>

        <nav className="ml-4 hidden flex-1 items-center gap-1 overflow-x-auto md:flex">
          {visibleItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.exact}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <NotificationsBell />
          <ModeToggle />
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {userInitial}
            </div>
            <span className="hidden text-sm font-medium lg:block">{displayName}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} disabled={loggingOut} aria-label="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}