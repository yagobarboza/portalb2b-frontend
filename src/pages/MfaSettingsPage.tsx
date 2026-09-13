import MfaSection from '../components/MfaSection';

/**
 * Página autônoma de MFA (rota /mfa — uso legado/standalone).
 *
 * Mantida apenas como wrapper fino sobre MfaSection. A tela principal de
 * configurações do usuário é a ProfileSettingsPage (/perfil), que embute
 * a mesma MfaSection sem duplicar a lógica.
 */
export default function MfaSettingsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Segurança</h1>
        <p className="mt-1 text-muted-foreground">
          Autenticação em dois fatores (MFA) da sua conta.
        </p>
      </div>
      <MfaSection />
    </div>
  );
}