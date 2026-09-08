import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BarChart3, CheckCircle, Clock, DollarSign, Package, Search, XCircle } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import type { Order, OrderPage, OrderStatus } from '@/types/api';
import { COMPANY_ORDER_TRANSITIONS, orderStatusClass, orderStatusLabel } from '../../lib/orderStatus';
import { formatCurrency, formatDate } from '../../lib/format';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';

const PAGE_SIZE = 20;

export default function CompanyOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | OrderStatus>('all');

  const [transitionTarget, setTransitionTarget] = useState<Order | null>(null);
  const [transitionTo, setTransitionTo] = useState<OrderStatus | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Debounce da busca (evita flood de requisições).
  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<OrderPage>('/orders/tenant', {
        page,
        page_size: PAGE_SIZE,
        status: filterStatus === 'all' ? undefined : filterStatus,
        search: searchDebounced || undefined,
      });
      setOrders(data.items);
      setTotal(data.total);
      setPages(data.pages || 1);
    } catch {
      toast.error('Não foi possível carregar os pedidos.');
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, searchDebounced]);

  useEffect(() => { load(); }, [load]);

  // KPIs calculados a partir da página atual (o backend é a fonte real de totais).
  const kpis = useMemo(() => {
    const pending = orders.filter((o) => o.status === 'submitted' || o.status === 'received' || o.status === 'under_review').length;
    const approved = orders.filter((o) => o.status === 'approved').length;
    const cancelled = orders.filter((o) => o.status === 'cancelled').length;
    const value = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);
    const items = orders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.quantity, 0), 0);
    return [
      { label: 'Total de pedidos', value: String(total), icon: Package, tone: 'text-blue-600 bg-blue-100' },
      { label: 'Aguardando ação', value: String(pending), icon: Clock, tone: 'text-amber-600 bg-amber-100' },
      { label: 'Aprovados', value: String(approved), icon: CheckCircle, tone: 'text-emerald-600 bg-emerald-100' },
      { label: 'Cancelados', value: String(cancelled), icon: XCircle, tone: 'text-red-600 bg-red-100' },
      { label: 'Valor (pág.)', value: formatCurrency(value), icon: DollarSign, tone: 'text-violet-600 bg-violet-100' },
      { label: 'Itens (pág.)', value: String(items), icon: BarChart3, tone: 'text-indigo-600 bg-indigo-100' },
    ];
  }, [orders, total]);

  const openTransition = (order: Order, to: OrderStatus) => {
    setTransitionTarget(order);
    setTransitionTo(to);
    setNote('');
    setActionError(null);
  };

  const confirmTransition = async () => {
    if (!transitionTarget || !transitionTo || saving) return;
    setSaving(true);
    setActionError(null);
    try {
      await api.patch<Order>(`/orders/${transitionTarget.id}/status`, {
        status: transitionTo,
        note: note.trim() || null,
      });
      toast.success('Status do pedido atualizado.');
      setTransitionTarget(null);
      setTransitionTo(null);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Erro ao atualizar o pedido.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatório de Pedidos</h1>
          <p className="mt-1 text-muted-foreground">Consulte, filtre e gerencie os pedidos da plataforma.</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

      {/* Filtros */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por número ou cliente…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="w-full sm:w-56">
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v as 'all' | OrderStatus); setPage(1); }}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="submitted">Enviado</SelectItem>
              <SelectItem value="under_review">Em Análise</SelectItem>
              <SelectItem value="approved">Aprovado</SelectItem>
              <SelectItem value="processing">Em Processamento</SelectItem>
              <SelectItem value="invoiced">Faturado</SelectItem>
              <SelectItem value="shipped">Enviado</SelectItem>
              <SelectItem value="completed">Concluído</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Pedidos <span className="font-normal text-muted-foreground">({total})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="py-10 text-center text-muted-foreground">Carregando…</p>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Package className="mb-4 h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-semibold text-muted-foreground">Nenhum pedido encontrado</h3>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => {
                    const transitions = COMPANY_ORDER_TRANSITIONS.filter((t) => t.from.includes(order.status));
                    return (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">#{order.number}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(order.created_at)}</TableCell>
                        <TableCell>
                          <Badge className={orderStatusClass(order.status)}>{orderStatusLabel(order.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(order.total)}</TableCell>
                        <TableCell className="text-right">
                          {transitions.length > 0 ? (
                            <div className="flex justify-end gap-1">
                              {transitions.slice(0, 2).map((t) => (
                                <Button key={t.to} size="sm" variant="outline" onClick={() => openTransition(order, t.to)}>
                                  {t.label}
                                </Button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {pages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-xs text-muted-foreground">Página {page} de {pages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                    <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de transição de status */}
      <Dialog open={!!transitionTarget && !!transitionTo} onOpenChange={(o) => { if (!o) { setTransitionTarget(null); setTransitionTo(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {transitionTarget && transitionTo
                ? `${COMPANY_ORDER_TRANSITIONS.find((t) => t.to === transitionTo)?.label ?? 'Atualizar'} — Pedido #${transitionTarget.number}`
                : 'Atualizar pedido'}
            </DialogTitle>
          </DialogHeader>
          {transitionTarget && transitionTo && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status atual</span>
                <Badge className={orderStatusClass(transitionTarget.status)}>{orderStatusLabel(transitionTarget.status)}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Novo status</span>
                <Badge className={orderStatusClass(transitionTo)}>{orderStatusLabel(transitionTo)}</Badge>
              </div>
              <div className="space-y-2">
                <Label htmlFor="order-note">Nota explicativa</Label>
                <Textarea
                  id="order-note"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Opcional. Ex.: aprovado conforme negociação."
                  maxLength={500}
                />
              </div>
              {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
              <DialogFooter>
                <Button variant="outline" onClick={() => { setTransitionTarget(null); setTransitionTo(null); }} disabled={saving}>
                  Cancelar
                </Button>
                <Button onClick={confirmTransition} disabled={saving}>
                  {saving ? 'Salvando…' : 'Confirmar'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}