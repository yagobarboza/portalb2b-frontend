import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, FileUp, ImagePlus, Link2, Loader2, Save, Trash2, Upload, X,
} from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import type { Category, Product } from '@/types/api';
import {
  uploadProductImage,
  validateImageFile,
} from '../../lib/uploads';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { DescriptionField } from '../../components/DescriptionField';
import { cn } from '../../lib/utils';

type TabKey = 'geral' | 'preco' | 'midia';
type MediaMode = 'upload' | 'url';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'geral', label: 'Geral' },
  { key: 'preco', label: 'Preço & Estoque' },
  { key: 'midia', label: 'Mídia' },
];

const NO_CATEGORY = 'none';

/** Estoque é SEMPRE inteiro (10, nunca "10.000"). */
const stockInt = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.trunc(n));
};

/** ✅ URL http(s) válida e não-vazia (imagem externa / CDN do cliente). */
const isHttpUrl = (v: string | null | undefined): v is string =>
  !!v && /^https?:\/\//i.test(v.trim());

/** Arquivo enviado para o R2 (GET /files/by-owner/product/{id}).
 *  A listagem NÃO traz URL pública — a URL é resolvida em paralelo via
 *  GET /files/{id}/download. Campos defensivos: se a resolução falhar,
 *  exibimos placeholder em vez de thumbnail quebrado. */
interface UploadedFile {
  id: string;
  original_name?: string;
  filename?: string;
  size_bytes?: number;
  mime_type?: string;
  created_at?: string;
  url?: string;
}

/** Formata bytes de forma legível (ex.: 1,2 MB). */
function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center rounded-full bg-foreground px-2 py-0.5 text-xs font-medium text-background">
      Ativo
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
      Inativo
    </span>
  );
}

/** Formulário completo de edição (Geral + Preço & Estoque + Mídia). */
interface ProductForm {
  // Geral
  name: string;
  sku: string;
  code: string;
  brand: string;
  unit: string;
  category_id: string;
  description: string;
  status: 'active' | 'inactive';
  // Preço & Estoque
  price: string;
  stock: string;
  // Mídia — URL EXTERNA da imagem (capa). Vazia = usa o R2 (fallback).
  image_url: string;
}

function toForm(p: Product): ProductForm {
  return {
    name: p.name,
    sku: p.sku,
    code: p.code ?? '',
    brand: p.brand ?? '',
    unit: p.unit ?? '',
    category_id: p.category_id ?? '',
    description: p.description ?? '',
    status: p.status === 'active' ? 'active' : 'inactive',
    price: String(p.price),
    stock: p.stock === null || p.stock === undefined ? '' : String(stockInt(p.stock)),
    // ✅ Só a URL EXTERNA crua (nunca a do R2) — campo vazio se não houver.
    image_url: p.image_url_external ?? '',
  };
}

/**
 * Página dedicada de edição de produto (estilo Tray/VTEX/Nuvemshop).
 *
 * Layout: header fixo (voltar, nome, status, Salvar/Descartar/Excluir) +
 * coluna de abas à esquerda + conteúdo à direita. O backend é a autoridade:
 * toda validação/permissão (CATALOG_MANAGE) e isolamento de tenant ficam no
 * servidor — esta página apenas consome e reflete.
 *
 * FASE 2: aba "Geral".
 * FASE 3: aba "Preço & Estoque".
 * FASE 4: aba "Mídia" com seletor de modo (upload ⇄ URL) e galeria com
 *         thumbnails reais das imagens do produto.
 * FASE C: botões de EXCLUSÃO —
 *   - "Excluir" no header → DELETE /catalog/products/{id} (soft delete)
 *     com diálogo de confirmação; ao concluir, volta ao catálogo.
 *   - "Excluir" em cada imagem da galeria → DELETE /files/{file_id} (R2 +
 *     registro) com diálogo de confirmação; remove a imagem da lista.
 */
export default function ProductEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<ProductForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('geral');

  // ── Mídia ──
  const [mediaMode, setMediaMode] = useState<MediaMode>('upload');
  const [uploaded, setUploaded] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [galleryLoaded, setGalleryLoaded] = useState(false);

  // ── Exclusão ──
  const [deleteOpen, setDeleteOpen] = useState(false); // produto
  const [deleting, setDeleting] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<UploadedFile | null>(null); // imagem
  const [deletingFile, setDeletingFile] = useState(false);

  // Carrega produto + categorias em paralelo (1x por id).
  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const [p, cats] = await Promise.all([
          api.get<Product>(`/catalog/products/${id}`),
          api.get<Category[]>('/catalog/categories'),
        ]);
        if (!active) return;
        setProduct(p);
        setCategories(cats);
        setForm(toForm(p));
      } catch (err) {
        if (!active) return;
        toast.error(err instanceof ApiError ? err.message : 'Não foi possível carregar o produto.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  // Carrega a galeria do R2 quando a aba Mídia é aberta (1x).
  useEffect(() => {
    if (activeTab !== 'midia' || !id || galleryLoaded) return;
    let active = true;
    (async () => {
      try {
        const files = await api.get<UploadedFile[]>(`/files/by-owner/product/${id}`);
        // ✅ Resolve a URL pública de cada arquivo (thumbnails reais).
        const withUrls = await Promise.all(
          files.map(async (f) => {
            try {
              const d = await api.get<{ url: string }>(`/files/${f.id}/download`);
              return { ...f, url: d.url };
            } catch {
              return f; // placeholder defensivo se a URL falhar
            }
          }),
        );
        if (active) setUploaded(withUrls);
      } catch {
        if (active) setMediaError('Não foi possível carregar as imagens enviadas.');
      } finally {
        if (active) setGalleryLoaded(true);
      }
    })();
    return () => { active = false; };
  }, [activeTab, id, galleryLoaded]);

  // Marca o formulário como alterado (habilita Salvar).
  const setField = useCallback(<K extends keyof ProductForm>(key: K, value: ProductForm[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setDirty(true);
    setFormError(null);
  }, []);

  // Validação local espelhando o schema do backend (defesa em profundidade).
  const validate = useCallback((): string | null => {
    if (!form) return 'Formulário não carregado.';
    if (!form.sku.trim()) return 'Informe o SKU.';
    if (form.sku.trim().length > 80) return 'SKU muito longo (máx. 80).';
    if (!form.name.trim()) return 'Informe o nome do produto.';
    if (form.name.trim().length > 255) return 'Nome muito longo (máx. 255).';
    if (form.brand && form.brand.length > 100) return 'Marca muito longa (máx. 100).';
    if (form.unit && form.unit.length > 20) return 'Unidade muito longa (máx. 20).';
    const price = Number(form.price);
    if (!form.price.trim() || Number.isNaN(price) || price < 0) {
      return 'Informe um preço válido (≥ 0).';
    }
    if (form.stock.trim()) {
      const stock = Number(form.stock);
      if (Number.isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
        return 'Estoque deve ser um número inteiro (≥ 0).';
      }
    }
    // ✅ URL externa (opcional) precisa ser http(s).
    if (form.image_url.trim() && !isHttpUrl(form.image_url)) {
      return 'A URL da imagem deve começar com http:// ou https://.';
    }
    return null;
  }, [form]);

  // Salva as alterações (PATCH). O backend revalida tudo.
  const handleSave = useCallback(async () => {
    if (!product || !form || saving) return;
    const invalid = validate();
    if (invalid) { setFormError(invalid); return; }
    setSaving(true);
    setFormError(null);
    try {
      await api.patch<Product>(`/catalog/products/${product.id}`, {
        name: form.name.trim(),
        sku: form.sku.trim(),
        code: form.code.trim() || null,
        brand: form.brand.trim() || null,
        unit: form.unit.trim() || null,
        category_id: form.category_id || null,
        description: form.description.trim() || null,
        status: form.status,
        price: Number(form.price),
        stock: form.stock.trim() ? stockInt(form.stock) : null,
        // ✅ URL externa: '' (vazio) LIMPA a imagem externa (→ fallback R2).
        image_url: form.image_url.trim(),
      });
      setDirty(false);
      toast.success('Produto atualizado.');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Erro ao salvar o produto.';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [product, form, saving, validate]);

  // ── Upload de imagem para o R2 (validado antes de enviar) ──
  const handleUpload = useCallback(async (file: File) => {
    if (!product || uploading) return;
    setMediaError(null);
    const invalid = validateImageFile(file);
    if (invalid) { setMediaError(invalid); return; }
    setUploading(true);
    try {
      await uploadProductImage(product.id, file);
      toast.success('Imagem enviada com sucesso.');
      setGalleryLoaded(false); // força recarregar a galeria
    } catch (err) {
      setMediaError(err instanceof ApiError ? err.message : 'Não foi possível enviar a imagem.');
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível enviar a imagem.');
    } finally {
      setUploading(false);
    }
  }, [product, uploading]);

  // ── Excluir PRODUTO (soft delete no backend) ──
  const handleDeleteProduct = useCallback(async () => {
    if (!product || deleting) return;
    setDeleting(true);
    try {
      await api.delete(`/catalog/products/${product.id}`);
      toast.success('Produto excluído.');
      navigate('/empresa/catalogo');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao excluir o produto.');
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }, [product, deleting, navigate]);

  // ── Excluir IMAGEM (físico no backend: R2 + registro) ──
  const handleDeleteFile = useCallback(async () => {
    if (!fileToDelete || deletingFile) return;
    setDeletingFile(true);
    try {
      await api.delete(`/files/${fileToDelete.id}`);
      setUploaded((prev) => prev.filter((f) => f.id !== fileToDelete.id));
      setFileToDelete(null);
      toast.success('Imagem excluída.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao excluir a imagem.');
      setFileToDelete(null);
    } finally {
      setDeletingFile(false);
    }
  }, [fileToDelete, deletingFile]);

  const handleDiscard = useCallback(() => {
    if (saving) return;
    navigate('/empresa/catalogo');
  }, [navigate, saving]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando produto…
      </div>
    );
  }

  if (!product || !form) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Produto não encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/empresa/catalogo')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao catálogo
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* ── Header fixo ── */}
      <div className="mb-6 flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleDiscard} aria-label="Voltar ao catálogo">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-bold tracking-tight text-foreground">{product.name}</h1>
              <StatusBadge active={product.status === 'active'} />
            </div>
            <p className="truncate text-sm text-muted-foreground">
              SKU <span className="font-mono">{product.sku}</span>
              {product.code ? ` · Cód.: ${product.code}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleDiscard} disabled={saving}>
            Descartar
          </Button>
          <Button onClick={handleSave} disabled={!dirty || saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
          {/* ✅ FASE C: excluir produto (soft delete) */}
          <Button variant="destructive" onClick={() => setDeleteOpen(true)} disabled={saving || deleting}>
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </Button>
        </div>
      </div>

      {/* ── Layout 2 colunas: abas (esquerda) + conteúdo (direita) ── */}
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Navegação por abas */}
        <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Seções do produto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Conteúdo da aba ativa */}
        <div className="min-w-0">
          {activeTab === 'geral' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Informações gerais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                  <div className="space-y-2">
                    <Label htmlFor="pe-name">Nome *</Label>
                    <Input id="pe-name" value={form.name} maxLength={255} onChange={(e) => setField('name', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pe-status">Status</Label>
                    <Select value={form.status} onValueChange={(v) => setField('status', v as 'active' | 'inactive')}>
                      <SelectTrigger id="pe-status" className="w-full"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="inactive">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="pe-sku">SKU *</Label>
                    <Input id="pe-sku" value={form.sku} maxLength={80} onChange={(e) => setField('sku', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pe-code">Código (opcional)</Label>
                    <Input id="pe-code" value={form.code} maxLength={80} onChange={(e) => setField('code', e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="pe-brand">Marca</Label>
                    <Input id="pe-brand" value={form.brand} maxLength={100} onChange={(e) => setField('brand', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pe-unit">Unidade</Label>
                    <Input id="pe-unit" value={form.unit} maxLength={20} placeholder="un" onChange={(e) => setField('unit', e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pe-category">Categoria</Label>
                  <Select value={form.category_id || NO_CATEGORY} onValueChange={(v) => setField('category_id', v === NO_CATEGORY ? '' : v)}>
                    <SelectTrigger id="pe-category" className="w-full sm:max-w-sm"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CATEGORY}>Sem categoria</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pe-description">Descrição</Label>
                  <DescriptionField id="pe-description" value={form.description} onChange={(v) => setField('description', v)} rows={5} />
                </div>
                {formError && (
                  <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{formError}</p>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'preco' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Preço & Estoque</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pe-price">Preço (R$) *</Label>
                  <Input id="pe-price" type="number" step="0.01" min="0" inputMode="decimal" value={form.price} onChange={(e) => setField('price', e.target.value)} />
                  <p className="text-xs text-muted-foreground">
                    Preço padrão do produto. Preços especiais por cliente são definidos na tela de preços.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pe-stock">Estoque</Label>
                  <Input id="pe-stock" type="number" step="1" min="0" inputMode="numeric" value={form.stock} onChange={(e) => setField('stock', e.target.value)} />
                  <p className="text-xs text-muted-foreground">
                    Quantidade em unidades. <strong>Valor inteiro</strong> (ex.: 15, nunca 15.5).
                  </p>
                </div>
                {formError && (
                  <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{formError}</p>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'midia' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Mídia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* ── Seletor de modo: upload ⇄ URL ── */}
                <div className="inline-flex rounded-lg border p-1">
                  <button
                    type="button"
                    onClick={() => setMediaMode('upload')}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      mediaMode === 'upload'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <FileUp className="h-4 w-4" /> Enviar do computador
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaMode('url')}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      mediaMode === 'url'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Link2 className="h-4 w-4" /> Colar URL da imagem
                  </button>
                </div>

                {/* ── Modo UPLOAD (computador → R2) ── */}
                {mediaMode === 'upload' && (
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Upload className="h-4 w-4" /> Enviar imagem para o armazenamento
                    </Label>
                    <div className="flex items-center gap-3">
                      <label className="inline-flex cursor-pointer items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted">
                        <FileUp className="mr-2 h-4 w-4" />
                        {uploading ? 'Enviando…' : 'Escolher arquivo'}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          disabled={uploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void handleUpload(file);
                            e.target.value = ''; // permite reenviar o mesmo arquivo
                          }}
                        />
                      </label>
                      <p className="text-xs text-muted-foreground">JPG, PNG ou WebP.</p>
                    </div>
                    {mediaError && (
                      <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{mediaError}</p>
                    )}
                  </div>
                )}

                {/* ── Modo URL (imagem externa / capa) ── */}
                {mediaMode === 'url' && (
                  <div className="space-y-3">
                    <Label htmlFor="pe-image-url" className="flex items-center gap-2">
                      <Link2 className="h-4 w-4" /> Imagem principal (URL externa)
                    </Label>
                    <div className="flex items-start gap-3">
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
                        {isHttpUrl(form.image_url) ? (
                          <img src={form.image_url} alt="Imagem principal" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <ImagePlus className="h-6 w-6 text-muted-foreground/60" />
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <Input
                          id="pe-image-url"
                          type="url"
                          inputMode="url"
                          placeholder="https://cdn.cliente.com.br/produto.png"
                          value={form.image_url}
                          onChange={(e) => setField('image_url', e.target.value)}
                        />
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">
                            URL da CDN do cliente. Se preenchida, é a imagem exibida na vitrine.
                          </p>
                          {form.image_url && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setField('image_url', '')}
                              aria-label="Limpar imagem externa"
                            >
                              <X className="mr-1 h-3.5 w-3.5" /> Limpar
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Galeria de imagens do produto (capa + enviadas) ── */}
                <div className="space-y-3 border-t pt-5">
                  <Label className="flex items-center gap-2">
                    <ImagePlus className="h-4 w-4" /> Imagens do produto
                  </Label>

                  {/* Capa (URL externa) */}
                  {isHttpUrl(form.image_url) && (
                    <div className="relative w-28">
                      <img
                        src={form.image_url}
                        alt="Imagem principal"
                        className="h-28 w-28 rounded-lg border object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute left-1 top-1 rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background">
                        Capa
                      </span>
                    </div>
                  )}

                  {/* Imagens enviadas ao R2 */}
                  {uploaded.length === 0 && !isHttpUrl(form.image_url) ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma imagem ainda. Use o botão acima para adicionar.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      {uploaded.map((f) => (
                        <div key={f.id} className="group relative">
                          {f.url ? (
                            <img
                              src={f.url}
                              alt={f.original_name || f.filename || 'Imagem do produto'}
                              className="h-28 w-full rounded-lg border object-cover"
                              referrerPolicy="no-referrer"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-28 w-full items-center justify-center rounded-lg border bg-muted/40">
                              <ImagePlus className="h-6 w-6 text-muted-foreground/60" />
                            </div>
                          )}
                          {/* ✅ FASE C: excluir imagem (R2 + registro) */}
                          <button
                            type="button"
                            onClick={() => setFileToDelete(f)}
                            aria-label={`Excluir imagem ${f.original_name || f.filename || ''}`}
                            className="absolute right-1 top-1 rounded bg-background/90 p-1 text-destructive opacity-0 shadow-sm transition-opacity hover:bg-background group-hover:opacity-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <span className="mt-1 block truncate text-xs text-muted-foreground">
                            {f.original_name || f.filename || 'Imagem'} · {formatBytes(f.size_bytes)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Para trocar a imagem exibida na vitrine, use a URL externa (modo "Colar URL da imagem").
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Confirmação: excluir PRODUTO ── */}
      <Dialog open={deleteOpen} onOpenChange={(o) => { if (!deleting) setDeleteOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir produto?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{product.name}</strong> (SKU {product.sku}) será
            desativado e removido do catálogo. Esta ação não pode ser desfeita.
          </p>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteProduct} disabled={deleting}>
              {deleting ? 'Excluindo…' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirmação: excluir IMAGEM ── */}
      <Dialog open={!!fileToDelete} onOpenChange={(o) => { if (!deletingFile && !o) setFileToDelete(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir imagem?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            A imagem <strong className="text-foreground">{fileToDelete?.original_name || fileToDelete?.filename || 'selecionada'}</strong> será
            removida do armazenamento e do produto. Esta ação não pode ser desfeita.
          </p>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setFileToDelete(null)} disabled={deletingFile}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteFile} disabled={deletingFile}>
              {deletingFile ? 'Excluindo…' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}