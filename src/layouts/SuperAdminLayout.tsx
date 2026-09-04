import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Zap, Building2, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';
import { ModeToggle } from '../components/mode-toggle';

export default function SuperAdminLayout() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-rose-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-sm">nydB2B</span>
              <span className="ml-2 text-xs font-medium bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">Super Admin</span>
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

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium leading-none">{currentUser?.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{currentUser?.email}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} className="text-destructive border-destructive/30 hover:bg-destructive/5">
              <LogOut className="w-4 h-4 mr-1.5" />
              Sair
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
