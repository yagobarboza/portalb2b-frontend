import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Package, Search, ArrowDown, ArrowUp, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { isSafeImageUrl } from '../../lib/uploads';
import type { Order, OrderPage, ProductPage } from '@/types/api';
import { orderStatusClass, orderStatusLabel } from '../../lib/orderStatus';
import { formatCurrency, formatDate } from '../../lib/format';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Separator } from '../../components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';

const PAGE_SIZE = 20;
// ✅ Quantos itens mostrar por página DENTRO do modal de detalhes.
const DETAIL_PAGE_SIZE = 8;

type SortOrder = 'desc' | 'asc';

// ✅ Estados em que o cliente pode cancelar o pedido.
const CANCELLABLE = new Set(['submitted', 'under_review', 'approved']);

// ✅ Skeleton de carregamento (não deixa a tela "piscar").
function OrderSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <div className="space-y-2">
                  <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
              </div>
              <div className="space-y-2 text-right">
                <div className="ml-auto h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="ml-auto h-8 w-24 animate-pulse rounded bg-muted" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function ClientOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Order | null>(null);
  // ✅ Paginação dos itens DENTRO do modal de detalhes.
  const [detailItemPage, setDetailItemPage] = useState(1);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelling, setCancelling] = useState(false);
  // ✅ BUG 6: mapa de NOMES dos produtos (OrderItem só traz product_id).
  const [productMap, setProductMap] = useState<Record<string, string>>({});
  // ✅ NOVO: mapa de IMAGENS dos produtos (para a miniatura).
  const [productImgMap, setProductImgMap] = useState<Record<string, string | null>>({});

  // ✅ Filtros (aplicados NO BACKEND — valem para todos os pedidos)
  const [searchNumber, setSearchNumber] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await api.get<ProductPage>('/catalog/products', { page: 1, page_size: 100 });
        const names: Record<string, string> = {};
        const imgs: Record<string, string | null> = {};
        for (const p of data.items) {
          names[p.id] = p.name;
          imgs[p.id] = p.image_url ?? null;
        }
        if (active) {
          setProductMap(names);
          setProductImgMap(imgs);
        }
      } catch {
        // fallback: mantém o ID truncado.
      }
    })();
    return () => { active = false; };
  }, []);

  const productName = (id: string) => productMap[id] ?? id.slice(0, 8);

  // ✅ NOVO: miniatura do produto (ou fallback de ícone) antes do nome.
  const productThumb = (id: string) => {
    const url = productImgMap[id];
    if (url && isSafeImageUrl(url)) {
      return (
        <img
          src={url}
          alt=""
          className="h-8 w-8 shrink-0 rounded object-contain"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
      );
    }
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
        <Package className="h-4 w-4" />
      </span>
    );
  };

  // ✅ Debounce da busca por número (evita flood na API).
  useEffect(() => {
    const t = setTimeout(() => setPage(1), 350);
    return () => clearTimeout(t);
  }, [searchNumber, dateFrom, dateTo, sortOrder]);

  // ✅ Carrega com os filtros enviados ao backend (valem para TODOS os pedidos).
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, page_size: PAGE_SIZE };
      if (searchNumber.trim()) params.search = searchNumber.trim();
      if (dateFrom) params.date_from = new Date(`${dateFrom}T00:00:00`).toISOString();
      if (dateTo) params.date_to = new Date(`${dateTo}T23:59:59`).toISOString();
      params.sort_by = 'created_at';
      params.sort_dir = sortOrder;
      const data = await api.get<OrderPage>('/orders', params);
      setOrders(data.items);
      setTotal(data.total);
      setPages(data.pages || 1);
    } catch {
      toast.error('Não foi possível carregar seus pedidos.');
    } finally {
      setLoading(false);
    }
  }, [page, searchNumber, dateFrom, dateTo, sortOrder]);

  useEffect(() => { load(); }, [load]);

  const clearFilters = () => {
    setSearchNumber('');
    setDateFrom('');
    setDateTo('');
    setSortOrder('desc');
    setPage(1);
  };

  const hasFilters = searchNumber !== '' || dateFrom !== '' || dateTo !== '' || sortOrder !== 'desc';

  const openDetail = async (order: Order) => {
    setDetail(order);
    setDetailItemPage(1); // ✅ reinicia a paginação dos itens
    try {
      const full = await api.get<Order>(`/orders/${order.id}`);
      setDetail(full);
    } catch {
      // mantém o item da lista como detalhe básico se o GET falhar
    }
  };

  const toggleExpand = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  // ✅ Cancela o pedido (com confirmação) e recarrega a lista.
  const confirmCancel = async () => {
    if (!cancelTarget || cancelling) return;
    setCancelling(true);
    try {
      await api.post<Order>(`/orders/${cancelTarget.id}/cancel`, {});
      toast.success(`Pedido #${cancelTarget.number} cancelado.`);
      setCancelTarget(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao cancelar o pedido.');
    } finally {
      setCancelling(false);
    }
  };

  // ✅ Itens visíveis na página atual do modal de detalhes.
  const detailItems = detail
    ? detail.items.slice(
        (detailItemPage - 1) * DETAIL_PAGE_SIZE,
        detailItemPage * DETAIL_PAGE_SIZE,
      )
    : [];
  const detailItemPages = detail ? Math.max(1, Math.ceil(detail.items.length / DETAIL_PAGE_SIZE)) : 1;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Cabeçalho — SEMPRE visível */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Meus Pedidos</h1>
        <p className="mt-1 text-muted-foreground">
          Acompanhe o status dos seus pedidos{total > 0 ? ` (${total} no total)` : ''}.
        </p>
      </div>

      {/* Barra de filtros — SEMPRE visível */}
      <div className="mb-6 rounded-lg border bg-card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Busca por número */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Buscar pedido</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Nº do pedido…"
                value={searchNumber}
                onChange={(e) => setSearchNumber(e.target.value)}
              />
            </div>
          </div>

          {/* Data inicial */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">De</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>

          {/* Data final */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Até</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>

          {/* Ordenação */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Ordenar por data</Label>
            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">
                  <span className="inline-flex items-center gap-1.5"><ArrowDown className="h-3.5 w-3.5" />Mais recentes</span>
                </SelectItem>
                <SelectItem value="asc">
                  <span className="inline-flex items-center gap-1.5"><ArrowUp className="h-3.5 w-3.5" />Mais antigos</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {total} {total === 1 ? 'pedido' : 'pedidos'}
            {hasFilters ? ' (filtrado)' : ''}
          </p>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {/* ── Área de RESULTADOS (troca conforme o estado, sem sumir a página) ── */}
      {loading ? (
        <OrderSkeleton />
      ) : orders.length === 0 ? (
        <div className="py-16 text-center">
          <Package className="mx-auto mb-4 h-14 w-14 text-muted-foreground/30" />
          <h3 className="text-lg font-semibold text-muted-foreground">
            {hasFilters ? 'Nenhum pedido corresponde aos filtros' : 'Nenhum pedido encontrado'}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground/70">
            {hasFilters
              ? 'Ajuste os filtros ou limpe para ver todos os pedidos.'
              : 'Seus pedidos aparecerão aqui.'}
          </p>
          {hasFilters && (
            <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
              Limpar filtros
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {orders.map((order) => {
              const cancellable = CANCELLABLE.has(order.status);
              return (
                <Card key={order.id} className="overflow-hidden">
                  <CardContent className="p-0">
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
                        <div className="flex flex-wrap items-center gap-2 text-right">
                          <p className="font-bold">{formatCurrency(order.total)}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); openDetail(order); }}
                          >
                            Ver detalhes
                          </Button>
                          {/* ✅ Botão CANCELAR (com confirmação) */}
                          {cancellable && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); setCancelTarget(order); }}
                            >
                              <XCircle className="mr-1 h-4 w-4" />Cancelar
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {expandedId === order.id && (
                      <div className="border-t px-4 py-3">
                        <div className="overflow-x-auto">
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
                                  <TableCell>
                                    <div className="flex min-w-0 items-center gap-2">
                                      {productThumb(item.product_id)}
                                      <span className="min-w-0 break-words font-medium">{productName(item.product_id)}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>{Math.round(Number(item.quantity))}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(Number(item.unit_price))}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(Number(item.subtotal))}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        {/* ✅ TOTAL abaixo dos produtos (fora da tabela, sempre visível) */}
                        <div className="mt-3 flex items-center justify-end gap-2 border-t pt-3">
                          <span className="text-sm font-medium text-muted-foreground">Total</span>
                          <span className="text-lg font-bold">{formatCurrency(order.total)}</span>
                        </div>

                        {order.notes && <p className="mt-3 text-sm text-muted-foreground">Obs.: {order.notes}</p>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
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
        </>
      )}

      {/* Detalhe — modal MAIOR, com scroll interno e paginação de itens */}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="max-w-3xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>Pedido #{detail.number}</DialogTitle>
              </DialogHeader>
              <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge className={orderStatusClass(detail.status)}>{orderStatusLabel(detail.status)}</Badge>
                  <span className="font-bold">{formatCurrency(detail.total)}</span>
                </div>

                {/* Tabela de itens com quebra de linha + paginação */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Qtd</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="flex min-w-0 items-center gap-2">
                              {productThumb(item.product_id)}
                              <span className="min-w-0 break-words font-medium">{productName(item.product_id)}</span>
                            </div>
                          </TableCell>
                          <TableCell>{Math.round(Number(item.quantity))}</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(item.subtotal))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* ✅ TOTAL abaixo dos produtos (fora da tabela, sempre visível) */}
                <div className="flex items-center justify-end gap-2 border-t pt-3">
                  <span className="text-sm font-medium text-muted-foreground">Total</span>
                  <span className="text-xl font-bold">{formatCurrency(detail.total)}</span>
                </div>

                {/* Paginação dos itens do pedido */}
                {detailItemPages > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Itens {detailItemPage} de {detailItemPages}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={detailItemPage <= 1}
                        onClick={() => setDetailItemPage((p) => p - 1)}
                        aria-label="Itens anteriores"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="px-2 text-sm text-muted-foreground">
                        {detailItemPage} / {detailItemPages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={detailItemPage >= detailItemPages}
                        onClick={() => setDetailItemPage((p) => p + 1)}
                        aria-label="Próximos itens"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {detail.status_history.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="mb-2 text-sm font-medium">Histórico de status</p>
                      <div className="space-y-2">
                        {detail.status_history.map((h) => (
                          <div key={h.id} className="flex items-start justify-between gap-2 text-sm">
                            <div className="min-w-0">
                              <span className="font-medium">{orderStatusLabel(h.to_status)}</span>
                              {h.note && <p className="break-words text-xs text-muted-foreground">{h.note}</p>}
                            </div>
                            <span className="shrink-0 text-xs text-muted-foreground">{formatDate(h.created_at)}</span>
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

      {/* Confirmação de cancelamento */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) setCancelTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              O pedido #{cancelTarget?.number} será cancelado. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmCancel}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelando…' : 'Confirmar cancelamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}