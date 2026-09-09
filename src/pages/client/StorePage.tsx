import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Minus, Package, Plus, Search, ShoppingCart } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { isSafeImageUrl } from '../../lib/uploads';
import type { Category, PriceQuote, Product } from '@/types/api';
import { formatCurrency } from '../../lib/format';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';

type SortOption = 'relevance' | 'price-asc' | 'price-desc' | 'name-asc';
const PAGE_SIZE = 60;

/** Estoques são sempre INTEIROS (10, nunca "10.000"). */
const stockOf = (p: Product | null | undefined): number => {
  if (!p) return 0;
  const v = Number(p.stock);
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.trunc(v));
};

/* Chip de estoque legível em Light e Dark (fundo invertido ao foreground). */
function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full bg-destructive px-2 py-0.5 text-xs font-medium text-white">
        Esgotado
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-foreground px-2 py-0.5 text-xs font-medium text-background">
      {stock} em estoque
    </span>
  );
}

/** Product + campos de preço calculado que o backend anexa na listagem. */
type StoreProduct = Product & {
  customer_price?: number | null;
  final_price?: number | null;
  price_source?: 'customer' | 'price_list' | 'default' | null;
};

/** Interpreta o preço do card: tem preço especial? (De/Por) */
const priceInfo = (p: StoreProduct) => {
  const base = Number(p.price);
  const final = p.final_price != null ? Number(p.final_price) : base;
  const isSpecial =
    p.price_source === 'customer' &&
    final > 0 &&
    Math.abs(final - base) > 0.001;
  return { base, final, isSpecial };
};

/** Selo "Preço especial" — legível em Light e Dark (fundo invertido). */
function SpecialBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-semibold text-background">
      Preço especial
    </span>
  );
}

interface StorePageData {
  items: StoreProduct[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export default function StorePage() {
  const { user } = useAuth();
  const { addItem, registerProduct } = useCart();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [detailProduct, setDetailProduct] = useState<StoreProduct | null>(null);
  const [detailQuote, setDetailQuote] = useState<PriceQuote | null>(null);
  const [detailQty, setDetailQty] = useState(1);
  const [adding, setAdding] = useState(false);
  // Quantidade por produto no CARD (como ecommerce) — default 1.
  const [qtys, setQtys] = useState<Record<string, number>>({});

  const firstName = user?.full_name?.trim().split(' ')[0] || 'visitante';
  const qtyOf = (productId: string) => qtys[productId] ?? 1;
  const setQty = (productId: string, qty: number) =>
    setQtys((prev) => ({ ...prev, [productId]: qty }));

  // Debounce da busca (evita flood).
  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  // Categorias.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await api.get<Category[]>('/catalog/categories');
        if (active) setCategories(data);
      } catch {
        // Sem categorias → filtro único "Todos".
      }
    })();
    return () => { active = false; };
  }, []);

  // Produtos (backend filtra/ordena e anexa o preço especial do cliente).
  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const sortParams =
        sortBy === 'price-asc' ? { sort_by: 'price', sort_dir: 'asc' }
        : sortBy === 'price-desc' ? { sort_by: 'price', sort_dir: 'desc' }
        : sortBy === 'name-asc' ? { sort_by: 'name', sort_dir: 'asc' }
        : {};
      const data = await api.get<StorePageData>('/catalog/products', {
        page: 1,
        page_size: PAGE_SIZE,
        search: searchDebounced || undefined,
        category_id: selectedCategory || undefined,
        // O backend FORÇA o customer_id do próprio cliente (anti-vazamento)
        customer_id: user?.customer_id ?? undefined,
        ...sortParams,
      });
      setProducts(data.items);
      data.items.forEach(registerProduct);
    } catch {
      toast.error('Não foi possível carregar os produtos.');
    } finally {
      setLoading(false);
    }
  }, [searchDebounced, selectedCategory, sortBy, user?.customer_id, registerProduct]);
  useEffect(() => { loadProducts(); }, [loadProducts]);

  const handleAdd = async (product: Product, qty: number) => {
    setAdding(true);
    try {
      await addItem(product.id, qty);
      registerProduct(product);
      toast.success(`${qty}× ${product.name} adicionado ao carrinho.`);
      setDetailProduct(null);
      setQtys((prev) => ({ ...prev, [product.id]: 1 }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao adicionar ao carrinho.');
    } finally {
      setAdding(false);
    }
  };

  const openDetail = async (product: Product) => {
    setDetailProduct(product);
    setDetailQuote(null);
    setDetailQty(1);
    if (user?.customer_id) {
      try {
        const quote = await api.get<PriceQuote>(
          `/catalog/products/${product.id}/quote`,
          { customer_id: user.customer_id },
        );
        setDetailQuote(quote);
      } catch {
        // Sem preço negociado → usa o preço padrão.
      }
    }
  };

  const priceOf = (p: Product) => {
    const q = detailProduct?.id === p.id ? detailQuote : null;
    return Number(q?.final_price ?? q?.customer_price ?? p.price);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Vitrine</h1>
        <p className="mt-1 text-muted-foreground">
          Olá, <strong>{firstName}</strong>! Explore o catálogo de produtos.
        </p>
      </div>

      {/* Filtros */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar produto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={selectedCategory || 'all'}
          onValueChange={(v) => setSelectedCategory(v === 'all' ? '' : v)}
        >
          <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">Relevância</SelectItem>
            <SelectItem value="price-asc">Menor preço</SelectItem>
            <SelectItem value="price-desc">Maior preço</SelectItem>
            <SelectItem value="name-asc">Nome (A–Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="py-16 text-center text-muted-foreground">Carregando produtos…</p>
      ) : products.length === 0 ? (
        <div className="py-20 text-center">
          <Package className="mx-auto mb-4 h-16 w-16 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold text-muted-foreground">Nenhum produto encontrado</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((p) => {
            const stock = stockOf(p);
            const out = stock <= 0;
            const qty = Math.min(qtyOf(p.id), Math.max(1, stock));
            const { base, final, isSpecial } = priceInfo(p);
            return (
              <Card key={p.id} className="flex flex-col overflow-hidden">
                <button
                  type="button"
                  className="flex h-36 w-full items-center justify-center overflow-hidden bg-muted/50"
                  onClick={() => openDetail(p)}
                >
                  {isSafeImageUrl(p.image_url) ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-full w-full object-cover transition-transform hover:scale-105"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                  ) : (
                    <Package className="h-10 w-10 text-muted-foreground/60" />
                  )}
                </button>
                <CardContent className="flex flex-1 flex-col gap-2 p-3">
                  <button type="button" className="text-left" onClick={() => openDetail(p)}>
                    <h3 className="line-clamp-2 font-semibold leading-tight">{p.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {p.brand ?? ''}{p.unit ? ` · ${p.unit}` : ''}
                    </p>
                  </button>

                  {/* ✅ Preço do card: "De X" riscado → "Por Y" + selo, quando especial */}
                  <div className="flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      {isSpecial ? (
                        <>
                          <span className="block text-xs leading-none text-muted-foreground line-through">
                            De {formatCurrency(base)}
                          </span>
                          <span className="mt-0.5 block text-lg font-bold leading-none">
                            Por {formatCurrency(final)}
                          </span>
                          <span className="mt-1 block">
                            <SpecialBadge />
                          </span>
                        </>
                      ) : (
                        <span className="block text-lg font-bold leading-none">
                          {formatCurrency(base)}
                        </span>
                      )}
                    </div>
                    {/* ✅ Estoque SEMPRE inteiro e visível no card (contraste Light/Dark) */}
                    <StockBadge stock={stock} />
                  </div>

                  {/* ✅ Stepper de quantidade no card (como ecommerce) */}
                  {!out && (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          disabled={qty <= 1}
                          onClick={() => setQty(p.id, qty - 1)}
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
                          onChange={(e) => {
                            const v = Math.max(1, Math.min(stock, Math.trunc(Number(e.target.value) || 1)));
                            setQty(p.id, v);
                          }}
                          className="h-8 w-14 text-center"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          disabled={qty >= stock}
                          onClick={() => setQty(p.id, qty + 1)}
                          aria-label="Aumentar"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        disabled={adding}
                        onClick={() => handleAdd(p, qty)}
                        aria-label={`Adicionar ${qty} ao carrinho`}
                      >
                        <ShoppingCart className="mr-1 h-4 w-4" />
                        {qty}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detalhe + cotação */}
      <Dialog open={!!detailProduct} onOpenChange={(o) => { if (!o) { setDetailProduct(null); setDetailQuote(null); } }}>
        <DialogContent className="max-w-md">
          {detailProduct && (
            <>
              <DialogHeader><DialogTitle>{detailProduct.name}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  {isSafeImageUrl(detailProduct.image_url) ? (
                    <img
                      src={detailProduct.image_url}
                      alt={detailProduct.name}
                      className="h-24 w-24 rounded object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded bg-muted/50">
                      <Package className="h-8 w-8 text-muted-foreground/60" />
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {detailProduct.brand ?? '—'} · {detailProduct.unit ?? 'un'}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {detailProduct.brand && <Badge variant="secondary">{detailProduct.brand}</Badge>}
                      {detailProduct.unit && <Badge variant="secondary">{detailProduct.unit}</Badge>}
                      <StockBadge stock={stockOf(detailProduct)} />
                    </div>
                    {/* ✅ "De X" riscado no detalhe quando há preço negociado */}
                    {detailQuote?.customer_price != null && (
                      <p className="text-xs text-muted-foreground line-through">
                        De {formatCurrency(Number(detailQuote.base_price) * detailQty)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {detailQuote ? (detailQuote.customer_price !== null ? 'Preço negociado' : 'Preço de tabela') : 'Preço padrão'}
                      {detailQuote?.customer_price != null && ' · Preço especial'}
                    </p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(priceOf(detailProduct) * detailQty)}
                    </p>
                  </div>
                </div>
                {/* Stepper de quantidade no detalhe */}
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Quantidade</Label>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      disabled={detailQty <= 1}
                      onClick={() => setDetailQty((q) => Math.max(1, q - 1))}
                      aria-label="Diminuir"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      max={Math.max(1, stockOf(detailProduct))}
                      step={1}
                      value={detailQty}
                      onChange={(e) =>
                        setDetailQty(Math.max(1, Math.min(Math.max(1, stockOf(detailProduct)), Math.trunc(Number(e.target.value) || 1))))
                      }
                      className="h-9 w-20 text-center"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      disabled={stockOf(detailProduct) > 0 && detailQty >= stockOf(detailProduct)}
                      onClick={() => setDetailQty((q) => q + 1)}
                      aria-label="Aumentar"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  className="w-full"
                  disabled={stockOf(detailProduct) <= 0 || adding}
                  onClick={() => handleAdd(detailProduct, detailQty)}
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {adding ? 'Adicionando…' : `Adicionar ${detailQty} ao carrinho`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}