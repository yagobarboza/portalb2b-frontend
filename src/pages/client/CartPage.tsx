import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { api, ApiError } from '../../lib/api';
import { isSafeImageUrl } from '../../lib/uploads';
import { formatCurrency } from '../../lib/format';
import type { Order } from '@/types/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

export default function CartPage() {
  const navigate = useNavigate();
  const { items, productMap, total, updateQty, removeItem, isLoading } = useCart();
  const [ordering, setOrdering] = useState(false);

  // Checkout: POST /orders — o backend cria o pedido a partir do carrinho
  // persistido e revalida preços/estoque. Nunca enviamos valores.
  const handleFinalize = async () => {
    if (items.length === 0 || ordering) return;
    setOrdering(true);
    try {
      const order = await api.post<Order>('/orders', {});
      toast.success(`Pedido ${order.number} enviado com sucesso!`);
      navigate('/pedidos');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao finalizar o pedido.');
    } finally {
      setOrdering(false);
    }
  };

  if (isLoading) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">Carregando carrinho…</div>;
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
        <h2 className="text-xl font-bold">Seu carrinho está vazio</h2>
        <p className="mb-8 mt-1 text-muted-foreground">Adicione produtos da vitrine para começar.</p>
        <Button onClick={() => navigate('/loja')}>Ir para a vitrine</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Carrinho</h1>
          <p className="mt-1 text-muted-foreground">
            {items.length} {items.length === 1 ? 'produto' : 'produtos'} no carrinho.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/loja')}>
          <ArrowLeft className="mr-2 h-4 w-4" />Continuar comprando
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Itens ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="w-44">Quantidade</TableHead>
                <TableHead className="text-right">Unitário</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const product = productMap[item.product_id];
                // ✅ BUG 8: quantidade como INTEIRO (sem decimais/moeda)
                const qty = Math.round(Number(item.quantity));
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {product && isSafeImageUrl(product.image_url) ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-10 w-10 rounded object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : null}
                        <div>
                          <p className="font-medium">{product?.name ?? item.product_id.slice(0, 8)}</p>
                          {product?.sku && <p className="text-xs text-muted-foreground">{product.sku}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          disabled={qty <= 1}
                          onClick={() => updateQty(item.id, qty - 1)}
                          aria-label="Diminuir"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          min={1}
                          max={9999}
                          step={1}
                          value={qty}
                          onChange={(e) => {
                            const v = Math.max(1, Math.floor(Number(e.target.value) || 1));
                            updateQty(item.id, v);
                          }}
                          className="h-8 w-16 text-center"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          disabled={qty >= 9999}
                          onClick={() => updateQty(item.id, qty + 1)}
                          aria-label="Aumentar"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(Number(item.unit_price))}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(Number(item.subtotal))}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Remover item"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-4">
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{formatCurrency(total)}</p>
            </div>
            <Button onClick={handleFinalize} disabled={ordering || items.length === 0}>
              {ordering ? 'Enviando…' : 'Finalizar pedido'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}