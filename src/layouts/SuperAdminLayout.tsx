import { useState } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../lib/useBranding';
import { useDocumentTitle } from '../lib/useDocumentTitle'; // ✅ título da aba
import { Button } from '../components/ui/button';
import NotificationsBell from '../components/notifications/NotificationsBell';
import { Zap, Building2, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';
import { ModeToggle } from '../components/mode-toggle';

export default function SuperAdminLayout() {
  const { user, logout } = useAuth();
  // Área global: branding opcional (fallback institucional nydB2B quando ausente).
  const { branding, logoUrl } = useBranding();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  // ✅ Título da aba: "Portal B2B" (sem empresa — branding costuma ser ausente aqui)
  useDocumentTitle();

  const displayName = user?.full_name?.trim() || 'Administrador';

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      // Revoga a sessão no backend antes de redirecionar.
      await logout();
    } finally {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          <div className="flex items-center gap-2">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={branding?.name ?? 'nydB2B'}
                className="w-8 h-8 rounded-lg object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 bg-rose-600 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
            )}
            <div>
              <span className="font-bold text-sm">{branding?.name ?? 'nydB2B'}</span>
              <span className="ml-2 text-xs font-medium bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
                Super Admin
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-1 ml-6">
            <NavLink
              to="/superadmin"
              end
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )
              }
            >
              <Building2 className="w-4 h-4" />
              Empresas
            </NavLink>
          </nav>

          <div className="flex-1" />

          <ModeToggle />

          {/* Notificações (Bloco 10) */}
          <NotificationsBell />

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium leading-none">{displayName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-destructive border-destructive/30 hover:bg-destructive/5"
            >
              <LogOut className="w-4 h-4 mr-1.5" />
              {loggingOut ? 'Saindo…' : 'Sair'}
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}