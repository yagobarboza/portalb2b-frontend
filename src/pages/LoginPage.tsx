import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { defaultPathForUser } from '../lib/constants';
import { ApiError } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';

const RATE_LIMIT_LOCK_MS = 60000; // bloqueio de interface por 60s em caso de 429

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

  // Se já autenticado, redireciona para a rota do perfil (evita tela de login duplicada).
  useEffect(() => {
    if (isAuthenticated && user) navigate(defaultPathForUser(user), { replace: true });
  }, [isAuthenticated, user, navigate]);

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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Acessar nydB2B</CardTitle>
          <CardDescription>Entre com suas credenciais institucionais.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || isLocked}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || isLocked}
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading || isLocked}>
              {isLocked
                ? `Aguarde ${lockSeconds}s`
                : loading
                  ? 'Entrando…'
                  : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}