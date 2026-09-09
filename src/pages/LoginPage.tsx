import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { defaultPathForUser } from '../lib/constants';
import { api, ApiError } from '../lib/api';
import { safeLogoUrl } from '../lib/branding';
import type { CompanyBranding } from '../types/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const RATE_LIMIT_LOCK_MS = 60_000;

/** Marca institucional NYD (usada quando não há logo da empresa no domínio). */
function NydMark() {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold tracking-tight text-foreground">nydB2B</p>
      <p className="mt-1 text-xs text-muted-foreground">Portal do Cliente</p>
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, user, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [lockSeconds, setLockSeconds] = useState(0);
  const timerRef = useRef<number | null>(null);

  // Branding público resolvido pelo DOMÍNIO de acesso (pré-login).
  // - Domínio customizado cadastrado → logo/nome da empresa.
  // - Sem domínio / empresa sem logo → marca NYD (fallback).
  const [branding, setBranding] = useState<CompanyBranding | null>(null);

  // Se já autenticado, redireciona para a rota do perfil (evita tela duplicada).
  useEffect(() => {
    if (isAuthenticated && user) navigate(defaultPathForUser(user), { replace: true });
  }, [isAuthenticated, user, navigate]);

  // Resolve branding pelo domínio (endpoint público /companies/by-domain/{domain}).
  useEffect(() => {
    let active = true;
    const host = window.location.hostname;
    // Só consulta domínios reais; em dev (localhost) cai direto na marca NYD.
    if (!host || host === 'localhost' || host === '127.0.0.1') return;
    (async () => {
      try {
        const data = await api.get<CompanyBranding>(
          `/companies/by-domain/${encodeURIComponent(host)}`
        );
        if (active) setBranding(data);
      } catch {
        // Domínio não cadastrado → branding fica null → marca NYD.
      }
    })();
    return () => { active = false; };
  }, []);

  const companyLogo = safeLogoUrl(branding); // URL validada ou null
  const companyName = branding?.name?.trim();

  // Countdown do bloqueio de 429.
  useEffect(() => {
    if (lockUntil === null) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
      setLockSeconds(remaining);
      if (remaining <= 0) setLockUntil(null);
    };
    tick();
    timerRef.current = window.setInterval(tick, 1000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [lockUntil]);

  const isLocked = lockUntil !== null && Date.now() < lockUntil;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || isLocked) return;
    setLoading(true);
    setError(null);
    try {
      const authed = await login(email.trim(), password);
      toast.success(`Bem-vindo, ${authed.full_name}!`);
      navigate(defaultPathForUser(authed), { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setLockUntil(Date.now() + RATE_LIMIT_LOCK_MS);
        setError('Muitas tentativas de login. Aguarde antes de tentar novamente.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Erro ao fazer login. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      {/* Decoração de fundo suave (layout profissional) */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo dinâmica: empresa (domínio cadastrado) ou NYD */}
        <div className="mb-6 flex flex-col items-center text-center">
          {companyLogo ? (
            <img
              src={companyLogo}
              alt={companyName ?? 'Empresa'}
              className="h-14 max-w-[240px] object-contain"
              referrerPolicy="no-referrer"
            />
          ) : (
            <NydMark />
          )}
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-lg shadow-black/5 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Acesse sua conta
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {companyName
              ? `Entre com suas credenciais no portal de ${companyName}.`
              : 'Entre com suas credenciais institucionais.'}
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || isLocked}
                className="h-11 rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || isLocked}
                className="h-11 rounded-lg"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="h-11 w-full rounded-lg text-base font-semibold"
              disabled={loading || isLocked}
            >
              {isLocked
                ? `Aguarde ${lockSeconds}s`
                : loading
                  ? 'Entrando…'
                  : 'Entrar'}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Ambiente seguro · nydB2B
        </p>
      </div>
    </div>
  );
}