import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, roleDefaultPath } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { Building2, ShoppingCart, Shield, Zap } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = login(email, password);
      toast.success(`Bem-vindo, ${user.name}!`);
      navigate(roleDefaultPath(user.role));
    } catch (err: any) {
      toast.error(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    try {
      const user = login(demoEmail, demoPassword);
      toast.success(`Bem-vindo, ${user.name}!`);
      navigate(roleDefaultPath(user.role));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-900 via-blue-800 to-blue-600 text-white flex-col justify-between p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-500 rounded-full opacity-10 blur-3xl" />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-300 rounded-full opacity-10 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-400 rounded-full opacity-5 blur-3xl" />
        </div>

        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg">
              <Zap className="w-6 h-6 text-blue-800" />
            </div>
            <div>
              <span className="text-2xl font-bold tracking-tight">nydB2B</span>
              <p className="text-blue-200 text-xs">Plataforma de Vendas B2B</p>
            </div>
          </div>

          {/* Headline */}
          <div className="mt-16">
            <h1 className="text-4xl font-extrabold leading-tight mb-4">
              Sua plataforma<br />
              B2B completa
            </h1>
            <p className="text-blue-200 text-lg leading-relaxed max-w-sm">
              Gerencie seus pedidos, clientes e equipe em um único lugar com eficiência e simplicidade.
            </p>
          </div>

          {/* Feature highlights */}
          <div className="mt-12 space-y-4">
            {[
              { icon: ShoppingCart, text: 'Vitrine personalizada para seus clientes' },
              { icon: Building2, text: 'Gestão completa de pedidos e catálogo' },
              { icon: Shield, text: 'Segurança e controle de acesso por perfil' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-blue-100" />
                </div>
                <span className="text-blue-100 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-blue-300 text-xs">
          © 2025 nydB2B · Todos os direitos reservados
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold">nydB2B</span>
          </div>

          <div>
            <h2 className="text-3xl font-bold text-foreground">Entrar</h2>
            <p className="text-muted-foreground mt-1">Acesse sua conta para continuar</p>
          </div>

          {/* Demo Quick Access */}
          <Card className="border-dashed border-2 bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Acesso Rápido — Demo
              </CardTitle>
              <CardDescription className="text-xs">Clique para entrar instantaneamente</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-11 text-sm"
                onClick={() => quickLogin('cliente@techmax.com.br', '123456')}
              >
                <ShoppingCart className="w-4 h-4 text-blue-600" />
                <div className="text-left">
                  <div className="font-medium">Entrar como Cliente</div>
                  <div className="text-xs text-muted-foreground">João Silva · Comprador</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-11 text-sm"
                onClick={() => quickLogin('admin@techmax.com.br', '123456')}
              >
                <Building2 className="w-4 h-4 text-purple-600" />
                <div className="text-left">
                  <div className="font-medium">Entrar como Empresa</div>
                  <div className="text-xs text-muted-foreground">Maria Santos · Administrador</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-11 text-sm"
                onClick={() => quickLogin('super@nydb2b.com.br', '123456')}
              >
                <Shield className="w-4 h-4 text-rose-600" />
                <div className="text-left">
                  <div className="font-medium">Entrar como Super Admin</div>
                  <div className="text-xs text-muted-foreground">Pedro Costa · nydB2B</div>
                </div>
              </Button>
            </CardContent>
          </Card>

          <div className="flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-muted-foreground text-xs uppercase tracking-widest">ou entre com email</span>
            <Separator className="flex-1" />
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-11"
              />
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Problemas para acessar?{' '}
            <a href="#" className="text-primary hover:underline">
              Fale com o suporte
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
