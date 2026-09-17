import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CreditCard, ExternalLink, Filter, Loader2, Receipt } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { Skeleton } from '../../components/ui/skeleton';
import { formatCurrency, formatDate } from '../../lib/format';
import { fetchBillingPaymentUrl, fetchMyBillingCharges } from '../../services/billing';
import type { BillingCharge, BillingStatus } from '../../types/api';
import { cn } from '../../lib/utils';

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<BillingStatus, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  overdue: 'Vencido',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
};

const STATUS_STYLE: Record<BillingStatus, string> = {
  pending: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
  refunded: 'bg-amber-100 text-amber-700',
};

const TYPE_LABEL: Record<string, string> = {
  mensalidade: 'Mensalidade',
  implantacao: 'Implantação',
  modulo: 'Módulo novo',
  custom: 'Customizada',
};

const BILLING_LABEL: Record<string, string> = {
  pix: 'PIX',
  boleto: 'Boleto',
  credit_card: 'Cartão',
};

export default function CompanyBillingPage() {
  const [charges, setCharges] = useState<BillingCharge[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [status, setStatus] = useState<BillingStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);

  const load = useCallback(async (pg: number, st: BillingStatus | 'all') => {
    setLoading(true);
    try {
      const data = await fetchMyBillingCharges({
        page: pg,
        page_size: PAGE_SIZE,
        status: st === 'all' ? undefined : st,
      });
      setCharges(data.items);
      setTotal(data.total);
      setPages(data.pages || 1);
    } catch {
      toast.error('Não foi possível carregar as cobranças.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page, status); }, [load, page, status]);

  const handlePay = async (charge: BillingCharge) => {
    if (payingId) return;
    setPayingId(charge.id);
    try {
      // Se já tem URL salva, usa direto; senão busca a atualizada.
      let url = charge.checkout_url;
      if (!url) {
        const res = await fetchBillingPaymentUrl(charge.id);
        url = res.checkout_url;
      }
      if (url) {
        // Abre a página de pagamento HOSPEDADA do Asaas (Fatura).
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('Não foi possível obter a página de pagamento.');
      }
    } catch {
      toast.error('Não foi possível obter a página de pagamento.');
    } finally {
      setPayingId(null);
    }
  };

  const canPay = (c: BillingCharge) => c.status === 'pending' || c.status === 'overdue';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pagamentos & Assinatura</h1>
          <p className="text-sm text-muted-foreground">
            Boletos, PIX e cobranças geradas para a sua empresa.
          </p>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em aberto</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {charges.filter((c) => c.status === 'pending' || c.status === 'overdue').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtro por status */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={status} onValueChange={(v) => { setStatus(v as BillingStatus | 'all'); setPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="overdue">Vencido</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
            <SelectItem value="refunded">Reembolsado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela de cobranças */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : charges.length === 0 ? (
            <div className="p-10 text-center">
              <Receipt className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <h3 className="text-sm font-semibold text-foreground">Nenhuma cobrança</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Quando o pessoal comercial criar cobranças para a sua empresa
                (mensalidade, implantação, módulos), elas aparecerão aqui
                para você pagar.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {charges.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{TYPE_LABEL[c.type] ?? c.type}</TableCell>
                    <TableCell>{formatCurrency(c.value)}</TableCell>
                    <TableCell>{formatDate(c.due_date)}</TableCell>
                    <TableCell>{BILLING_LABEL[c.billing_type] ?? c.billing_type}</TableCell>
                    <TableCell>
                      <Badge className={cn('font-medium', STATUS_STYLE[c.status])}>
                        {STATUS_LABEL[c.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canPay(c) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePay(c)}
                          disabled={payingId === c.id}
                        >
                          {payingId === c.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <ExternalLink className="mr-2 h-4 w-4" />
                          )}
                          Pagar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Paginação */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}