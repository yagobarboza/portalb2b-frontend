import { Outlet, NavLink } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useBranding } from '../lib/useBranding';
import { useDocumentTitle } from '../lib/useDocumentTitle'; // ✅ título da aba
import { cn } from '../lib/utils';
import NotificationsBell from '../components/notifications/NotificationsBell';
import UserMenu from '../components/UserMenu'; // ✅ menu do usuário (avatar)
import { ModeToggle } from '../components/mode-toggle';
import {
  Package, ShoppingCart, TicketIcon, MessageCircle, CreditCard, Store, Zap,
} from 'lucide-react';

// ✅ Módulos do portal do cliente. Configurações do usuário (MFA) NÃO ficam
// aqui — são acessadas pelo menu do usuário (avatar) → /perfil.
const navLinks = [
  { label: 'Produtos', href: '/loja', icon: Store },
  { label: 'Meus Pedidos', href: '/pedidos', icon: Package },
  { label: 'Tickets', href: '/tickets', icon: TicketIcon },
  { label: 'Chat', href: '/chat', icon: MessageCircle },
  { label: 'Financeiro', href: '/financeiro', icon: CreditCard },
];

export default function ClientLayout() {
  // ✅ 'useAuth' saiu deste layout: login/logout agora vivem no UserMenu.
  const { count } = useCart();
  const { branding, logoUrl } = useBranding();

  // ✅ Título da aba: "Portal B2B - {Nome da empresa}"
  useDocumentTitle();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ── Header superior: logo + ações ── */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-20 max-w-7xl items-center gap-4 px-4">
          {/* Logo — PREENCHE TODA a altura do header (80px), bem evidente */}
          <div className="mr-4 flex flex-shrink-0 items-center self-stretch">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={branding?.name ?? 'nydB2B'}
                className="h-full w-auto max-w-40 object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-full w-20 items-center justify-center bg-primary">
                <Zap className="h-10 w-10 text-primary-foreground" />
              </div>
            )}
          </div>

          {/* Ações à direita */}
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
            {/* ✅ Menu do usuário (avatar) — acesso a /perfil e logout */}
            <UserMenu />
          </div>
        </div>
      </header>

      {/* ── Barra de NAVEGAÇÃO (quadrada, estilo e-commerce) ── */}
      <nav className="w-full border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-stretch overflow-x-auto px-4">
          {navLinks.map((link) => (
            <NavLink
              key={link.href}
              to={link.href}
              className={({ isActive }) =>
                cn(
                  'inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-muted hover:text-foreground',
                )
              }
            >
              <link.icon className="h-4 w-4" />
              <span>{link.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}