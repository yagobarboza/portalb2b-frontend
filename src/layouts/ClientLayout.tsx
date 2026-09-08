import { useState } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useBranding } from '../lib/useBranding';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import NotificationsBell from '../components/notifications/NotificationsBell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  ShoppingCart,
  Search,
  Zap,
  LogOut,
  User,
  Package,
  TicketIcon,
  MessageCircle,
  CreditCard,
  Store,
  ChevronDown,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ModeToggle } from '../components/mode-toggle';

const navLinks = [
  { label: 'Vitrine', href: '/loja', icon: Store },
  { label: 'Meus Pedidos', href: '/pedidos', icon: Package },
  { label: 'Tickets', href: '/tickets', icon: TicketIcon },
  { label: 'Chat', href: '/chat', icon: MessageCircle },
  { label: 'Financeiro', href: '/financeiro', icon: CreditCard },
];

export default function ClientLayout() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  // Branding do tenant (Bloco 2): logo/nome validados, cores injetadas com whitelist.
  const { branding, logoUrl } = useBranding();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  // Exibição defensiva: nunca assume nome preenchido (evita crash e dados vazios na UI).
  const displayName = user?.full_name?.trim() || 'Usuário';
  const userInitial = displayName.charAt(0).toUpperCase();
  const firstName = displayName.split(' ')[0];

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      // Revoga a sessão no backend (POST /auth/logout) e só então redireciona.
      await logout();
    } finally {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
          {/* Logo — branding real do tenant com fallback institucional nydB2B */}
          <div className="flex items-center gap-2 mr-4 flex-shrink-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={branding?.name ?? 'nydB2B'}
                className="h-8 w-8 rounded-lg object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary-foreground" />
              </div>
            )}
            <div className="hidden sm:block">
              <span className="font-bold text-base leading-none">{branding?.name ?? 'nydB2B'}</span>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Portal do Cliente</p>
            </div>
          </div>

          {/* Nav links - desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ label, href, icon: Icon }) => (
              <NavLink
                key={href}
                to={href}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex-1" />

          <ModeToggle />

          {/* Notificações (Bloco 10) */}
          <NotificationsBell />

          {/* Search */}
          <div className="relative hidden sm:block w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos..."
              className="pl-9 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Cart */}
          <Button
            variant="outline"
            size="icon"
            className="relative"
            onClick={() => navigate('/carrinho')}
          >
            <ShoppingCart className="w-5 h-5" />
            {count > 0 && (
              <Badge className="absolute -top-2 -right-2 w-5 h-5 p-0 flex items-center justify-center text-[10px] rounded-full">
                {count > 99 ? '99+' : count}
              </Badge>
            )}
          </Button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-3">
                <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-primary-foreground">{userInitial}</span>
                </div>
                <span className="hidden sm:inline text-sm font-medium">{firstName}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem disabled>
                <User className="w-4 h-4 mr-2" />
                {displayName}
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="text-muted-foreground text-xs">
                {user?.email}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                disabled={loggingOut}
                className="text-destructive"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {loggingOut ? 'Saindo…' : 'Sair'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Mobile Nav */}
      <div className="md:hidden flex items-center gap-1 px-4 py-2 border-b bg-background overflow-x-auto">
        {navLinks.map(({ label, href, icon: Icon }) => (
          <NavLink
            key={href}
            to={href}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )
            }
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </NavLink>
        ))}
      </div>

      {/* Content */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}