import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BarChart3, CheckCircle, Clock, DollarSign, Eye, Package, Search, XCircle } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import type { CustomerPage, Order, OrderPage, OrderStatus, ProductPage } from '@/types/api';
import { COMPANY_ORDER_TRANSITIONS, orderStatusClass, orderStatusLabel } from '../../lib/orderStatus';
import { formatCurrency, formatDate } from '../../lib/format';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';

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
  // ✅ BUG 6: mapas de nomes (cliente + produto).
  const [customerMap, setCustomerMap] = useState<Record<string, string>>({});
  const [productMap, setProductMap] = useState<Record<string, string>>({});
  // Detalhe de itens
  const [detail, setDetail] = useState<Order | null>(null);
  // Transição de status
  const [transitionTarget, setTransitionTarget] = useState<Order | null>(null);
  const [transitionTo, setTransitionTo] = useState<OrderStatus | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  // Carrega nomes de clientes e produtos para exibição amigável.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cust = await api.get<CustomerPage>('/customers', { page: 1, page_size: 100 });
        const cm: Record<string, string> = {};
        for (const c of cust.items) cm[c.id] = c.name;
        const prod = await api.get<ProductPage>('/catalog/products', { page: 1, page_size: 100 });
        const pm: Record<string, string> = {};
        for (const p of prod.items) pm[p.id] = p.name;
        if (active) { setCustomerMap(cm); setProductMap(pm); }
      } catch {
        // fallback: IDs.
      }
    })();
    return () => { active = false; };
  }, []);

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

  const kpis = useMemo(() => {
    const pending = orders.filter((o) => o.status === 'submitted' || o.status === 'received' || o.status === 'under_review').length;
    const approved = orders.filter((o) => o.status === 'approved').length;
    const cancelled = orders.filter((o) => o.status === 'cancelled').length;
    const value = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total), 0);
    const itemsCount = orders.reduce((s, o) => s + o.items.reduce((a, i) => a + Number(i.quantity), 0), 0);
    return [
      { label: 'Total', value: total, icon: Package, tone: 'text-blue-600 bg-blue-100' },
      { label: 'Pendentes', value: pending, icon: Clock, tone: 'text-amber-600 bg-amber-100' },
      { label: 'Aprovados', value: approved, icon: CheckCircle, tone: 'text-emerald-600 bg-emerald-100' },
      { label: 'Cancelados', value: cancelled, icon: XCircle, tone: 'text-red-600 bg-red-100' },
      { label: 'Valor (pág.)', value: formatCurrency(value), icon: DollarSign, tone: 'text-violet-600 bg-violet-100' },
      { label: 'Itens (pág.)', value: itemsCount, icon: BarChart3, tone: 'text-cyan-600 bg-cyan-100' },
    ];
  }, [orders, total]);

  const customerName = (id?: string | null) => (id ? customerMap[id] ?? id.slice(0, 8) : '—');
  const productName = (id: string) => productMap[id] ?? id.slice(0, 8);

  const openDetail = async (order: Order) => {
    setDetail(order);
    try {
      const full = await api.get<Order>(`/orders/${order.id}`);
      setDetail(full);
    } catch {
      // mantém o item da lista
    }
  };

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
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Erro ao atualizar o status.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`rounded-xl p-3 ${k.tone}`}><k.icon className="h-5 w-5" /></div>
              <div className="min-w-0">
                <p className="truncate text-sm text-muted-foreground">{k.label}</p>
                <p className="truncate text-xl font-bold">{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
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
              <SelectItem value="shipped">Enviado / Trânsito</SelectItem>
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
            <p className="py-10 text-center text-muted-foreground">Nenhum pedido encontrado.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
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
                        {/* ✅ BUG 6: nome do cliente em vez do ID */}
                        <TableCell className="text-muted-foreground">{customerName(order.customer_id)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(order.created_at)}</TableCell>
                        <TableCell>
                          <Badge className={orderStatusClass(order.status)}>{orderStatusLabel(order.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(order.total)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" aria-label="Ver itens" onClick={() => openDetail(order)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {transitions.map((t) => (
                              <Button
                                key={t.to}
                                size="sm"
                                variant="outline"
                                onClick={() => openTransition(order, t.to)}
                              >
                                {t.label}
                              </Button>
                            ))}
                          </div>
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

      {/* Detalhe do pedido (itens por nome) */}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>Pedido #{detail.number} · {customerName(detail.customer_id)}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge className={orderStatusClass(detail.status)}>{orderStatusLabel(detail.status)}</Badge>
                  <span className="font-bold">{formatCurrency(detail.total)}</span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead className="text-right">Unitário</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{productName(item.product_id)}</TableCell>
                        <TableCell>{Math.round(Number(item.quantity))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(item.unit_price))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(item.subtotal))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {detail.notes && <p className="text-sm text-muted-foreground">Obs.: {detail.notes}</p>}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Transição de status */}
      <Dialog open={!!transitionTarget && !!transitionTo} onOpenChange={(o) => { if (!o) setTransitionTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {transitionTo
                ? `${COMPANY_ORDER_TRANSITIONS.find((t) => t.to === transitionTo)?.label ?? 'Atualizar'} — Pedido #${transitionTarget?.number}`
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
                <Label htmlFor="transition-note">Nota (opcional)</Label>
                <Textarea
                  id="transition-note"
                  rows={2}
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Observação sobre a mudança de status…"
                />
              </div>
              {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
              <DialogFooter>
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