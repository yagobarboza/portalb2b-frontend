import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Construction, PackageCheck, Pencil } from 'lucide-react';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/format';
import type { CompanyPurchaseRules } from '../../types/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';

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
  const navigate = useNavigate();
  const [rules, setRules] = useState<CompanyPurchaseRules | null>(null);
  const [loadingRules, setLoadingRules] = useState(true);

  const loadRules = useCallback(async () => {
    setLoadingRules(true);
    try {
      const data = await api.get<CompanyPurchaseRules>('/companies/purchase-rules');
      setRules(data);
    } catch {
      // Sem acesso ou erro → mostra "sem regras" sem quebrar a página.
      setRules(null);
    } finally {
      setLoadingRules(false);
    }
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  const hasAnyRule = rules?.min_order_value != null || rules?.min_order_quantity != null;

  return (
    <div>
      <PageHeading
        title="Visão Geral"
        description="Acompanhe a operação da sua empresa em tempo real."
      />

      {/* ✅ Regras de Compra ativas */}
      <Card className="mb-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <PackageCheck className="h-4 w-4" />
              Regras de Compra
            </CardTitle>
            <CardDescription>
              {hasAnyRule
                ? 'Regras aplicadas aos pedidos dos seus clientes.'
                : 'Nenhuma regra de compra definida no momento.'}
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate('/empresa/regras')}>
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Editar regras
          </Button>
        </CardHeader>
        <CardContent>
          {loadingRules ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Valor mínimo */}
              <div className="rounded-md border p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Valor mínimo do pedido
                </p>
                <p className="mt-1 text-xl font-bold">
                  {rules?.min_order_value != null ? formatCurrency(rules.min_order_value) : '—'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {rules?.min_order_value != null
                    ? 'O total do carrinho deve atingir este valor.'
                    : 'Sem restrição de valor.'}
                </p>
              </div>
              {/* Quantidade mínima */}
              <div className="rounded-md border p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Quantidade mínima
                </p>
                <p className="mt-1 text-xl font-bold">
                  {rules?.min_order_quantity != null ? `${rules.min_order_quantity} un` : '—'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {rules?.min_order_quantity != null
                    ? 'A soma das quantidades dos itens deve atingir este número.'
                    : 'Sem restrição de quantidade.'}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Em breve */}
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