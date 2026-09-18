import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, Minus, Package, Plus, Search, ShoppingCart,
  Building2, FileText,
} from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useBranding } from '../../lib/useBranding';
import { isSafeImageUrl } from '../../lib/uploads';
import type { Category, Company, Product } from '@/types/api';
import { formatCurrency } from '../../lib/format';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { cn } from '../../lib/utils';

type SortOption = 'relevance' | 'price-asc' | 'price-desc' | 'name-asc';

// ✅ Paginação da vitrine: 50 produtos por página.
const PAGE_SIZE = 50;
// ✅ Quantos números de página mostrar ao redor da página atual (janela).
const PAGE_WINDOW = 2;

/** Estoques são sempre INTEIROS (10, nunca "10.000"). */
const stockOf = (p: Product | null | undefined): number => {
  if (!p) return 0;
  const v = Number(p.stock);
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.trunc(v));
};

/** Selo de estoque — legível em Light e Dark (fundo invertido). */
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

/** ✅ Janela de números de página (ex.: [1 … 3 4 5 6 7 … 20]). */
const pageWindow = (current: number, total: number): (number | '…')[] => {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, total]);
  for (let p = current - PAGE_WINDOW; p <= current + PAGE_WINDOW; p++) {
    if (p >= 1 && p <= total) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('…');
    out.push(p);
    prev = p;
  }
  return out;
};

interface StorePageData {
  items: StoreProduct[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export default function StorePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem, registerProduct } = useCart();
  const { branding } = useBranding();

  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [adding, setAdding] = useState(false);
  const [companyData, setCompanyData] = useState<Company | null>(null);

  // ✅ Paginação.
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  // ✅ Campo "Ir para página".
  const [jumpTo, setJumpTo] = useState('');

  // Quantidade por produto no CARD (como ecommerce) — default 1.
  const [qtys, setQtys] = useState<Record<string, number>>({});

  const firstName = user?.full_name?.trim().split(' ')[0] || 'visitante';
  const qtyOf = (productId: string) => qtys[productId] ?? 1;
  const setQty = (productId: string, qty: number) =>
    setQtys((prev) => ({ ...prev, [productId]: qty }));

  // Busca dados completos da empresa (CNPJ)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await api.get<{ items: Company[] }>('/companies', { page_size: 1 });
        if (active && data.items?.length > 0) {
          setCompanyData(data.items[0]);
        }
      } catch {
        // Sem acesso à listagem → usa apenas branding
      }
    })();
    return () => { active = false; };
  }, []);

  // Debounce da busca (evita flood).
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // ✅ Mantém o campo "Ir para página" sincronizado com a página atual.
  useEffect(() => {
    setJumpTo(String(page));
  }, [page]);

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

  // Produtos (backend filtra/ordena, pagina e anexa o preço especial do cliente).
  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const sortParams =
        sortBy === 'price-asc' ? { sort_by: 'price', sort_dir: 'asc' }
        : sortBy === 'price-desc' ? { sort_by: 'price', sort_dir: 'desc' }
        : sortBy === 'name-asc' ? { sort_by: 'name', sort_dir: 'asc' }
        : {};
      const data = await api.get<StorePageData>('/catalog/products', {
        page,                       // ✅ página atual
        page_size: PAGE_SIZE,       // ✅ 50 por página
        search: searchDebounced || undefined,
        category_id: selectedCategory || undefined,
        // O backend FORÇA o customer_id do próprio cliente (anti-vazamento)
        customer_id: user?.customer_id ?? undefined,
        ...sortParams,
      });
      setProducts(data.items);
      setTotal(data.total);
      setPages(data.pages || 1);
      data.items.forEach(registerProduct);
    } catch {
      toast.error('Não foi possível carregar os produtos.');
    } finally {
      setLoading(false);
    }
  }, [page, searchDebounced, selectedCategory, sortBy, user?.customer_id, registerProduct]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  // ✅ Ir para uma página específica (valida entre 1 e pages).
  const goToPage = (target: number) => {
    if (Number.isNaN(target)) return;
    const clamped = Math.max(1, Math.min(pages, Math.trunc(target)));
    setPage(clamped);
  };
  const handleJump = (e: React.FormEvent) => {
    e.preventDefault();
    goToPage(Number(jumpTo));
  };

  const handleAdd = async (product: Product, qty: number) => {
    setAdding(true);
    try {
      await addItem(product.id, qty);
      registerProduct(product);
      toast.success(`${qty}× ${product.name} adicionado ao carrinho.`);
      setQtys((prev) => ({ ...prev, [product.id]: 1 }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao adicionar ao carrinho.');
    } finally {
      setAdding(false);
    }
  };

  // ✅ Clique no card → PÁGINA de produto (e-commerce), não mais modal.
  const openProduct = (productId: string) => navigate(`/loja/produto/${productId}`);

  const companyName = branding?.name ?? 'nydB2B';
  const companyCnpj = companyData?.cnpj ?? null;
  const primaryColor = branding?.primary_color ?? '#1976D2';

  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Conteúdo principal (Vitrine) ── */}
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        {/* Header da página */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Vitrine</h1>
          <p className="mt-1 text-muted-foreground">
            Olá, <strong>{firstName}</strong>! Explore o catálogo de produtos.
          </p>
        </div>

        {/* ── Faixa de CATEGORIAS (quadrada, cara de e-commerce) ── */}
        {categories.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Compre por categoria
            </h2>
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button
                type="button"
                onClick={() => { setSelectedCategory(''); setPage(1); }}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-md border px-5 py-2.5 text-sm font-medium transition-colors',
                  selectedCategory === ''
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                Todas as categorias
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setSelectedCategory(c.id); setPage(1); }}
                  className={cn(
                    'shrink-0 whitespace-nowrap rounded-md border px-5 py-2.5 text-sm font-medium transition-colors',
                    selectedCategory === c.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filtros — ✅ trocar filtro/busca/ordenação volta para a página 1 */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar produto…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => { setSortBy(v as SortOption); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Relevância</SelectItem>
              <SelectItem value="price-asc">Menor preço</SelectItem>
              <SelectItem value="price-desc">Maior preço</SelectItem>
              <SelectItem value="name-asc">Nome (A–Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Contador de resultados */}
        {!loading && products.length > 0 && (
          <p className="mb-4 text-sm text-muted-foreground">
            {total} {total === 1 ? 'produto' : 'produtos'} encontrados
          </p>
        )}

        {loading ? (
          <p className="py-16 text-center text-muted-foreground">Carregando produtos…</p>
        ) : products.length === 0 ? (
          <div className="py-20 text-center">
            <Package className="mx-auto mb-4 h-16 w-16 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold text-muted-foreground">Nenhum produto encontrado</h3>
          </div>
        ) : (
          <>
            {/* ✅ 4 produtos por fileira no máximo (desktop) — cards maiores */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((p) => {
                const stock = stockOf(p);
                const out = stock <= 0;
                const qty = Math.min(qtyOf(p.id), Math.max(1, stock));
                const { base, final, isSpecial } = priceInfo(p);
                return (
                  <Card
                    key={p.id}
                    className="group flex flex-col overflow-hidden transition-shadow hover:shadow-lg"
                  >
                    {/* Imagem — object-contain mostra a foto INTEIRA (não corta) */}
                    <button
                      type="button"
                      className="relative flex h-48 w-full items-center justify-center overflow-hidden bg-muted/50"
                      onClick={() => openProduct(p.id)}
                    >
                      {isSafeImageUrl(p.image_url) ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                      ) : (
                        <Package className="h-12 w-12 text-muted-foreground/60" />
                      )}
                      {/* Selo de estoque sobre a imagem */}
                      <span className="absolute left-2 top-2">
                        <StockBadge stock={stock} />
                      </span>
                    </button>

                    <CardContent className="flex flex-1 flex-col gap-2 p-4">
                      {/* Nome do produto */}
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => openProduct(p.id)}
                      >
                        <span className="line-clamp-2 font-semibold text-foreground transition-colors group-hover:text-primary">
                          {p.name}
                        </span>
                      </button>

                      {/* Marca / unidade */}
                      {(p.brand || p.unit) && (
                        <p className="text-xs text-muted-foreground">
                          {[p.brand, p.unit].filter(Boolean).join(' · ')}
                        </p>
                      )}

                      {/* Preço: De/Por com selo de preço especial */}
                      <div className="mt-auto flex items-end justify-between gap-2 pt-1">
                        <div className="flex flex-col">
                          {isSpecial && (
                            <span className="text-sm text-muted-foreground line-through">
                              {formatCurrency(base)}
                            </span>
                          )}
                          <span className={cn(
                            'text-lg font-bold',
                            isSpecial ? 'text-primary' : 'text-foreground',
                          )}>
                            {formatCurrency(final)}
                          </span>
                          {isSpecial && <SpecialBadge />}
                        </div>
                      </div>

                      {/* Seletor de quantidade + Adicionar */}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={out || qty <= 1}
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
                            disabled={out}
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
                            disabled={out || qty >= stock}
                            onClick={() => setQty(p.id, qty + 1)}
                            aria-label="Aumentar"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          disabled={adding || out}
                          onClick={() => handleAdd(p, qty)}
                          aria-label={`Adicionar ${qty} ao carrinho`}
                        >
                          <ShoppingCart className="mr-1 h-4 w-4" />
                          {qty}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Paginação */}
            {pages > 1 && (
              <div className="mt-8 flex flex-col items-center justify-between gap-4 sm:flex-row">
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={page <= 1}
                    onClick={() => goToPage(page - 1)}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {pageWindow(page, pages).map((p, i) =>
                    p === '…' ? (
                      <span key={`e-${i}`} className="px-1 text-muted-foreground">…</span>
                    ) : (
                      <Button
                        key={p}
                        variant={p === page ? 'default' : 'outline'}
                        size="icon"
                        onClick={() => goToPage(p)}
                      >
                        {p}
                      </Button>
                    ),
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={page >= pages}
                    onClick={() => goToPage(page + 1)}
                    aria-label="Próxima página"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <form onSubmit={handleJump} className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Ir para</span>
                  <Input
                    type="number"
                    min={1}
                    max={pages}
                    value={jumpTo}
                    onChange={(e) => setJumpTo(e.target.value)}
                    className="h-9 w-20 text-center"
                  />
                  <Button type="submit" variant="outline" size="sm">Ir</Button>
                </form>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── FOOTER (rodapé) — informações da empresa, estilo e-commerce ── */}
      <footer
        className="mt-8 w-full text-white"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="mx-auto max-w-7xl px-4 py-10">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            {/* Razão Social */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Building2 className="h-5 w-5 opacity-80" />
                <h3 className="text-sm font-bold uppercase tracking-wide">Empresa</h3>
              </div>
              <p className="text-base font-semibold">{companyName}</p>
            </div>
            {/* CNPJ */}
            {companyCnpj && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5 opacity-80" />
                  <h3 className="text-sm font-bold uppercase tracking-wide">CNPJ</h3>
                </div>
                <p className="text-base font-semibold">{companyCnpj}</p>
              </div>
            )}
          </div>
        </div>
        {/* Barra inferior */}
        <div className="border-t border-white/20 py-4">
          <p className="text-center text-xs opacity-70">
            &copy; {new Date().getFullYear()} {companyName}. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}