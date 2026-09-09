import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { FileUp, Package, Pencil, Plus, Search, Upload } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import type { Category, Product, ProductPage } from '@/types/api';
import {
  createObjectPreview,
  isSafeImageUrl,
  revokeObjectPreview,
  uploadProductImage,
  validateImageFile,
} from '../../lib/uploads';
import { formatCurrency } from '../../lib/format';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { DescriptionField } from '../../components/DescriptionField';

const PAGE_SIZE = 20;
const NO_CATEGORY = 'none';

/** Estoques são SEMPRE inteiros (10, nunca "10.000"). */
const stockInt = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.trunc(n));
};

/* Chips legíveis em Light e Dark (fundo invertido ao foreground). */
function SkuChip({ sku }: { sku: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-md bg-foreground px-2 py-0.5 font-mono text-xs font-medium text-background">
      {sku}
    </span>
  );
}

function StockChip({ value, unit }: { value: number | null; unit?: string | null }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-md bg-foreground px-2 py-0.5 text-xs font-medium text-background">
      {value} {unit ?? 'un'}
    </span>
  );
}

function StatusChip({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex shrink-0 items-center rounded-full bg-foreground px-2 py-0.5 text-xs font-medium text-background">
      Ativo
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
      Inativo
    </span>
  );
}

interface ProductForm {
  sku: string;
  code: string;
  name: string;
  brand: string;
  category_id: string;
  unit: string;
  price: string;
  stock: string;
  description: string;
}

const emptyForm: ProductForm = {
  sku: '', code: '', name: '', brand: '', category_id: '',
  unit: '', price: '', stock: '', description: '',
};

function PageHeading({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1 text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Debounce da busca.
  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  // Categorias (1x).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await api.get<Category[]>('/catalog/categories');
        if (active) setCategories(data);
      } catch {
        if (active) toast.error('Não foi possível carregar as categorias.');
      }
    })();
    return () => { active = false; };
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<ProductPage>('/catalog/products', {
        page,
        page_size: PAGE_SIZE,
        search: searchDebounced || undefined,
        category_id: categoryFilter || undefined,
      });
      setProducts(data.items);
      setTotal(data.total);
      setPages(data.pages || 1);
    } catch {
      toast.error('Não foi possível carregar os produtos.');
    } finally {
      setLoading(false);
    }
  }, [page, searchDebounced, categoryFilter]);
  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => () => revokeObjectPreview(preview), [preview]);

  const resetForm = () => {
    setForm(emptyForm);
    setFormError(null);
    setImageFile(null);
    setImageError(null);
    setPreview((prev) => { revokeObjectPreview(prev); return null; });
    if (fileRef.current) fileRef.current.value = '';
  };

  const setField = (field: keyof ProductForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      setFormError(null);
    };

  const setDescription = (value: string) => {
    setForm((prev) => ({ ...prev, description: value }));
    setFormError(null);
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImageError(null);
    if (!file) return;
    const invalid = validateImageFile(file);
    if (invalid) {
      setImageError(invalid);
      setImageFile(null);
      setPreview((prev) => { revokeObjectPreview(prev); return null; });
      return;
    }
    setImageFile(file);
    setPreview((prev) => { revokeObjectPreview(prev); return null; });
    setPreview(createObjectPreview(file));
  };

  const validate = (): string | null => {
    if (!form.sku.trim()) return 'Informe o SKU.';
    if (form.sku.trim().length > 80) return 'SKU muito longo (máx. 80).';
    if (!form.name.trim()) return 'Informe o nome do produto.';
    if (form.name.trim().length > 255) return 'Nome muito longo (máx. 255).';
    const price = Number(form.price);
    if (!form.price.trim() || Number.isNaN(price) || price < 0) return 'Informe um preço válido (≥ 0).';
    if (form.stock.trim()) {
      const stock = Number(form.stock);
      if (Number.isNaN(stock) || stock < 0) return 'Estoque inválido (≥ 0).';
    }
    return null;
  };

  const buildPayload = () => ({
    sku: form.sku.trim(),
    code: form.code.trim() || null,
    name: form.name.trim(),
    brand: form.brand.trim() || null,
    category_id: form.category_id || null,
    unit: form.unit.trim() || null,
    price: Number(form.price),
    // ✅ Estoque sempre inteiro (nunca decimal/moeda).
    stock: form.stock.trim() ? stockInt(form.stock) : null,
    description: form.description.trim() || null,
  });

  const persistProduct = async (payload: ReturnType<typeof buildPayload>, productId?: string) => {
    const saved = productId
      ? await api.patch<Product>(`/catalog/products/${productId}`, payload)
      : await api.post<Product>('/catalog/products', payload);
    if (imageFile) {
      try {
        await uploadProductImage(saved.id, imageFile);
        toast.success('Imagem enviada com sucesso.');
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Produto salvo, mas a imagem não pôde ser enviada.');
      }
    }
    return saved;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const invalid = validate();
    if (invalid) { setFormError(invalid); return; }
    setSaving(true);
    setFormError(null);
    try {
      await persistProduct(buildPayload());
      toast.success('Produto cadastrado.');
      setCreateOpen(false);
      resetForm();
      if (page !== 1) setPage(1); else loadProducts();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Erro ao cadastrar produto.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct || saving) return;
    const invalid = validate();
    if (invalid) { setFormError(invalid); return; }
    setSaving(true);
    setFormError(null);
    try {
      await persistProduct(buildPayload(), editProduct.id);
      toast.success('Produto atualizado.');
      setEditProduct(null);
      resetForm();
      loadProducts();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Erro ao atualizar produto.');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setForm({
      sku: p.sku,
      code: p.code ?? '',
      name: p.name,
      brand: p.brand ?? '',
      category_id: p.category_id ?? '',
      unit: p.unit ?? '',
      price: String(p.price),
      stock: p.stock === null || p.stock === undefined ? '' : String(stockInt(p.stock)),
      description: p.description ?? '',
    });
    setFormError(null);
    setImageFile(null);
    setImageError(null);
    setPreview(null);
  };

  return (
    <div>
      <PageHeading
        title="Catálogo"
        description="Gerencie produtos, categorias e disponibilidade."
        action={
          <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Cadastrar produto</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
              <DialogHeader><DialogTitle>Cadastrar produto</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4" noValidate>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU *</Label>
                    <Input id="sku" value={form.sku} onChange={setField('sku')} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="code">Código (opcional)</Label>
                    <Input id="code" value={form.code} onChange={setField('code')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input id="name" value={form.name} onChange={setField('name')} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="brand">Marca</Label>
                    <Input id="brand" value={form.brand} onChange={setField('brand')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Select
                      value={form.category_id || NO_CATEGORY}
                      onValueChange={(v) => setForm((prev) => ({ ...prev, category_id: v === NO_CATEGORY ? '' : v }))}
                    >
                      <SelectTrigger id="category" className="w-full"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_CATEGORY}>Sem categoria</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="price">Preço (R$) *</Label>
                    <Input id="price" type="number" step="0.01" min="0" value={form.price} onChange={setField('price')} required />
                  </div>
                  <div className="space-y-2">
                    {/* ✅ step="1" — estoque é inteiro */}
                    <Label htmlFor="stock">Estoque</Label>
                    <Input id="stock" type="number" step="1" min="0" inputMode="numeric" value={form.stock} onChange={setField('stock')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unidade</Label>
                    <Input id="unit" value={form.unit} onChange={setField('unit')} placeholder="un" />
                  </div>
                </div>

                {/* ✅ Descrição com modo Texto/HTML + prévia sanitizada (Bloco Vitrine) */}
                <DescriptionField
                  id="description"
                  value={form.description}
                  onChange={setDescription}
                  rows={2}
                />

                <div className="rounded-lg border border-dashed p-4 text-center">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={onPickFile}
                  />
                  {preview ? (
                    <img src={preview} alt="Prévia do produto" className="mx-auto h-24 rounded object-cover" />
                  ) : (
                    <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                  )}
                  <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                    <FileUp className="mr-2 h-4 w-4" />Escolher imagem
                  </Button>
                  {imageError && <p role="alert" className="mt-2 text-xs text-destructive">{imageError}</p>}
                </div>
                {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
                <DialogFooter>
                  <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Cadastrar'}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Filtros */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, SKU ou código"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="w-full sm:w-56">
          <Select
            value={categoryFilter || NO_CATEGORY}
            onValueChange={(v) => { setCategoryFilter(v === NO_CATEGORY ? '' : v); setPage(1); }}
          >
            <SelectTrigger className="w-full"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CATEGORY}>Todas as categorias</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Produtos <span className="font-normal text-muted-foreground">({total})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="py-10 text-center text-muted-foreground">Carregando…</p>
          ) : products.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">Nenhum produto encontrado.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Estoque</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {isSafeImageUrl(p.image_url) ? (
                            <img src={p.image_url} alt={p.name} className="h-10 w-10 rounded object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded bg-muted/40">
                              <Package className="h-5 w-5 text-muted-foreground/60" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-foreground">{p.name}</p>
                            {p.code && <p className="text-xs text-muted-foreground">Cód.: {p.code}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {categories.find((c) => c.id === p.category_id)?.name ?? '—'}
                      </TableCell>
                      <TableCell>
                        <SkuChip sku={p.sku} />
                      </TableCell>
                      <TableCell className="text-foreground">{formatCurrency(Number(p.price))}</TableCell>
                      {/* ✅ Estoque inteiro (contraste Light/Dark) */}
                      <TableCell>
                        <StockChip value={stockInt(p.stock)} unit={p.unit} />
                      </TableCell>
                      <TableCell>
                        <StatusChip active={p.status === 'active'} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(p)} aria-label={`Editar ${p.name}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {pages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-xs text-muted-foreground">Página {page} de {pages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                    <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edição */}
      <Dialog open={!!editProduct} onOpenChange={(o) => { if (!o) { setEditProduct(null); resetForm(); } }}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>Editar produto</DialogTitle></DialogHeader>
          {editProduct && (
            <form onSubmit={handleEdit} className="space-y-4" noValidate>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-sku">SKU *</Label>
                  <Input id="edit-sku" value={form.sku} onChange={setField('sku')} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-code">Código</Label>
                  <Input id="edit-code" value={form.code} onChange={setField('code')} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome *</Label>
                <Input id="edit-name" value={form.name} onChange={setField('name')} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-brand">Marca</Label>
                  <Input id="edit-brand" value={form.brand} onChange={setField('brand')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">Categoria</Label>
                  <Select
                    value={form.category_id || NO_CATEGORY}
                    onValueChange={(v) => setForm((prev) => ({ ...prev, category_id: v === NO_CATEGORY ? '' : v }))}
                  >
                    <SelectTrigger id="edit-category" className="w-full"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CATEGORY}>Sem categoria</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-price">Preço (R$) *</Label>
                  <Input id="edit-price" type="number" step="0.01" min="0" value={form.price} onChange={setField('price')} required />
                </div>
                <div className="space-y-2">
                  {/* ✅ step="1" */}
                  <Label htmlFor="edit-stock">Estoque</Label>
                  <Input id="edit-stock" type="number" step="1" min="0" inputMode="numeric" value={form.stock} onChange={setField('stock')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-unit">Unidade</Label>
                  <Input id="edit-unit" value={form.unit} onChange={setField('unit')} />
                </div>
              </div>

              {/* ✅ Descrição com modo Texto/HTML + prévia sanitizada (Bloco Vitrine) */}
              <DescriptionField
                id="edit-description"
                value={form.description}
                onChange={setDescription}
                rows={2}
              />

              <div className="rounded-lg border border-dashed p-4 text-center">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={onPickFile}
                />
                {preview ? (
                  <img src={preview} alt="Prévia" className="mx-auto h-24 rounded object-cover" />
                ) : isSafeImageUrl(editProduct.image_url) ? (
                  <img src={editProduct.image_url} alt={editProduct.name} className="mx-auto h-24 rounded object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                )}
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                  <FileUp className="mr-2 h-4 w-4" />{imageFile ? 'Trocar imagem' : 'Enviar nova imagem'}
                </Button>
                {imageError && <p role="alert" className="mt-2 text-xs text-destructive">{imageError}</p>}
              </div>
              {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
              <DialogFooter>
                <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}