import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, resolveProfile, type UserProfile } from '../context/AuthContext';

interface ProtectedRouteProps {
  profiles?: UserProfile[];
  requiredPermission?: string;
}

export default function ProtectedRoute({ profiles, requiredPermission }: ProtectedRouteProps) {
  const { user, isLoading, hasPermission } = useAuth();
  const location = useLocation();

  // Evita "flash" de redirecionamento enquanto a sessão é restaurada via /auth/me.
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Carregando…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const profile = resolveProfile(user);

  // Perfil não permitido nesta área → redireciona para a rota correta do usuário.
  if (profiles && profile && !profiles.includes(profile)) {
    if (profile === 'superadmin') return <Navigate to="/superadmin" replace />;
    if (profile === 'cliente') return <Navigate to="/loja" replace />;
    if (profile === 'empresa') return <Navigate to="/empresa" replace />;
  }

  // RBAC: permissão exigida ausente → redireciona (o backend SEMPRE revalida).
  if (requiredPermission && !hasPermission(requiredPermission)) {
    const home = profile === 'cliente' ? '/loja' : profile === 'empresa' ? '/empresa' : '/superadmin';
    return <Navigate to={home} replace />;
  }

  return <Outlet />;
}