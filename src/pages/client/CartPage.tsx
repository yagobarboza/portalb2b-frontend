import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Separator } from '../../components/ui/separator';
import { Badge } from '../../components/ui/badge';
import { ShoppingCart, Minus, Plus, Trash2, Package, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../lib/format';
import { toast } from 'sonner';
import { mockOrders } from '../../data/mock';
import type { Order, OrderItem } from '../../types';

export default function CartPage() {
  const { items, updateQty, removeItem, clearCart, total } = useCart();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [ordering, setOrdering] = useState(false);
  const [ordered, setOrdered] = useState(false);

  const handleFinalize = () => {
    if (items.length === 0) return;
    const stockErrors = items.filter((i) => i.qty > i.product.stock);
    if (stockErrors.length > 0) {
      toast.error(`Estoque insuficiente para: ${stockErrors.map((e) => e.product.name).join(', ')}`);
      return;
    }
    setOrdering(true);

    setTimeout(() => {
      const newOrder: Order = {
        id: `order-${Date.now()}`,
        customerId: 'cust-1',
        customerName: currentUser?.name || '',
        status: 'submitted',
        items: items.map((i): OrderItem => ({
          productId: i.product.id,
          productName: i.product.name,
          qty: i.qty,
          unitPrice: i.product.price,
        })),
        total,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tenantId: 'tenant-1',
      };
      mockOrders.unshift(newOrder);
      clearCart();
      setOrdered(true);
      setOrdering(false);
      toast.success('Pedido enviado com sucesso!');
    }, 1000);
  };

  if (ordered) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Pedido enviado!</h2>
        <p className="text-muted-foreground mb-8">
          Seu pedido foi enviado com sucesso e está aguardando aprovação da TechMax.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => navigate('/loja')}>
            Continuar comprando
          </Button>
          <Button variant="outline" onClick={() => navigate('/pedidos')}>
            Ver meus pedidos
          </Button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
          <ShoppingCart className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Carrinho vazio</h2>
        <p className="text-muted-foreground mb-8">
          Adicione produtos da vitrine para começar.
        </p>
        <Button onClick={() => navigate('/loja')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Ir para a vitrine
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate('/loja')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Carrinho</h1>
          <p className="text-sm text-muted-foreground">{items.length} ite{items.length !== 1 ? 'ns' : 'm'}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Items list */}
        <div className="lg:col-span-2 space-y-3">
          {items.map(({ product, qty }) => (
            <Card key={product.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {/* Image placeholder */}
                  <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                    <Package className="w-8 h-8 text-muted-foreground/40" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm leading-tight line-clamp-2 mb-0.5">
                      {product.name}
                    </h3>
                    <Badge variant="secondary" className="text-[10px] mb-2">{product.category}</Badge>
                    <p className="text-primary font-bold">
                      {formatCurrency(product.price * qty)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(product.price)} × {qty}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeItem(product.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center gap-1 border rounded-md">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7"
                        onClick={() => updateQty(product.id, qty - 1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">{qty}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7"
                        disabled={qty >= product.stock}
                        onClick={() => updateQty(product.id, qty + 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    {qty >= product.stock && (
                      <span className="text-[10px] text-amber-600 font-medium flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3" />
                        Máx. estoque
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => clearCart()}
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Limpar carrinho
          </Button>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-20">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Resumo do pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map(({ product, qty }) => (
                <div key={product.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground line-clamp-1 flex-1 mr-2">
                    {product.name} × {qty}
                  </span>
                  <span className="font-medium flex-shrink-0">
                    {formatCurrency(product.price * qty)}
                  </span>
                </div>
              ))}

              <Separator />

              <div className="flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-lg text-primary">{formatCurrency(total)}</span>
              </div>

              <Button
                className="w-full mt-4"
                size="lg"
                onClick={handleFinalize}
                disabled={ordering}
              >
                {ordering ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Finalizar Pedido
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Sujeito à aprovação pela TechMax
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
