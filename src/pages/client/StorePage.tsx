import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockProducts, mockCategories } from '../../data/mock';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardFooter } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Separator } from '../../components/ui/separator';

import { Search, ShoppingCart, Plus, Package, Minus, Check, SlidersHorizontal, X } from 'lucide-react';
import { formatCurrency } from '../../lib/format';
import { toast } from 'sonner';
import type { Product } from '../../types';

type SortOption = 'relevance' | 'price-asc' | 'price-desc' | 'name-asc';

export default function StorePage() {
  const { addItem, count } = useCart();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [showFilters, setShowFilters] = useState(false);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [detailQty, setDetailQty] = useState(1);
  const [cardQty, setCardQty] = useState<Record<string, number>>({});

  const categories = ['Todos', ...mockCategories];

  const filtered = useMemo(() => {
    let result = mockProducts.filter((p) => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase());
      const matchCat = selectedCategory === 'Todos' || p.category === selectedCategory;
      return matchSearch && matchCat && p.active;
    });

    switch (sortBy) {
      case 'price-asc':
        result = [...result].sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        result = [...result].sort((a, b) => b.price - a.price);
        break;
      case 'name-asc':
        result = [...result].sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return result;
  }, [search, selectedCategory, sortBy]);

  const handleAddToCart = (product: Product, qty = 1) => {
    addItem(product, qty);
    toast.success(`${product.name} adicionado ao carrinho!`);
  };

  const getCardQty = (productId: string) => cardQty[productId] || 1;
  const setQty = (productId: string, qty: number, stock: number) => {
    setCardQty((prev) => ({ ...prev, [productId]: Math.max(1, Math.min(qty, stock)) }));
  };

  const addFromCard = (product: Product) => {
    handleAddToCart(product, getCardQty(product.id));
    setCardQty((prev) => ({ ...prev, [product.id]: 1 }));
  };

  const openDetail = (product: Product) => {
    setDetailProduct(product);
    setDetailQty(1);
  };

  const addFromDetail = () => {
    if (detailProduct) {
      handleAddToCart(detailProduct, detailQty);
      setDetailProduct(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Vitrine</h1>
        <p className="text-muted-foreground mt-1">
          Olá, <strong>{currentUser?.name.split(' ')[0]}</strong>! Explore nosso catálogo de produtos.
        </p>
      </div>

      {/* Search + Sort + Cart */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou SKU..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="sm:hidden"
          >
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            Filtros
          </Button>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="relevance">Relevância</option>
            <option value="price-asc">Menor preço</option>
            <option value="price-desc">Maior preço</option>
            <option value="name-asc">Nome A-Z</option>
          </select>
          <Button onClick={() => navigate('/carrinho')} className="sm:hidden">
            <ShoppingCart className="w-4 h-4 mr-2" />
            ({count})
          </Button>
        </div>
      </div>

      {/* Category Tabs - Desktop */}
      <div className={`${showFilters ? 'flex' : 'hidden'} sm:flex flex-wrap gap-2 mb-6`}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              selectedCategory === cat
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground mb-4">
        {filtered.length} produto{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* Product Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">Nenhum produto encontrado</h3>
          <p className="text-sm text-muted-foreground/70 mt-1">Tente ajustar seus filtros de busca</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((product) => (
            <Card
              key={product.id}
              className="group hover:shadow-md transition-all overflow-hidden flex flex-col cursor-pointer"
              onClick={() => openDetail(product)}
            >
              {/* Product Image */}
              <div className="aspect-square bg-gradient-to-br from-muted/50 to-muted/30 flex items-center justify-center relative overflow-hidden">
                <div className="w-16 h-16 text-muted-foreground/20 transition-transform group-hover:scale-110">
                  <Package className="w-full h-full" />
                </div>
                <Badge className="absolute top-2 left-2 text-[10px]" variant="secondary">
                  {product.category}
                </Badge>
                {product.stock <= 5 && product.stock > 0 && (
                  <Badge className="absolute top-2 right-2 text-[10px] bg-amber-500 text-white">
                    Últimas unidades
                  </Badge>
                )}
                {product.stock === 0 && (
                  <Badge className="absolute top-2 right-2 text-[10px] bg-destructive text-white">
                    Esgotado
                  </Badge>
                )}
              </div>

              <CardContent className="p-3 flex-1 flex flex-col">
                <p className="text-[10px] text-muted-foreground font-mono mb-1">{product.sku}</p>
                <h3 className="font-medium text-sm leading-tight line-clamp-2 mb-1">
                  {product.name}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                  {product.description}
                </p>
                <div className="mt-auto">
                  <span className="text-lg font-bold text-primary">
                    {formatCurrency(product.price)}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {product.stock > 0 ? `${product.stock} em estoque` : 'Indisponível'}
                  </p>
                </div>
              </CardContent>

              <CardFooter className="p-3 pt-0 flex-col gap-2">
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs text-muted-foreground">Qtd:</span>
                  <div className="flex items-center gap-1 border rounded-md">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7"
                      disabled={product.stock === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setQty(product.id, getCardQty(product.id) - 1, product.stock);
                      }}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <input
                      type="number"
                      className="w-10 text-center text-sm font-medium border-0 bg-transparent outline-none"
                      value={getCardQty(product.id)}
                      min={1}
                      max={product.stock}
                      disabled={product.stock === 0}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const v = parseInt(e.target.value) || 1;
                        setQty(product.id, v, product.stock);
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7"
                      disabled={product.stock === 0 || getCardQty(product.id) >= product.stock}
                      onClick={(e) => {
                        e.stopPropagation();
                        setQty(product.id, getCardQty(product.id) + 1, product.stock);
                      }}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                {getCardQty(product.id) >= product.stock && product.stock > 0 && (
                  <p className="text-[10px] text-amber-600 font-medium w-full text-center">
                    Limite de estoque atingido
                  </p>
                )}
                <Button
                  className="w-full"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    addFromCard(product);
                  }}
                  disabled={product.stock === 0}
                >
                  <ShoppingCart className="w-4 h-4 mr-1" />
                  Adicionar · {formatCurrency(product.price * getCardQty(product.id))}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Product Detail Dialog */}
      <Dialog open={!!detailProduct} onOpenChange={(open) => !open && setDetailProduct(null)}>
        {detailProduct && (
          <DialogContent className="max-w-3xl p-0 overflow-hidden">
            <DialogHeader className="sr-only">
              <DialogTitle>{detailProduct.name}</DialogTitle>
            </DialogHeader>
            <div className="grid sm:grid-cols-2 gap-0">
              {/* Image side */}
              <div className="aspect-square bg-gradient-to-br from-muted/50 to-muted/30 flex items-center justify-center relative">
                <div className="w-24 h-24 text-muted-foreground/20">
                  <Package className="w-full h-full" />
                </div>
                <Badge className="absolute top-3 left-3" variant="secondary">
                  {detailProduct.category}
                </Badge>
              </div>

              {/* Info side */}
              <div className="p-6 flex flex-col">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground font-mono mb-2">
                    SKU: {detailProduct.sku}
                  </p>
                  <h2 className="text-xl font-bold leading-tight mb-2">
                    {detailProduct.name}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    {detailProduct.description}
                  </p>
                  <Separator className="my-4" />
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Categoria</span>
                      <span className="font-medium">{detailProduct.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Disponibilidade</span>
                      {detailProduct.stock > 0 ? (
                        <span className="font-medium text-emerald-600 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          {detailProduct.stock} em estoque
                        </span>
                      ) : (
                        <span className="font-medium text-destructive">Esgotado</span>
                      )}
                    </div>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Preço unitário</p>
                      <span className="text-2xl font-bold text-primary">
                        {formatCurrency(detailProduct.price)}
                      </span>
                    </div>
                    {detailProduct.stock > 0 && (
                      <div className="flex items-center gap-2 border rounded-md">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8"
                          onClick={() => setDetailQty((q) => Math.max(1, q - 1))}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">{detailQty}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8"
                          onClick={() => setDetailQty((q) => Math.min(detailProduct.stock, q + 1))}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={addFromDetail}
                    disabled={detailProduct.stock === 0}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Adicionar ao carrinho · {formatCurrency(detailProduct.price * detailQty)}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
