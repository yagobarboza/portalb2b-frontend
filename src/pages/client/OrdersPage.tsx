import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Package } from 'lucide-react';
import { api } from '../../lib/api';
import type { Order, OrderPage, ProductPage } from '@/types/api';
import { orderStatusClass, orderStatusLabel } from '../../lib/orderStatus';
import { formatCurrency, formatDate } from '../../lib/format';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Separator } from '../../components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

const PAGE_SIZE = 20;

export default function ClientOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Order | null>(null);
  // ✅ BUG 6: mapa de NOMES dos produtos (OrderItem só traz product_id).
  const [productMap, setProductMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await api.get<ProductPage>('/catalog/products', { page: 1, page_size: 100 });
        const map: Record<string, string> = {};
        for (const p of data.items) map[p.id] = p.name;
        if (active) setProductMap(map);
      } catch {
        // fallback: mantém o ID truncado.
      }
    })();
    return () => { active = false; };
  }, []);

  const productName = (id: string) => productMap[id] ?? id.slice(0, 8);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<OrderPage>('/orders', { page, page_size: PAGE_SIZE });
      setOrders(data.items);
      setTotal(data.total);
      setPages(data.pages || 1);
    } catch {
      toast.error('Não foi possível carregar seus pedidos.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (order: Order) => {
    setDetail(order);
    try {
      const full = await api.get<Order>(`/orders/${order.id}`);
      setDetail(full);
    } catch {
      // mantém o item da lista como detalhe básico se o GET falhar
    }
  };

  const toggleExpand = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  if (loading) {
    return <div className="mx-auto max-w-5xl px-4 py-16 text-center text-muted-foreground">Carregando pedidos…</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-20 text-center">
        <Package className="mx-auto mb-4 h-16 w-16 text-muted-foreground/30" />
        <h3 className="text-lg font-semibold text-muted-foreground">Nenhum pedido encontrado</h3>
        <p className="mt-1 text-sm text-muted-foreground/70">Seus pedidos aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Meus Pedidos</h1>
        <p className="mt-1 text-muted-foreground">
          Acompanhe o status dos seus pedidos{total > 0 ? ` (${total} no total)` : ''}.
        </p>
      </div>

      <div className="space-y-3">
        {orders.map((order) => (
          <Card key={order.id} className="overflow-hidden">
            <CardContent className="p-0">
              {/*
                ✅ FIX: o card era um <button> contendo um <Button> interno
                (HTML inválido → warning "button cannot be a descendant of button").
                Agora é uma <div> clicável com role="button" + teclado.
              */}
              <div
                role="button"
                tabIndex={0}
                className="w-full cursor-pointer p-4 text-left transition-colors hover:bg-muted/30"
                onClick={() => toggleExpand(order.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleExpand(order.id);
                  }
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <p className="font-semibold">Pedido #{order.number}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                    </div>
                    <Badge className={orderStatusClass(order.status)}>
                      {orderStatusLabel(order.status)}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(order.total)}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); openDetail(order); }}
                    >
                      Ver detalhes
                    </Button>
                  </div>
                </div>
              </div>

              {expandedId === order.id && (
                <div className="border-t px-4 py-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Qtd</TableHead>
                        <TableHead className="text-right">Preço</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.items.map((item) => (
                        <TableRow key={item.id}>
                          {/* ✅ BUG 6: nome do produto em vez do ID */}
                          <TableCell className="font-medium">{productName(item.product_id)}</TableCell>
                          <TableCell>{Math.round(Number(item.quantity))}</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(item.unit_price))}</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(item.subtotal))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {order.notes && <p className="mt-3 text-sm text-muted-foreground">Obs.: {order.notes}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {pages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Página {page} de {pages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        </div>
      )}

      {/* Detalhe */}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>Pedido #{detail.number}</DialogTitle>
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
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{productName(item.product_id)}</TableCell>
                        <TableCell>{Math.round(Number(item.quantity))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(item.subtotal))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {detail.status_history.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="mb-2 text-sm font-medium">Histórico de status</p>
                      <div className="space-y-2">
                        {detail.status_history.map((h) => (
                          <div key={h.id} className="flex items-start justify-between gap-2 text-sm">
                            <div>
                              <span className="font-medium">{orderStatusLabel(h.to_status)}</span>
                              {h.note && <p className="text-xs text-muted-foreground">{h.note}</p>}
                            </div>
                            <span className="text-xs text-muted-foreground">{formatDate(h.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}