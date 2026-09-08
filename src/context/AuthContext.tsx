import React, { createContext, useContext, useEffect, useCallback, useState } from 'react';
import type { TokenResponse, UserInfo } from '../types/api';
import { api, SESSION_EXPIRED_EVENT } from '../lib/api';

export type UserProfile = 'cliente' | 'empresa' | 'superadmin';

/**
 * Deriva o perfil a partir das propriedades reais do UserInfo (nunca de role mock).
 * Aceita null/undefined com segurança: durante o boot (isLoading) o user ainda
 * não existe, e chamadas defensivas não devem derrubar a árvore do React.
 */
export function resolveProfile(user: UserInfo | null | undefined): UserProfile | null {
  if (!user) return null;
  if (user.is_super_admin) return 'superadmin';
  if (user.customer_id !== null) return 'cliente';
  if (user.tenant_id !== null) return 'empresa';
  return null;
}

interface AuthContextValue {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  permissions: string[];
  login: (email: string, password: string) => Promise<UserInfo>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Boot: restaura a sessão via cookie HttpOnly (GET /auth/me).
  // SEGURANÇA: nada é persistido em localStorage/sessionStorage.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const me = await api.get<UserInfo>('/auth/me');
        if (active) setUser(me);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // 401 global → limpa a sessão. Nunca expõe token/cookie.
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<UserInfo> => {
    // POST /auth/login (cookies HttpOnly definidos pelo backend) → depois GET /auth/me
    await api.post<TokenResponse>('/auth/login', { email, password });
    const me = await api.get<UserInfo>('/auth/me');
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      // Revoga a sessão no backend (POST /auth/logout, idempotente).
      await api.post('/auth/logout');
    } catch {
      // Sem rede ou sessão já inválida: segue limpando o estado local.
    } finally {
      setUser(null);
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<void> => {
    // POST /auth/refresh (rotação do refresh token no cookie) → depois GET /auth/me
    await api.post<TokenResponse>('/auth/refresh');
    const me = await api.get<UserInfo>('/auth/me');
    setUser(me);
  }, []);

  // RBAC (Bloco 5): espelha o require_permission do backend.
  // - is_super_admin === true → acesso total (retorna true para qualquer permissão).
  // - demais usuários → checagem estrita no array de permissões efetivas de /auth/me.
  // O backend SEMPRE revalida no endpoint; o front apenas esconde/desabilita UI.
  const hasPermission = useCallback(
    (permission: string) =>
      user?.is_super_admin === true || (user?.permissions.includes(permission) ?? false),
    [user]
  );

  const value: AuthContextValue = {
    user,
    isAuthenticated: user !== null,
    isLoading,
    permissions: user?.permissions ?? [],
    login,
    logout,
    refreshSession,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}