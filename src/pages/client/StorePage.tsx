import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Package, Search, ShoppingCart } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { isSafeImageUrl } from '../../lib/uploads';
import type { Category, PriceQuote, Product, ProductPage } from '@/types/api';
import { formatCurrency } from '../../lib/format';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';

type SortOption = 'relevance' | 'price-asc' | 'price-desc' | 'name-asc';

const PAGE_SIZE = 60;

export default function StorePage() {
  const { user } = useAuth();
  const { addItem, registerProduct } = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('relevance');

  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [detailQuote, setDetailQuote] = useState<PriceQuote | null>(null);
  const [detailQty, setDetailQty] = useState(1);
  const [adding, setAdding] = useState(false);

  const firstName = user?.full_name?.trim().split(' ')[0] || 'visitante';

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

  // Produtos (backend filtra/ordena; preço negociado é recalculado pelo backend).
  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const sortParams =
        sortBy === 'price-asc' ? { sort_by: 'price', sort_dir: 'asc' }
        : sortBy === 'price-desc' ? { sort_by: 'price', sort_dir: 'desc' }
        : sortBy === 'name-asc' ? { sort_by: 'name', sort_dir: 'asc' }
        : {};
      const data = await api.get<ProductPage>('/catalog/products', {
        page: 1,
        page_size: PAGE_SIZE,
        search: searchDebounced || undefined,
        category_id: selectedCategory || undefined,
        ...sortParams,
      });
      setProducts(data.items);
      data.items.forEach(registerProduct);
    } catch {
      toast.error('Não foi possível carregar a vitrine.');
    } finally {
      setLoading(false);
    }
  }, [searchDebounced, selectedCategory, sortBy, registerProduct]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const handleAdd = async (product: Product, qty: number) => {
    setAdding(true);
    try {
      await addItem(product.id, qty);
      registerProduct(product);
      toast.success(`${product.name} adicionado ao carrinho.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao adicionar ao carrinho.');
    } finally {
      setAdding(false);
    }
  };

  // Ao abrir o detalhe, consulta o preço negociado do cliente (se houver customer_id).
  const openDetail = async (product: Product) => {
    setDetailProduct(product);
    setDetailQuote(null);
    setDetailQty(1);
    if (user?.customer_id) {
      try {
        const quote = await api.get<PriceQuote>(
          `/catalog/products/${product.id}/quote`,
          { customer_id: user.customer_id }
        );
        setDetailQuote(quote);
      } catch {
        setDetailQuote(null); // segue com preço padrão; backend valida no carrinho
      }
    }
  };

  // Disponibilidade do produto em detalhe (escopo do dialog).
  const unavailable = detailProduct ? (detailProduct.stock ?? 0) <= 0 : false;

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
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar produtos…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-56">
          <Select value={selectedCategory || 'all'} onValueChange={(v) => setSelectedCategory(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Todas as categorias" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-56">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Mais relevantes</SelectItem>
              <SelectItem value="price-asc">Menor preço</SelectItem>
              <SelectItem value="price-desc">Maior preço</SelectItem>
              <SelectItem value="name-asc">Nome (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <p className="py-16 text-center text-muted-foreground">Carregando produtos…</p>
      ) : products.length === 0 ? (
        <div className="py-16 text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <h3 className="text-lg font-semibold text-muted-foreground">Nenhum produto encontrado</h3>
          <p className="mt-1 text-sm text-muted-foreground/70">Tente ajustar a busca ou os filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((p) => {
            const out = (p.stock ?? 0) <= 0;
            return (
              <Card
                key={p.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => openDetail(p)}
              >
                <CardContent className="flex h-full flex-col p-3">
                  <div className="mb-3 flex h-32 w-full items-center justify-center overflow-hidden rounded-md bg-muted/50">
                    {isSafeImageUrl(p.image_url) ? (
                      <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                    ) : (
                      <Package className="h-8 w-8 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <p className="line-clamp-2 text-sm font-medium">{p.name}</p>
                    {p.brand && <p className="mt-0.5 text-xs text-muted-foreground">{p.brand}</p>}
                    <div className="mt-2 flex items-end justify-between">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Preço padrão</p>
                        <p className="text-base font-bold">{formatCurrency(p.price)}</p>
                      </div>
                      {p.unit && <span className="text-[10px] text-muted-foreground">{p.unit}</span>}
                    </div>
                    <Button
                      className="mt-3 w-full"
                      size="sm"
                      disabled={out || adding}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAdd(p, 1);
                      }}
                    >
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      {out ? 'Esgotado' : 'Adicionar'}
                    </Button>
                  </div>
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
                <div className="flex h-44 w-full items-center justify-center overflow-hidden rounded-md bg-muted/50">
                  {isSafeImageUrl(detailProduct.image_url) ? (
                    <img src={detailProduct.image_url} alt={detailProduct.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Package className="h-10 w-10 text-muted-foreground/40" />
                  )}
                </div>
                {detailProduct.description && (
                  <p className="text-sm text-muted-foreground">{detailProduct.description}</p>
                )}
                <div className="flex flex-wrap gap-2 text-xs">
                  {detailProduct.sku && <Badge variant="secondary">SKU {detailProduct.sku}</Badge>}
                  {detailProduct.brand && <Badge variant="secondary">{detailProduct.brand}</Badge>}
                  {detailProduct.unit && <Badge variant="secondary">{detailProduct.unit}</Badge>}
                  {detailProduct.stock !== null && detailProduct.stock !== undefined && (
                    <Badge variant={unavailable ? 'destructive' : 'default'}>
                      {unavailable ? 'Esgotado' : `${detailProduct.stock} em estoque`}
                    </Badge>
                  )}
                </div>

                {/* Preço: prioriza a cotação do cliente (backend); senão preço padrão */}
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">
                    {detailQuote && detailQuote.price_source === 'customer'
                      ? 'Preço negociado para o seu perfil'
                      : detailQuote && detailQuote.price_source === 'price_list'
                        ? 'Preço de tabela'
                        : 'Preço padrão'}
                  </p>
                  <p className="text-2xl font-bold">
                    {formatCurrency((detailQuote?.final_price ?? detailProduct.price) * detailQty)}
                  </p>
                  {detailQuote && detailQuote.customer_price !== null &&
                    detailQuote.base_price !== detailQuote.final_price && (
                      <p className="text-xs text-muted-foreground line-through">
                        {formatCurrency(detailQuote.base_price * detailQty)}
                      </p>
                    )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={detailQty <= 1}
                    onClick={() => setDetailQty((q) => Math.max(1, q - 1))}
                    aria-label="Diminuir quantidade"
                  >
                    −
                  </Button>
                  <span className="w-12 text-center text-sm font-medium">{detailQty}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setDetailQty((q) => q + 1)}
                    aria-label="Aumentar quantidade"
                  >
                    +
                  </Button>
                  <Button
                    className="ml-auto"
                    disabled={unavailable || adding}
                    onClick={() => handleAdd(detailProduct, detailQty)}
                  >
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Adicionar ao carrinho
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}