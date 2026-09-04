import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '../components/ui/sidebar';
import { Separator } from '../components/ui/separator';
import { ModeToggle } from '../components/mode-toggle';
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingBag,
  UserCog,
  TicketIcon,
  MessageCircle,
  Zap,
  LogOut,
} from 'lucide-react';

const menuItems = [
  { label: 'Visão Geral', href: '/empresa', icon: LayoutDashboard, exact: true },
  { label: 'Catálogo', href: '/empresa/catalogo', icon: Package },
  { label: 'Clientes', href: '/empresa/clientes', icon: Users },
  { label: 'Pedidos', href: '/empresa/pedidos', icon: ShoppingBag },
  { label: 'Equipe', href: '/empresa/equipe', icon: UserCog },
  { label: 'Tickets', href: '/empresa/tickets', icon: TicketIcon },
  { label: 'Chat', href: '/empresa/chat', icon: MessageCircle },
];

export default function CompanyLayout() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <div className="flex items-center gap-2 cursor-default">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                    <Zap className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm leading-none truncate">TechMax</p>
                    <p className="text-[11px] text-muted-foreground leading-none mt-1 truncate">Distribuidora</p>
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
                {menuItems.map(({ label, href, icon: Icon, exact }) => (
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
                    <span className="text-sm font-bold text-primary">
                      {currentUser?.name.charAt(0)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-none truncate">{currentUser?.name}</p>
                    <p className="text-xs text-muted-foreground leading-none mt-1 truncate">{currentUser?.email}</p>
                  </div>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleLogout} tooltip="Sair" className="text-destructive hover:text-destructive">
                <LogOut />
                <span>Sair</span>
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
          <ModeToggle />
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
