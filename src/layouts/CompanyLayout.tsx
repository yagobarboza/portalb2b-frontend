import { useState } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../lib/useBranding';
import { useDocumentTitle } from '../lib/useDocumentTitle'; // ✅ título da aba
import { PERMISSIONS } from '../lib/constants';
import { cn } from '../lib/utils';
import NotificationsBell from '../components/notifications/NotificationsBell';
import { Button } from '../components/ui/button';
import { ModeToggle } from '../components/mode-toggle';
import {
  LayoutDashboard, Package, Users, ShoppingBag, UserCog, TicketIcon,
  MessageCircle, CreditCard, Zap, LogOut, FolderTree, BadgePercent, Percent,
  Menu, X,
} from 'lucide-react';

const menuItems = [
  { label: 'Visão Geral', href: '/empresa', icon: LayoutDashboard, exact: true },
  { label: 'Catálogo', href: '/empresa/catalogo', icon: Package },
  { label: 'Categorias', href: '/empresa/categorias', icon: FolderTree, permission: PERMISSIONS.CATALOG_MANAGE },
  { label: 'Preços Especiais', href: '/empresa/precos', icon: BadgePercent, permission: PERMISSIONS.CATALOG_MANAGE },
  { label: 'Descontos', href: '/empresa/descontos', icon: Percent, permission: PERMISSIONS.CATALOG_MANAGE },
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
  const [sidebarOpen, setSidebarOpen] = useState(false); // ✅ drawer mobile

  // ✅ Título da aba: "Portal B2B - {Nome da empresa}"
  useDocumentTitle();

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

  // ✅ Navegação vertical (reutilizada na sidebar desktop e no drawer mobile)
  const navContent = (
    <nav className="flex flex-col gap-1 p-3">
      {visibleItems.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          end={item.exact}
          onClick={() => setSidebarOpen(false)}
          className={({ isActive }) =>
            cn(
              'inline-flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )
          }
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );

  // ✅ Bloco da marca (logo ou fallback) — reutilizado
  const brand = (
    <div className="flex items-center gap-2">
      {logoUrl ? (
        <img src={logoUrl} alt={branding?.name ?? 'nydB2B'} className="h-9 w-9 rounded-lg object-contain" referrerPolicy="no-referrer" />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Zap className="h-5 w-5 text-primary-foreground" />
        </div>
      )}
      <span className="truncate text-sm font-bold">{branding?.name ?? 'nydB2B'}</span>
    </div>
  );

  // ✅ Rodapé da sidebar (usuário + sair) — reutilizado
  const userFooter = (
    <div className="flex items-center gap-2 border-t p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {userInitial}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{displayName}</p>
      </div>
      <Button variant="ghost" size="icon" onClick={handleLogout} disabled={loggingOut} aria-label="Sair">
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* ── Sidebar DESKTOP (fixa, sem scroll horizontal) ── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r bg-background md:flex">
        <div className="flex h-16 items-center border-b px-4">{brand}</div>
        <div className="flex-1 overflow-y-auto">{navContent}</div>
        {userFooter}
      </aside>

      {/* ── Drawer MOBILE (hambúrguer) ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r bg-background shadow-lg">
            <div className="flex h-16 items-center justify-between border-b px-4">
              {brand}
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">{navContent}</div>
            {userFooter}
          </aside>
        </div>
      )}

      {/* ── Área principal ── */}
      <div className="md:pl-60">
        {/* Header topo: só marca (mobile) + notificações + tema + usuário */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 md:hidden">{brand}</div>
          <div className="ml-auto flex items-center gap-2">
            <NotificationsBell />
            <ModeToggle />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {userInitial}
              </div>
              <span className="hidden text-sm font-medium lg:block">{displayName}</span>
            </div>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={handleLogout} disabled={loggingOut} aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}