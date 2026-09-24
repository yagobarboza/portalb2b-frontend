import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { defaultPathForUser } from '../lib/constants';
import { ApiError } from '../lib/api';
import { usePublicBranding } from '../lib/usePublicBranding';
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

/** Site da desenvolvedora (link no rodapé). */
const NYD_SITE = 'https://nydsoftwares.com.br';

/**
 * Cor primária do tenant. Sem domínio cadastrado (padrão) usa
 * um preto suave — a página padrão é da nydSoftwares.
 */
function resolvePrimary(branding: CompanyBranding | null): string {
  return branding?.primary_color?.trim() || '#1A1A1A';
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

  // Branding público resolvido pelo DOMÍNIO de acesso (pré-login), incluindo
  // título e favicon específicos do tenant.
  const { branding, logoUrl: companyLogo } = usePublicBranding();

  // ✅ TEMA LIGHT FORÇADO APENAS NO LOGIN.
  // O shadcn/ui controla o tema pela classe `dark` no <html>. Este efeito
  // remove a classe ao montar (garante light nesta página) e RESTAURA o
  // tema do usuário ao desmontar — sem afetar o resto do sistema.
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    root.classList.remove('dark'); // força light
    return () => {
      if (wasDark) root.classList.add('dark'); // restaura o tema do usuário
    };
  }, []);

  // Se já autenticado, redireciona para a rota do perfil (evita tela duplicada).
  useEffect(() => {
    if (isAuthenticated && user) navigate(defaultPathForUser(user), { replace: true });
  }, [isAuthenticated, user, navigate]);

  const companyName = branding?.name?.trim();
  const primaryColor = resolvePrimary(branding);

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
    <div className="flex min-h-screen">
      {/* ── Painel de marca (esquerda) — cores do tenant (ou preto padrão), oculto no mobile ── */}
      <div
        className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 text-white lg:flex"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="relative z-10">
          {companyLogo ? (
            /* Logo white-label em destaque, sem distorcer nem recortar. */
            <img
              src={companyLogo}
              alt={companyName ?? 'Logo'}
              className="h-40 w-full max-w-md object-contain object-left"
              referrerPolicy="no-referrer"
            />
          ) : (
            /* ✅ Padrão (sem domínio): logo da nyd MAIOR, em branco sobre o preto */
            <img
              src="/svg-logo-nydsoftwares.svg"
              alt="nydSoftwares"
              className="h-16 w-16 object-contain brightness-0 invert"
            />
          )}
        </div>

        <div className="relative z-10 max-w-md">
          <h2 className="text-4xl font-bold leading-tight tracking-tight">
            {companyName ?? 'Portal B2B'}
          </h2>
          <p className="mt-4 text-lg text-white/80">
            A plataforma completa para o seu comércio B2B — catálogo, pedidos,
            financeiro e atendimento em um só lugar.
          </p>
          <div className="mt-8 flex items-center gap-2 text-sm text-white/70">
            <Sparkles className="h-4 w-4" />
            <span>Seguro, rápido e feito para crescer com você.</span>
          </div>
        </div>

        {/* Atribuição — "nydSoftwares" clicável → site da NYD */}
        <div className="relative z-10 flex items-center gap-2 text-xs text-white/70">
          <img
            src="/svg-logo-nydsoftwares.svg"
            alt="nydSoftwares"
            className="h-14 w-14 object-contain brightness-0 invert"
          />
          <span>
            Desenvolvido por{' '}
            <a
              href={NYD_SITE}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-white underline-offset-2 hover:underline"
            >
              nydSoftwares
            </a>
          </span>
        </div>
      </div>

      {/* ── Painel do formulário (direita) ── */}
      <div className="flex w-full flex-col items-center justify-center px-4 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* Marca no topo (mobile) — logo da empresa OU nydSoftwares */}
          <div className="mb-8 flex flex-col items-center gap-3">
            {companyLogo ? (
              /* Logo white-label ampla também em telas menores. */
              <img
                src={companyLogo}
                alt={companyName ?? 'Logo'}
                className="h-32 w-full max-w-xs object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              /* ✅ Padrão: logo da nyd MAIOR no topo */
              <img
                src="/logo-nydsoftwares-preto.png"
                alt="nydSoftwares"
                className="h-20 w-20 rounded-lg object-contain"
              />
            )}
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {companyName ?? 'Portal B2B'}
            </h1>
            <p className="text-sm text-muted-foreground">
              Acesse sua conta para continuar
            </p>
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

              <Button
                type="submit"
                disabled={mfaLoading}
                className="h-11 w-full"
                style={{ backgroundColor: primaryColor }}
              >
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

              <Button
                type="submit"
                disabled={loading || isLocked}
                className="h-11 w-full"
                style={{ backgroundColor: primaryColor }}
              >
                {loading ? 'Entrando…' : 'Entrar'}
              </Button>
            </form>
          )}

          {/* Atribuição sutil — sempre visível (desktop e mobile) */}
          <div className="mt-10 flex items-center justify-center gap-2 text-xs text-muted-foreground/70">
            <img
              src="/svg-logo-nydsoftwares.svg"
              alt="nydSoftwares"
              className="h-3.5 w-3.5 object-contain"
            />
            <span>
              Desenvolvido por{' '}
              <a
                href={NYD_SITE}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground/80 underline-offset-2 hover:underline"
              >
                nydSoftwares
              </a>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
