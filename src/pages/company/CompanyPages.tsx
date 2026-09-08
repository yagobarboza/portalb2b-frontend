import { toast } from 'sonner';
import { BarChart3, Package, Plus, Users } from 'lucide-react';
import { mockCustomers, mockOrders, customerName } from '../../data/mock';
import { formatCurrency, formatDate } from '../../lib/format';
import type { OrderStatus } from '../../types/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

// Todos os status de pedido (OrderStatus) com rótulo PT-BR.
const statusLabel: Record<OrderStatus, string> = {
  draft: 'Rascunho',
  submitted: 'Aguardando análise',
  received: 'Recebido',
  under_review: 'Em análise',
  awaiting_customer: 'Aguardando cliente',
  approved: 'Aprovado',
  processing: 'Em processamento',
  invoiced: 'Faturado',
  shipped: 'Enviado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

const statusClass: Record<OrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-amber-100 text-amber-800',
  received: 'bg-blue-100 text-blue-800',
  under_review: 'bg-blue-100 text-blue-800',
  awaiting_customer: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  processing: 'bg-indigo-100 text-indigo-800',
  invoiced: 'bg-violet-100 text-violet-800',
  shipped: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-teal-100 text-teal-800',
  cancelled: 'bg-red-100 text-red-800',
};

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
  const pending = mockOrders.filter((o) => o.status === 'submitted').length;
  const revenue = mockOrders.filter((o) => o.status !== 'cancelled').reduce((sum, o) => sum + o.total, 0);
  const kpis = [
    { label: 'Total de pedidos', value: mockOrders.length, icon: Package, tone: 'text-blue-600 bg-blue-100' },
    { label: 'Pedidos pendentes', value: pending, icon: BarChart3, tone: 'text-amber-600 bg-amber-100' },
    { label: 'Clientes ativos', value: mockCustomers.filter((c) => c.status === 'active').length, icon: Users, tone: 'text-emerald-600 bg-emerald-100' },
    { label: 'Receita acumulada', value: formatCurrency(revenue), icon: BarChart3, tone: 'text-violet-600 bg-violet-100' },
  ];
  return (
    <div>
      <PageHeading
        title="Visão Geral"
        description="Acompanhe a operação da sua empresa em tempo real."
        action={<Button onClick={() => toast.info('Ação rápida disponível no catálogo')}><Plus className="mr-2 h-4 w-4" />Nova ação</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`rounded-xl p-3 ${k.tone}`}><k.icon className="h-5 w-5" /></div>
              <div>
                <p className="text-sm text-muted-foreground">{k.label}</p>
                <p className="text-2xl font-bold">{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Pedidos por status</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(['submitted', 'approved', 'shipped', 'cancelled'] as OrderStatus[]).map((status) => {
                const count = mockOrders.filter((o) => o.status === status).length;
                return (
                  <div key={status}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{statusLabel[status]}</span>
                      <strong>{count}</strong>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className={`h-2 rounded-full ${status === 'submitted' ? 'bg-amber-500' : status === 'approved' ? 'bg-blue-500' : status === 'shipped' ? 'bg-emerald-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.max(8, (count / mockOrders.length) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Pedidos recentes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {mockOrders.slice(0, 5).map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-medium">#{o.id.replace('order-', '')} · {customerName(o.customer_id)}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(o.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(o.total)}</p>
                  <Badge className={statusClass[o.status]}>{statusLabel[o.status]}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Re-exports das demais páginas do painel da Empresa (arquivos separados) ──
export { default as CompanyOrdersPage } from './CompanyOrdersPage';
export { default as ClientsPage } from './ClientsPage';
export { default as TeamPage } from './TeamPage';
export { default as CompanyTicketsPage } from './CompanyTicketsPage';
export { default as CompanyChatPage } from './CompanyChatPage';