import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
  useMemo,
} from 'react';
import type { Cart, CartItem, Product, ProductPage } from '../types/api';
import { api } from '../lib/api';
import { useAuth, resolveProfile } from './AuthContext';

interface CartContextValue {
  items: CartItem[];
  /** Produtos conhecidos (usados p/ enriquecer nome/imagem dos itens). */
  productMap: Record<string, Product>;
  total: number;
  /** Nº de PRODUTOS distintos no carrinho (não a soma de unidades). */
  count: number;
  /** Regras de compra da empresa (do GET /cart). */
  minOrderValue: number | null;
  minOrderQuantity: number | null;
  isLoading: boolean;
  registerProduct: (product: Product) => void;
  addItem: (productId: string, quantity: number) => Promise<void>;
  updateQty: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => void;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [productMap, setProductMap] = useState<Record<string, Product>>({});
  // ✅ NOVO: regras de compra da empresa (mínimo em valor e/ou quantidade).
  const [minOrderValue, setMinOrderValue] = useState<number | null>(null);
  const [minOrderQuantity, setMinOrderQuantity] = useState<number | null>(null);

  const registerProduct = useCallback((product: Product) => {
    setProductMap((prev) => (prev[product.id] ? prev : { ...prev, [product.id]: product }));
  }, []);

  // Carrega o carrinho do cliente autenticado (GET /cart).
  const loadCart = useCallback(async () => {
    if (!user || resolveProfile(user) !== 'cliente') {
      setItems([]);
      setTotal(0);
      setMinOrderValue(null);
      setMinOrderQuantity(null);
      return;
    }
    setIsLoading(true);
    try {
      const cart = await api.get<Cart>('/cart');
      setItems(cart.items);
      setTotal(cart.total);
      // ✅ NOVO: lê as regras de compra da empresa (opcionais).
      setMinOrderValue(cart.min_order_value != null ? Number(cart.min_order_value) : null);
      setMinOrderQuantity(cart.min_order_quantity != null ? Number(cart.min_order_quantity) : null);
      // Enriquece com produtos (o CartItem da API não traz nome/imagem).
      if (cart.items.length > 0) {
        try {
          const catalog = await api.get<ProductPage>('/catalog/products', {
            page: 1,
            page_size: 100,
          });
          const map: Record<string, Product> = {};
          for (const p of catalog.items) map[p.id] = p;
          setProductMap((prev) => ({ ...prev, ...map }));
        } catch {
          // Falha de enriquecimento não derruba o carrinho.
        }
      }
    } catch {
      setItems([]);
      setTotal(0);
      setMinOrderValue(null);
      setMinOrderQuantity(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Boot: carrega quando o usuário é cliente; limpa quando não é.
  useEffect(() => {
    if (!user) {
      setItems([]);
      setTotal(0);
      setMinOrderValue(null);
      setMinOrderQuantity(null);
      return;
    }
    loadCart();
  }, [user, loadCart]);

  const refresh = useCallback(() => loadCart(), [loadCart]);

  // Adiciona item → backend valida produto/quantidade E recalcula o preço.
  const addItem = useCallback(async (productId: string, quantity: number) => {
    const qty = Math.max(1, Math.floor(quantity));
    await api.post('/cart/items', { product_id: productId, quantity: qty });
    await loadCart();
  }, [loadCart]);

  const updateQty = useCallback(async (itemId: string, quantity: number) => {
    const qty = Math.max(1, Math.floor(quantity));
    await api.patch(`/cart/items/${itemId}`, { quantity: qty });
    await loadCart();
  }, [loadCart]);

  const removeItem = useCallback(async (itemId: string) => {
    await api.delete(`/cart/items/${itemId}`);
    await loadCart();
  }, [loadCart]);

  const clearCart = useCallback(() => {
    setItems([]);
    setTotal(0);
    setMinOrderValue(null);
    setMinOrderQuantity(null);
  }, []);

  // ✅ BUG 8 corrigido: badge = quantidade de PRODUTOS, não de unidades.
  // (1 produto com 50 unidades → badge mostra 1, não 50)
  const count = useMemo(() => items.length, [items]);

  const value: CartContextValue = {
    items,
    productMap,
    total,
    count,
    minOrderValue,
    minOrderQuantity,
    isLoading,
    registerProduct,
    addItem,
    updateQty,
    removeItem,
    clearCart,
    refresh,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}