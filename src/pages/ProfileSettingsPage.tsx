import { UserCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import MfaSection from '../components/MfaSection';

/**
 * Configurações do perfil do usuário LOGADO.
 *
 * Aqui ficam configurações pessoais da conta (ex.: MFA). Não é um módulo
 * do portal — é acessado pelo menu do usuário (avatar), como em qualquer
 * sistema SaaS.
 */
export default function ProfileSettingsPage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Configurações</h1>
        <p className="mt-1 text-muted-foreground">
          Gerencie as configurações da sua conta.
        </p>
      </div>

      {/* ── Perfil (informações básicas) ── */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle2 className="h-5 w-5 text-muted-foreground" />
            Perfil
          </CardTitle>
          <CardDescription>Suas informações de conta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Nome</p>
            <p className="text-sm font-medium">{user?.full_name}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">E-mail</p>
            <p className="text-sm font-medium">{user?.email}</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Segurança (MFA) — componente reutilizável ── */}
      <MfaSection />
    </div>
  );
}