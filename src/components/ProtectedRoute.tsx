import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../types';

interface ProtectedRouteProps {
  allowedRoles?: Role[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    // Redirect to their correct home
    if (currentUser.role === 'cliente') return <Navigate to="/loja" replace />;
    if (currentUser.role === 'admin') return <Navigate to="/empresa" replace />;
    if (currentUser.role === 'superadmin') return <Navigate to="/superadmin" replace />;
  }

  return <Outlet />;
}
