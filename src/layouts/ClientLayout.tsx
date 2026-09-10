import { useState } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useBranding } from '../lib/useBranding';
import { useDocumentTitle } from '../lib/useDocumentTitle'; // ✅ título da aba
import { cn } from '../lib/utils';
import NotificationsBell from '../components/notifications/NotificationsBell';
import { Button } from '../components/ui/button';
import { ModeToggle } from '../components/mode-toggle';
import {
  Package, ShoppingCart, TicketIcon, MessageCircle, CreditCard, Store, Zap, LogOut,
} from 'lucide-react';

const navLinks = [
  { label: 'Vitrine', href: '/loja', icon: Store },
  { label: 'Meus Pedidos', href: '/pedidos', icon: Package },
  { label: 'Tickets', href: '/tickets', icon: TicketIcon },
  { label: 'Chat', href: '/chat', icon: MessageCircle },
  { label: 'Financeiro', href: '/financeiro', icon: CreditCard },
];

export default function ClientLayout() {
  // ✅ FIX: 'user' removido — não era usado (só 'logout')
  const { logout } = useAuth();
  const { count } = useCart();
  const { branding, logoUrl } = useBranding();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  // ✅ Título da aba: "Portal B2B - {Nome da empresa}"
  useDocumentTitle();

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
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          {/* Logo — branding real do tenant com fallback institucional (40px) */}
          <div className="mr-4 flex flex-shrink-0 items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt={branding?.name ?? 'nydB2B'} className="h-10 w-10 rounded-lg object-contain" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <Zap className="h-6 w-6 text-primary-foreground" />
              </div>
            )}
            <div className="hidden sm:block">
              <span className="block text-base font-bold leading-none">{branding?.name ?? 'nydB2B'}</span>
              <p className="mt-0.5 text-[10px] leading-none text-muted-foreground">Portal do Cliente</p>
            </div>
          </div>

          {/* Navegação principal */}
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {navLinks.map((link) => (
              <NavLink
                key={link.href}
                to={link.href}
                className={({ isActive }) =>
                  cn(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                }
              >
                <link.icon className="h-4 w-4" />
                <span className="hidden md:inline">{link.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Ações */}
          <div className="ml-auto flex items-center gap-2">
            <NavLink
              to="/carrinho"
              className={({ isActive }) =>
                cn(
                  'relative inline-flex items-center justify-center rounded-md p-2 transition-colors',
                  isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
              aria-label="Carrinho"
            >
              <ShoppingCart className="h-5 w-5" />
              {/* Badge = nº de PRODUTOS no carrinho (não unidades) */}
              {count > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                  {count}
                </span>
              )}
            </NavLink>
            <NotificationsBell />
            <ModeToggle />
            <Button variant="ghost" size="icon" onClick={handleLogout} disabled={loggingOut} aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}