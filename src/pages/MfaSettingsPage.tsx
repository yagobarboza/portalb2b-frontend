import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, ShieldCheck, ShieldOff } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { MfaSetupResponse } from '../types/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

/**
 * Gestão de MFA (autenticação de dois fatores).
 *
 * - MFA DESATIVADO: fluxo de ativação — gera secret + QR code + códigos de
 *   recuperação (POST /auth/mfa/setup) e confirma o código TOTP
 *   (POST /auth/mfa/verify).
 * - MFA ATIVADO: fluxo de desativação — exige senha atual OU código TOTP
 *   (POST /auth/mfa/disable).
 */
export default function MfaSettingsPage() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(user?.mfa_enabled ?? false);
  const [loading, setLoading] = useState(false);

  // Setup (ativar)
  const [setup, setSetup] = useState<MfaSetupResponse | null>(null);
  const [setupCode, setSetupCode] = useState('');
  const [setupError, setSetupError] = useState<string | null>(null);

  // Disable (desativar)
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [disableError, setDisableError] = useState<string | null>(null);

  // Sincroniza com o usuário autenticado.
  useEffect(() => {
    setEnabled(user?.mfa_enabled ?? false);
  }, [user?.mfa_enabled]);

  // ── ATIVAR ──────────────────────────────────────────────
  const handleSetup = useCallback(async () => {
    setLoading(true);
    setSetupError(null);
    try {
      const data = await api.post<MfaSetupResponse>('/auth/mfa/setup');
      setSetup(data);
      setSetupCode('');
    } catch (err) {
      setSetupError(err instanceof ApiError ? err.message : 'Erro ao iniciar a configuração.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleVerify = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setup || loading) return;
    const code = setupCode.trim();
    if (!code) { setSetupError('Informe o código de 6 dígitos.'); return; }
    setLoading(true);
    setSetupError(null);
    try {
      await api.post('/auth/mfa/verify', { secret: setup.secret, code });
      setEnabled(true);
      setSetup(null);
      setSetupCode('');
      toast.success('Autenticação em dois fatores ativada.');
    } catch (err) {
      setSetupError(err instanceof ApiError ? err.message : 'Código inválido.');
    } finally {
      setLoading(false);
    }
  }, [setup, setupCode, loading]);

  // ── DESATIVAR ───────────────────────────────────────────
  const handleDisable = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const password = disablePassword.trim();
    const code = disableCode.trim();
    if (!password && !code) {
      setDisableError('Informe a senha atual OU um código de verificação.');
      return;
    }
    setLoading(true);
    setDisableError(null);
    try {
      await api.post('/auth/mfa/disable', {
        password: password || null,
        code: code || null,
      });
      setEnabled(false);
      setDisablePassword('');
      setDisableCode('');
      toast.success('Autenticação em dois fatores desativada.');
    } catch (err) {
      setDisableError(err instanceof ApiError ? err.message : 'Não foi possível desativar.');
    } finally {
      setLoading(false);
    }
  }, [disablePassword, disableCode, loading]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Segurança</h1>
        <p className="mt-1 text-muted-foreground">
          Autenticação em dois fatores (MFA) da sua conta.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {enabled ? <ShieldCheck className="h-5 w-5 text-green-600" /> : <ShieldOff className="h-5 w-5 text-muted-foreground" />}
            Autenticação em dois fatores
          </CardTitle>
          <CardDescription>
            {enabled
              ? 'Ativa. Sua conta exige um código do app autenticador ao fazer login.'
              : 'Desativada. Recomendamos ativar para proteger sua conta.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!enabled && !setup && (
            <Button onClick={handleSetup} disabled={loading}>
              <KeyRound className="mr-2 h-4 w-4" />Ativar MFA
            </Button>
          )}

          {/* ── Fluxo de ativação ── */}
          {!enabled && setup && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 rounded-lg border p-4">
                {/* QR code (data URI) */}
                <img src={setup.qr_code} alt="QR code do app autenticador" className="h-44 w-44 rounded object-contain" />
                <p className="text-sm text-muted-foreground">
                  Escaneie com o Google Authenticator, Microsoft Authenticator ou similar.
                </p>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground">Secret (código manual)</p>
                <p className="mt-1 break-all font-mono text-sm">{setup.secret}</p>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Códigos de recuperação — guarde em local seguro (uso único)
                </p>
                <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-sm sm:grid-cols-4">
                  {setup.recovery_codes.map((c) => (
                    <span key={c} className="rounded bg-background px-1 py-0.5 text-center">{c}</span>
                  ))}
                </div>
              </div>

              <form onSubmit={handleVerify} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="mfa-setup-code">Código de verificação</Label>
                  <Input
                    id="mfa-setup-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    value={setupCode}
                    onChange={(e) => setSetupCode(e.target.value)}
                    disabled={loading}
                    className="h-11 text-center text-lg tracking-[0.3em]"
                  />
                </div>
                {setupError && <p role="alert" className="text-sm text-destructive">{setupError}</p>}
                <div className="flex gap-2">
                  <Button type="submit" disabled={loading}>{loading ? 'Confirmando…' : 'Confirmar e ativar'}</Button>
                  <Button type="button" variant="outline" onClick={() => setSetup(null)} disabled={loading}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* ── Fluxo de desativação ── */}
          {enabled && (
            <form onSubmit={handleDisable} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="mfa-disable-password">Senha atual</Label>
                  <Input
                    id="mfa-disable-password"
                    type="password"
                    autoComplete="current-password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    disabled={loading}
                    placeholder="ou informe o código ao lado"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mfa-disable-code">Código TOTP</Label>
                  <Input
                    id="mfa-disable-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value)}
                    disabled={loading}
                    placeholder="ou informe a senha ao lado"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Para desativar, informe a senha atual OU um código de verificação válido.
              </p>
              {disableError && <p role="alert" className="text-sm text-destructive">{disableError}</p>}
              <Button type="submit" variant="destructive" disabled={loading}>
                <ShieldOff className="mr-2 h-4 w-4" />Desativar MFA
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}