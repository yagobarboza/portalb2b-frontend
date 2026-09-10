import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Minus, Package, Percent, Plus, ShoppingCart } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { isSafeImageUrl } from '../../lib/uploads';
import { formatCurrency } from '../../lib/format';
import { hasHtml, sanitizeHtml } from '../../lib/sanitize';
import type { Product, QuantityTier } from '@/types/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';

/** Product + preço calculado (GET /catalog/products/{id} — backend enriquece). */
type ProductDetail = Product & {
  customer_price?: number | null;
  final_price?: number | null;
  price_source?: 'customer' | 'price_list' | 'default' | null;
};

/** Estoques são sempre INTEIROS (10, nunca "10.000"). */
const stockOf = (p: Product | null | undefined): number => {
  if (!p) return 0;
  const v = Number(p.stock);
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.trunc(v));
};

/**
 * Preço unitário aplicando a faixa de desconto por quantidade.
 * Modelo VOLUME: a faixa atingida vale para TODAS as unidades.
 * (Prévia visual — o preço oficial é sempre o do servidor no carrinho.)
 */
function unitPriceForQty(basePrice: number, qty: number, tiers: QuantityTier[]): number {
  if (tiers.length === 0 || qty < 1) return basePrice;
  const applicable = tiers
    .filter((t) => qty >= t.min_quantity)
    .sort((a, b) => b.min_quantity - a.min_quantity)[0];
  if (!applicable) return basePrice;
  const off =
    applicable.discount_type === 'percent'
      ? basePrice * (Number(applicable.discount_value) / 100)
      : Number(applicable.discount_value);
  return Math.max(0, basePrice - off);
}

/** Selo "Preço especial" — legível em Light e Dark (fundo invertido). */
function SpecialBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-foreground px-2 py-0.5 text-xs font-semibold text-background">
      Preço especial
    </span>
  );
}

/** Selo "Desconto por quantidade" — destacado quando a faixa foi atingida. */
function QuantityBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-600/40 bg-emerald-600/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
      <Percent className="h-3 w-3" />
      Desconto por quantidade
    </span>
  );
}

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem, registerProduct } = useCart();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [tiers, setTiers] = useState<QuantityTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      // Backend força o customer_id do próprio cliente (anti-vazamento)
      const data = await api.get<ProductDetail>(`/catalog/products/${id}`, {
        customer_id: user?.customer_id ?? undefined,
      });
      setProduct(data);
      registerProduct(data);
      setTiers(data.quantity_discounts ?? []);
      setQty(1);
      setAdded(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Produto não encontrado.');
      navigate('/loja');
    } finally {
      setLoading(false);
    }
  }, [id, user?.customer_id, registerProduct, navigate]);
  useEffect(() => { load(); }, [load]);

  const stock = stockOf(product);
  const out = stock <= 0;
  const base = product ? Number(product.price) : 0;
  const final = product?.final_price != null ? Number(product.final_price) : base;
  const isSpecial =
    product?.price_source === 'customer' && final > 0 && Math.abs(final - base) > 0.001;
  const hasRichText = product?.description ? hasHtml(product.description) : false;

  // ✅ Preço unitário já considerando a faixa de desconto da quantidade escolhida.
  const unitForQty = unitPriceForQty(final, qty, tiers);
  const showFromPrice = base - unitForQty > 0.001; // há desconto (negociado e/ou por quantidade)
  const tierApplied = tiers.length > 0 && unitForQty < final - 0.001; // faixa atingida agora

  const handleAdd = async () => {
    if (!product || adding) return;
    setAdding(true);
    try {
      await addItem(product.id, qty);
      setAdded(true);
      toast.success(`${qty}× ${product.name} adicionado ao carrinho.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao adicionar ao carrinho.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Voltar */}
      <button
        type="button"
        onClick={() => navigate('/loja')}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para a vitrine
      </button>

      {loading ? (
        <p className="py-20 text-center text-muted-foreground">Carregando produto…</p>
      ) : !product ? (
        <p className="py-20 text-center text-muted-foreground">Produto não encontrado.</p>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Imagem */}
          <Card className="overflow-hidden">
            <CardContent className="flex h-72 items-center justify-center bg-muted/40 p-0 md:h-96">
              {isSafeImageUrl(product.image_url) ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Package className="h-20 w-20 text-muted-foreground/40" />
              )}
            </CardContent>
          </Card>

          {/* Informações */}
          <div className="space-y-4">
            <div>
              <p className="font-mono text-xs text-muted-foreground">SKU: {product.sku}</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">{product.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {product.brand ?? '—'}
                {product.unit ? ` · ${product.unit}` : ''}
              </p>
            </div>

            {/* Preço */}
            <div className="rounded-md border p-4">
              {showFromPrice ? (
                <p className="text-sm text-muted-foreground line-through">
                  De {formatCurrency(base)}
                </p>
              ) : null}
              <p className="text-3xl font-bold">
                {showFromPrice ? `Por ${formatCurrency(unitForQty)}` : formatCurrency(unitForQty)}
                {qty > 1 && (
                  <span className="ml-2 text-base font-medium text-muted-foreground">
                    × {qty} = {formatCurrency(unitForQty * qty)}
                  </span>
                )}
              </p>
              {(isSpecial || tierApplied) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {isSpecial && <SpecialBadge />}
                  {tierApplied && <QuantityBadge />}
                </div>
              )}
            </div>

            {/* ✅ Tabela de faixas de desconto por quantidade */}
            {tiers.length > 0 && (
              <div className="rounded-md border p-3">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Percent className="h-4 w-4" />
                  Descontos por quantidade
                </p>
                <ul className="space-y-1 text-sm">
                  {tiers.map((t) => {
                    const reached = qty >= t.min_quantity;
                    const label =
                      t.label ??
                      (t.discount_type === 'percent'
                        ? `${Number(t.discount_value)}% off`
                        : `${formatCurrency(Number(t.discount_value))} off/un`);
                    return (
                      <li
                        key={`${t.min_quantity}-${t.discount_type}`}
                        className={`flex items-center justify-between ${
                          reached ? 'font-semibold text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        <span>A partir de {t.min_quantity} un</span>
                        <span>{label}</span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  O desconto vale para todas as unidades e é calculado pelo servidor.
                </p>
              </div>
            )}

            {/* Estoque */}
            <p className="text-sm">
              {out ? (
                <span className="font-medium text-destructive">Esgotado</span>
              ) : (
                <span className="font-medium text-muted-foreground">
                  {stock} em estoque
                </span>
              )}
            </p>

            {/* Quantidade + adicionar */}
            {!out && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    disabled={qty <= 1}
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    aria-label="Diminuir"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    max={stock}
                    step={1}
                    value={qty}
                    onChange={(e) =>
                      setQty(Math.max(1, Math.min(stock, Math.trunc(Number(e.target.value) || 1))))
                    }
                    className="h-10 w-20 text-center"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    disabled={qty >= stock}
                    onClick={() => setQty((q) => q + 1)}
                    aria-label="Aumentar"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  size="lg"
                  disabled={adding}
                  onClick={handleAdd}
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {adding ? 'Adicionando…' : `Adicionar ${qty} ao carrinho`}
                </Button>
                {added && (
                  <Button size="lg" variant="outline" onClick={() => navigate('/carrinho')}>
                    Ver carrinho
                  </Button>
                )}
              </div>
            )}

            {/* Descrição */}
            {product.description && (
              <div className="border-t pt-4">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Descrição
                </h2>
                {hasRichText ? (
                  <div
                    className="text-sm leading-relaxed text-muted-foreground [&_a]:text-primary [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_strong]:font-semibold [&_img]:max-w-full [&_img]:rounded-md"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }}
                  />
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {product.description}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}