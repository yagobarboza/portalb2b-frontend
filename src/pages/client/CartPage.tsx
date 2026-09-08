import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Minus, Package, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { api, ApiError } from '../../lib/api';
import { isSafeImageUrl } from '../../lib/uploads';
import { formatCurrency } from '../../lib/format';
import type { Order } from '@/types/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

export default function CartPage() {
  const { items, productMap, updateQty, removeItem, clearCart, total, isLoading } = useCart();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [ordering, setOrdering] = useState(false);

  // Itens enriquecidos com o produto (nome/imagem) a partir do mapa do contexto.
  const rows = useMemo(
    () =>
      items
        .map((item) => ({ item, product: productMap[item.product_id] }))
        .filter((r): r is { item: (typeof items)[number]; product: NonNullable<(typeof items)[number] extends never ? never : typeof r.product> } => !!r.product),
    [items, productMap]
  );

  const handleUpdateQty = async (itemId: string, qty: number) => {
    if (qty < 1) return;
    setBusy(true);
    try {
      await updateQty(itemId, qty);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao atualizar o carrinho.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (itemId: string) => {
    setBusy(true);
    try {
      await removeItem(itemId);
      toast.success('Item removido do carrinho.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao remover o item.');
    } finally {
      setBusy(false);
    }
  };

  // Checkout (Bloco 7): POST /orders — o backend cria o pedido a partir do
  // carrinho persistido e revalida preços/estoque. Nunca enviamos valores.
  const handleFinalize = async () => {
    if (items.length === 0 || ordering) return;
    setOrdering(true);
    try {
      await api.post<Order>('/orders', {}); // notes opcional: { notes: '...' }
      toast.success('Pedido enviado para aprovação!');
      clearCart();
      navigate('/pedidos');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao finalizar o pedido.');
    } finally {
      setOrdering(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">
        Carregando carrinho…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
        <h2 className="text-xl font-bold">Seu carrinho está vazio</h2>
        <p className="mb-8 mt-1 text-muted-foreground">Adicione produtos da vitrine para começar.</p>
        <Button onClick={() => navigate('/loja')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Ir para a vitrine
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Carrinho</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Itens */}
        <div className="space-y-3">
          {rows.map(({ item, product }) => (
            <Card key={item.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/50">
                  {isSafeImageUrl(product.image_url) ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Package className="h-6 w-6 text-muted-foreground/40" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {product.sku}
                    {product.unit ? ` · ${product.unit}` : ''}
                  </p>
                  <p className="mt-1 text-sm">
                    <span className="text-muted-foreground">Preço unitário: </span>
                    <span className="font-semibold">{formatCurrency(item.unit_price)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={busy || item.quantity <= 1}
                    onClick={() => handleUpdateQty(item.id, item.quantity - 1)}
                    aria-label="Diminuir"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-10 text-center text-sm font-medium">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={busy}
                    onClick={() => handleUpdateQty(item.id, item.quantity + 1)}
                    aria-label="Aumentar"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="w-28 text-right">
                  <p className="font-semibold">{formatCurrency(item.subtotal)}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={busy}
                    onClick={() => handleRemove(item.id)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Remover
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Resumo — total SEMPRE vindo do backend (preços negociados validados). */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Resumo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Itens</span>
              <span>{items.reduce((s, i) => s + i.quantity, 0)}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <span className="font-medium">Total</span>
              <span className="text-xl font-bold">{formatCurrency(total)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Os preços são calculados e validados pelo servidor conforme a sua negociação.
            </p>
            <Button className="w-full" onClick={handleFinalize} disabled={ordering}>
              {ordering ? 'Enviando…' : 'Finalizar pedido'}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate('/loja')}>
              Continuar comprando
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}