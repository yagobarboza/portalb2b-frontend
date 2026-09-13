import React, { createContext, useContext, useEffect, useCallback, useState } from 'react';
import type { MfaChallengeResponse, TokenResponse, UserInfo } from '../types/api';
import { api, SESSION_EXPIRED_EVENT, clearAuthCookiesClient } from '../lib/api';

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

// ✅ Resultado do login: pode exigir o segundo fator (MFA) ou concluir direto.
export type LoginResult =
  | { mfaRequired: true; challengeToken: string; email: string }
  | { mfaRequired: false; user: UserInfo };

interface AuthContextValue {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  permissions: string[];
  login: (email: string, password: string) => Promise<LoginResult>;
  verifyMfaLogin: (challengeToken: string, code: string) => Promise<UserInfo>;
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

  // ✅ Login em DOIS passos quando o usuário tem MFA ativo:
  // 1) POST /auth/login → se mfa_required, devolve o desafio (sem sessão);
  // 2) verifyMfaLogin valida o código e só então cria a sessão.
  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const res = await api.post<TokenResponse | MfaChallengeResponse>('/auth/login', { email, password });
    if ('mfa_required' in res && res.mfa_required) {
      return { mfaRequired: true, challengeToken: res.challenge_token, email: res.email };
    }
    const me = await api.get<UserInfo>('/auth/me');
    setUser(me);
    return { mfaRequired: false, user: me };
  }, []);

  // ✅ Segundo fator: valida o código TOTP (ou recovery code) e conclui o login.
  const verifyMfaLogin = useCallback(async (challengeToken: string, code: string): Promise<UserInfo> => {
    await api.post<TokenResponse>('/auth/mfa/verify-login', { challenge_token: challengeToken, code });
    const me = await api.get<UserInfo>('/auth/me');
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      // Revoga a sessão no backend (POST /auth/logout, idempotente).
      // A resposta traz Set-Cookie com Max-Age=0 → apaga os cookies HttpOnly.
      await api.post('/auth/logout');
    } catch {
      // Sem rede ou sessão já inválida: segue limpando o estado local.
    } finally {
      // ✅ Defesa extra: limpa cookies no cliente (best-effort), cobrindo
      // cenários onde o backend não respondeu a tempo.
      clearAuthCookiesClient();
      setUser(null);
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<void> => {
    // POST /auth/refresh (rotação do refresh token no cookie) → depois GET /auth/me
    await api.post<TokenResponse>('/auth/refresh');
    const me = await api.get<UserInfo>('/auth/me');
    setUser(me);
  }, []);

  const hasPermission = useCallback((permission: string): boolean => {
    return (user?.permissions ?? []).includes(permission);
  }, [user]);

  const value: AuthContextValue = {
    user,
    isAuthenticated: user !== null,
    isLoading,
    permissions: user?.permissions ?? [],
    login,
    verifyMfaLogin,
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