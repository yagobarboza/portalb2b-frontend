import { useState } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../lib/useBranding';
import { PERMISSIONS } from '../lib/constants';
import type { LucideIcon } from 'lucide-react';
import NotificationsBell from '../components/notifications/NotificationsBell';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarTrigger, SidebarInset,
} from '../components/ui/sidebar';
import { Separator } from '../components/ui/separator';
import { ModeToggle } from '../components/mode-toggle';
import {
  LayoutDashboard, Package, Users, ShoppingBag, UserCog, TicketIcon,
  MessageCircle, CreditCard, Zap, LogOut,
} from 'lucide-react';

// RBAC: cada rota exige uma permissão; sem ela, o item é ocultado.
// O backend SEMPRE revalida no endpoint (o front só esconde, nunca autoriza).
const menuItems: Array<{ label: string; href: string; icon: LucideIcon; exact?: boolean; permission?: string }> = [
  { label: 'Visão Geral', href: '/empresa', icon: LayoutDashboard, exact: true },
  { label: 'Catálogo', href: '/empresa/catalogo', icon: Package, permission: PERMISSIONS.PRODUCT_READ },
  { label: 'Clientes', href: '/empresa/clientes', icon: Users, permission: PERMISSIONS.CUSTOMER_READ },
  { label: 'Pedidos', href: '/empresa/pedidos', icon: ShoppingBag, permission: PERMISSIONS.ORDER_READ },
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

  // Filtra itens que o usuário não tem permissão de ver.
  const visibleItems = menuItems.filter(
    (item) => !item.permission || hasPermission(item.permission)
  );

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
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <div className="flex items-center gap-2 cursor-default">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={branding?.name ?? 'nydB2B'}
                      className="h-8 w-8 rounded-lg object-contain flex-shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                      <Zap className="w-5 h-5 text-primary-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-sm leading-none truncate">
                      {branding?.name ?? 'nydB2B'}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-none mt-1 truncate">
                      Painel da Empresa
                    </p>
                  </div>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Principal</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleItems.map(({ label, href, icon: Icon, exact }) => (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild tooltip={label}>
                      <NavLink
                        to={href}
                        end={exact}
                        className={({ isActive }) =>
                          isActive ? 'text-primary font-medium' : ''
                        }
                      >
                        <Icon />
                        <span>{label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">{userInitial}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-none truncate">{displayName}</p>
                    <p className="text-xs text-muted-foreground leading-none mt-1 truncate">
                      {user?.email}
                    </p>
                  </div>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleLogout}
                disabled={loggingOut}
                tooltip="Sair"
                className="text-destructive hover:text-destructive"
              >
                <LogOut />
                <span>{loggingOut ? 'Saindo…' : 'Sair'}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <div className="flex-1" />
          <NotificationsBell />
          <ModeToggle />
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}