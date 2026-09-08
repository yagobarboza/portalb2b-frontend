import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
} from '../../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Skeleton } from '../../components/ui/skeleton';
import { Loader2, Eye, ArrowLeft, ArrowRight } from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/format';
import { fetchFinancialAccounts, fetchFinancialAccountDetail } from '../../services/financial';
import type { FinancialAccount, FinancialAccountDetail, FinancialAccountStatus } from '../../types/api';
import { cn } from '../../lib/utils';

const STATUS_META: Record<FinancialAccountStatus, { label: string; className: string }> = {
  open: { label: 'Em aberto', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  paid: { label: 'Pago', className: 'bg-green-100 text-green-800 border-green-200' },
  overdue: { label: 'Vencido', className: 'bg-red-100 text-red-800 border-red-200' },
};

const TABS: Array<{ key: FinancialAccountStatus; label: string }> = [
  { key: 'open', label: 'Em aberto' },
  { key: 'paid', label: 'Pagas' },
  { key: 'overdue', label: 'Vencidas' },
];

const PAGE_SIZE = 20;

export default function CompanyFinancialPage() {
  const [tab, setTab] = useState<FinancialAccountStatus>('open');
  const [items, setItems] = useState<FinancialAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<FinancialAccountDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(async (status: FinancialAccountStatus, pg: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFinancialAccounts(status, { page: pg, page_size: PAGE_SIZE });
      setItems(data.items);
      setTotal(data.total);
      setPage(data.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar o financeiro.');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab, 1);
  }, [tab, load]);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc[item.status] += Number(item.value) || 0;
        return acc;
      },
      { open: 0, paid: 0, overdue: 0 } as Record<FinancialAccountStatus, number>,
    );
  }, [items]);

  const openDetail = async (account: FinancialAccount) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const data = await fetchFinancialAccountDetail(account.id);
      setDetail(data);
    } catch (err) {
      setDetail(null);
      setError(err instanceof Error ? err.message : 'Falha ao carregar o detalhe.');
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <p className="text-muted-foreground text-sm mt-1">Contas dos clientes (abertas, pagas e vencidas)</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total em Aberto</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(totals.open)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Pago</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.paid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Vencido</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totals.overdue)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-1 mb-4 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-destructive">{error}</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma conta {TABS.find((t) => t.key === tab)?.label.toLowerCase()} encontrada.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r) => {
                  const meta = STATUS_META[r.status];
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.document || '—'}</TableCell>
                      <TableCell>{formatDate(r.due_date)}</TableCell>
                      <TableCell className="font-bold">{formatCurrency(Number(r.value))}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={meta.className}>
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(r)}>
                          <Eye className="w-4 h-4 mr-1.5" />
                          Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {!loading && !error && pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => load(tab, page - 1)}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Anterior
          </Button>
          <span className="text-muted-foreground">
            Página {page} de {pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => load(tab, page + 1)}>
            Próxima
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes da conta</DialogTitle>
            <DialogDescription>
              {detail ? `Documento ${detail.document || '—'}` : 'Carregando...'}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Valor</p>
                  <p className="font-bold">{formatCurrency(Number(detail.value))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Vencimento</p>
                  <p>{formatDate(detail.due_date)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant="outline" className={STATUS_META[detail.status].className}>
                    {STATUS_META[detail.status].label}
                  </Badge>
                </div>
                {detail.status === 'overdue' && (
                  <div>
                    <p className="text-muted-foreground">Dias em atraso</p>
                    <p className="font-bold text-red-600">{detail.days_overdue} dias</p>
                  </div>
                )}
                {detail.paid_at && (
                  <div>
                    <p className="text-muted-foreground">Pago em</p>
                    <p>{formatDateTime(detail.paid_at)}</p>
                  </div>
                )}
              </div>

              {detail.payments.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Pagamentos</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Método</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{formatDateTime(p.paid_at)}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(Number(p.value))}</TableCell>
                          <TableCell>{p.method || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-destructive">Não foi possível carregar o detalhe.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}