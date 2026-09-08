import { Construction } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';

function PageHeading({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function DashboardPage() {
  return (
    <div>
      <PageHeading
        title="Visão Geral"
        description="Acompanhe a operação da sua empresa em tempo real."
      />
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Construction className="h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Em breve</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            O painel de indicadores da sua empresa está em construção.
            Em breve você verá aqui os dados reais de pedidos, clientes e receita.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Re-exports das demais páginas do painel da Empresa (arquivos separados) ──
export { default as CompanyOrdersPage } from './CompanyOrdersPage';
export { default as ClientsPage } from './ClientsPage';
export { default as TeamPage } from './TeamPage';
export { default as CompanyTicketsPage } from './CompanyTicketsPage';
export { default as CompanyChatPage } from './CompanyChatPage';