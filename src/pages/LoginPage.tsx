import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { defaultPathForUser } from '../lib/constants';
import { api, ApiError } from '../lib/api';
import { safeLogoUrl } from '../lib/branding';
import type { CompanyBranding } from '../types/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const RATE_LIMIT_LOCK_MS = 60_000; // 60s de bloqueio após 429

/** Estado do desafio MFA (segundo fator pendente após senha correta). */
interface MfaChallenge {
  challengeToken: string;
  email: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, verifyMfaLogin, user, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [lockSeconds, setLockSeconds] = useState(0);
  const timerRef = useRef<number | null>(null);

  // ✅ Passo MFA (segundo fator)
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallenge | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);

  // Branding público resolvido pelo DOMÍNIO de acesso (pré-login).
  const [branding, setBranding] = useState<CompanyBranding | null>(null);

  // Se já autenticado, redireciona para a rota do perfil (evita tela duplicada).
  useEffect(() => {
    if (isAuthenticated && user) navigate(defaultPathForUser(user), { replace: true });
  }, [isAuthenticated, user, navigate]);

  // Resolve branding pelo domínio (endpoint público /companies/by-domain/{domain}).
  useEffect(() => {
    let active = true;
    const host = window.location.hostname;
    if (!host || host === 'localhost' || host === '127.0.0.1') return;
    (async () => {
      try {
        const data = await api.get<CompanyBranding>(`/companies/by-domain/${encodeURIComponent(host)}`);
        if (active) setBranding(data);
      } catch {
        // Domínio não cadastrado → branding fica null → marca NYD.
      }
    })();
    return () => { active = false; };
  }, []);

  const companyLogo = safeLogoUrl(branding);
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
      const result = await login(email.trim(), password);
      // ✅ MFA ativo: mostra o passo do código (segundo fator).
      if (result.mfaRequired) {
        setMfaChallenge({ challengeToken: result.challengeToken, email: result.email });
        setMfaCode('');
        setMfaError(null);
        return;
      }
      toast.success(`Bem-vindo, ${result.user.full_name}!`);
      navigate(defaultPathForUser(result.user), { replace: true });
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

  // ✅ Valida o segundo fator (código TOTP ou recovery code) e conclui o login.
  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaChallenge || mfaLoading) return;
    const code = mfaCode.trim();
    if (!code) { setMfaError('Informe o código de verificação.'); return; }
    setMfaLoading(true);
    setMfaError(null);
    try {
      const authed = await verifyMfaLogin(mfaChallenge.challengeToken, code);
      toast.success(`Bem-vindo, ${authed.full_name}!`);
      navigate(defaultPathForUser(authed), { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setMfaError('Muitas tentativas. Aguarde antes de tentar novamente.');
      } else {
        setMfaError(err instanceof ApiError ? err.message : 'Código inválido. Tente novamente.');
      }
    } finally {
      setMfaLoading(false);
    }
  };

  // Voltar do passo MFA para o formulário de login.
  const backToLogin = () => {
    setMfaChallenge(null);
    setMfaCode('');
    setMfaError(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          {companyLogo ? (
            <img src={companyLogo} alt={companyName ?? 'Logo'} className="h-14 w-14 rounded-lg object-contain" referrerPolicy="no-referrer" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="h-7 w-7" />
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {companyName ?? 'Portal B2B'}
          </h1>
        </div>

        {mfaChallenge ? (
          /* ✅ Passo MFA — segundo fator */
          <form onSubmit={handleMfaVerify} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="mfa-code">Código de verificação</Label>
              <Input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                placeholder="000000"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                disabled={mfaLoading}
                className="h-11 rounded-lg text-center text-lg tracking-[0.3em]"
              />
              <p className="text-xs text-muted-foreground">
                Digite o código de 6 dígitos do seu app autenticador (ou um código de recuperação).
              </p>
            </div>

            {mfaError && <p role="alert" className="text-sm text-destructive">{mfaError}</p>}

            <Button type="submit" disabled={mfaLoading} className="w-full h-11">
              {mfaLoading ? 'Verificando…' : 'Entrar'}
            </Button>

            <Button type="button" variant="ghost" className="w-full" onClick={backToLogin} disabled={mfaLoading}>
              <ArrowLeft className="mr-2 h-4 w-4" />Voltar
            </Button>
          </form>
        ) : (
          /* Formulário de login (email + senha) */
          <form onSubmit={handleLogin} className="space-y-4" noValidate>
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

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {isLocked && (
              <p className="text-sm text-destructive">
                Aguarde {lockSeconds}s antes de tentar novamente.
              </p>
            )}

            <Button type="submit" disabled={loading || isLocked} className="w-full h-11">
              {loading ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}