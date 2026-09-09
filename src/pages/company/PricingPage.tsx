import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { BadgePercent, FileUp, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { formatCurrency } from '../../lib/format';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';

const PAGE_SIZE = 20;

/** Cliente resolvido pelo documento (GET /customers/by-document). */
interface ResolvedCustomer {
  id: string;
  name: string;
  document: string | null;
}

/** Produto resolvido pelo SKU (GET /catalog/products/by-sku). */
interface ResolvedProduct {
  id: string;
  sku: string;
  name: string;
  price: number;
}

/** Espelha CustomerPriceDetailRead + CustomerPricePage do backend. */
interface CustomerPriceDetail {
  id: string;
  customer_id: string;
  customer_name: string | null;
  product_id: string;
  product_name: string | null;
  product_sku: string | null;
  price: number;
}

interface CustomerPricePageData {
  items: CustomerPriceDetail[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

/** Relatório da importação (CustomerPriceImportResult). */
interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: Record<string, unknown>; error: string }>;
}

type SortOption = 'recent' | 'price_asc' | 'price_desc';

const toNumber = (value: string): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// Chip de SKU legível em Light e Dark (fundo invertido ao foreground).
function SkuChip({ sku }: { sku: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-md bg-foreground px-1.5 py-0.5 font-mono text-[10px] font-medium text-background">
      {sku}
    </span>
  );
}

export default function PricingPage() {
  // Formulário de novo preço: cliente por documento + produto por SKU
  const [docInput, setDocInput] = useState('');
  const [resolvedCustomer, setResolvedCustomer] = useState<ResolvedCustomer | null>(null);
  const [resolvingCustomer, setResolvingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);

  const [skuInput, setSkuInput] = useState('');
  const [resolvedProduct, setResolvedProduct] = useState<ResolvedProduct | null>(null);
  const [resolvingProduct, setResolvingProduct] = useState(false);
  const [skuError, setSkuError] = useState<string | null>(null);

  const [priceInput, setPriceInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Filtros da listagem (aplicados com debounce)
  const [filterSearch, setFilterSearch] = useState('');
  const [filterMin, setFilterMin] = useState('');
  const [filterMax, setFilterMax] = useState('');
  const [filterSort, setFilterSort] = useState<SortOption>('recent');
  const [applied, setApplied] = useState({
    search: '', min: '', max: '', sort: 'recent' as SortOption,
  });

  // Listagem
  const [rows, setRows] = useState<CustomerPriceDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Modal de edição
  const [editing, setEditing] = useState<CustomerPriceDetail | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Importação em massa
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Debounce dos filtros (evita flood)
  useEffect(() => {
    const t = window.setTimeout(() => {
      setApplied({
        search: filterSearch.trim(),
        min: filterMin.trim(),
        max: filterMax.trim(),
        sort: filterSort,
      });
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [filterSearch, filterMin, filterMax, filterSort]);

  const loadPrices = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const data = await api.get<CustomerPricePageData>('/catalog/customer-prices', {
        page: p,
        page_size: PAGE_SIZE,
        search: applied.search || undefined,
        min_price: applied.min ? toNumber(applied.min) : undefined,
        max_price: applied.max ? toNumber(applied.max) : undefined,
        sort_by: applied.sort,
      });
      setRows(data.items);
      setTotal(data.total);
      setPages(data.pages || 1);
    } catch {
      toast.error('Não foi possível carregar os preços especiais.');
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    loadPrices(page);
  }, [page, loadPrices]);

  // Resolve o cliente pelo CPF/CNPJ digitado.
  const resolveCustomer = async (): Promise<ResolvedCustomer | null> => {
    const doc = docInput.trim();
    if (!doc) {
      setCustomerError('Informe o CPF/CNPJ do cliente.');
      setResolvedCustomer(null);
      return null;
    }
    setResolvingCustomer(true);
    setCustomerError(null);
    try {
      const customer = await api.get<ResolvedCustomer>('/customers/by-document', { document: doc });
      setResolvedCustomer(customer);
      setCustomerError(null);
      return customer;
    } catch (err) {
      setResolvedCustomer(null);
      setCustomerError(
        err instanceof ApiError ? err.message : 'Cliente não encontrado para o documento informado.'
      );
      return null;
    } finally {
      setResolvingCustomer(false);
    }
  };

  // Resolve o produto pelo SKU digitado.
  const resolveProduct = async (): Promise<ResolvedProduct | null> => {
    const sku = skuInput.trim();
    if (!sku) {
      setSkuError('Informe o SKU do produto.');
      setResolvedProduct(null);
      return null;
    }
    setResolvingProduct(true);
    setSkuError(null);
    try {
      const product = await api.get<ResolvedProduct>('/catalog/products/by-sku', { sku });
      setResolvedProduct(product);
      setSkuError(null);
      return product;
    } catch (err) {
      setResolvedProduct(null);
      setSkuError(
        err instanceof ApiError ? err.message : 'Produto não encontrado para o SKU informado.'
      );
      return null;
    } finally {
      setResolvingProduct(false);
    }
  };

  const resetForm = () => {
    setDocInput('');
    setResolvedCustomer(null);
    setCustomerError(null);
    setSkuInput('');
    setResolvedProduct(null);
    setSkuError(null);
    setPriceInput('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const customer = resolvedCustomer ?? (await resolveCustomer());
    if (!customer) {
      toast.error('Resolva o cliente pelo CPF/CNPJ antes de salvar.');
      return;
    }
    const product = resolvedProduct ?? (await resolveProduct());
    if (!product) {
      toast.error('Resolva o produto pelo SKU antes de salvar.');
      return;
    }
    const price = toNumber(priceInput);
    if (price <= 0) {
      toast.error('Informe um preço especial maior que zero.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/catalog/customer-prices', {
        customer_id: customer.id,
        product_id: product.id,
        price,
      });
      toast.success('Preço especial criado. O cliente passa a ver este valor na vitrine.');
      resetForm();
      if (page !== 1) {
        setPage(1);
      } else {
        loadPrices(1);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao criar o preço especial.');
    } finally {
      setSaving(false);
    }
  };

  const reloadAfterChange = async (afterPage: number) => {
    if (rows.length === 1 && afterPage > 1) {
      setPage(afterPage - 1);
    } else {
      loadPrices(afterPage);
    }
  };

  const handleDelete = async (row: CustomerPriceDetail) => {
    const label = `${row.product_name ?? row.product_sku ?? 'produto'} — ${row.customer_name ?? 'cliente'}`;
    if (!window.confirm(`Remover o preço especial de ${label}?`)) return;
    try {
      await api.delete(`/catalog/customer-prices/${row.id}`);
      toast.success('Preço especial removido.');
      reloadAfterChange(page);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao remover o preço especial.');
    }
  };

  const openEdit = (row: CustomerPriceDetail) => {
    setEditing(row);
    setEditPrice(String(row.price));
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || editSaving) return;
    const price = toNumber(editPrice);
    if (price <= 0) {
      toast.error('Informe um preço especial maior que zero.');
      return;
    }
    setEditSaving(true);
    try {
      await api.patch(`/catalog/customer-prices/${editing.id}`, { price });
      toast.success('Preço especial atualizado.');
      setEditing(null);
      loadPrices(page);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao atualizar o preço especial.');
    } finally {
      setEditSaving(false);
    }
  };

  const pickImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!file) return;
    void runImport(file);
  };

  const runImport = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    try {
      // ✅ api.upload espera um FormData PRONTO (o chamador controla o campo)
      const form = new FormData();
      form.append('file', file);
      const result = await api.upload<ImportResult>('/catalog/customer-prices/import', form);
      setImportResult(result);
      toast.success('Importação concluída.');
      loadPrices(1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao importar o arquivo.');
    } finally {
      setImporting(false);
    }
  };

  const hasActiveFilters = Boolean(applied.search || applied.min || applied.max || applied.sort !== 'recent');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <BadgePercent className="h-6 w-6 text-primary" />
          Preços Especiais
        </h1>
        <p className="text-sm text-muted-foreground">
          Defina preços exclusivos por cliente. O preço especial tem prioridade sobre o preço padrão
          do produto na vitrine e no fechamento do pedido.
        </p>
      </div>

      {/* Formulário de novo preço (cliente por CPF/CNPJ + produto por SKU) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Novo preço especial</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="cp-document">CPF/CNPJ do cliente *</Label>
                <div className="flex gap-2">
                  <Input
                    id="cp-document"
                    value={docInput}
                    onChange={(e) => {
                      setDocInput(e.target.value);
                      setResolvedCustomer(null);
                      setCustomerError(null);
                    }}
                    placeholder="00.000.000/0000-00"
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => resolveCustomer()}
                    disabled={resolvingCustomer || !docInput.trim()}
                  >
                    {resolvingCustomer ? 'Buscando…' : 'Buscar'}
                  </Button>
                </div>
                {customerError && <p role="alert" className="text-xs text-destructive">{customerError}</p>}
                {resolvedCustomer && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{resolvedCustomer.name}</span>
                    {resolvedCustomer.document ? ` · ${resolvedCustomer.document}` : ''}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cp-sku">SKU do produto *</Label>
                <div className="flex gap-2">
                  <Input
                    id="cp-sku"
                    value={skuInput}
                    onChange={(e) => {
                      setSkuInput(e.target.value);
                      setResolvedProduct(null);
                      setSkuError(null);
                    }}
                    placeholder="Ex.: PROD-001"
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => resolveProduct()}
                    disabled={resolvingProduct || !skuInput.trim()}
                  >
                    {resolvingProduct ? 'Buscando…' : 'Buscar'}
                  </Button>
                </div>
                {skuError && <p role="alert" className="text-xs text-destructive">{skuError}</p>}
                {resolvedProduct && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{resolvedProduct.name}</span> · preço padrão{' '}
                    <span className="font-medium">{formatCurrency(Number(resolvedProduct.price))}</span>
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cp-price">Preço especial (R$) *</Label>
                <Input
                  id="cp-price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                <Plus className="mr-2 h-4 w-4" />
                {saving ? 'Salvando…' : 'Adicionar preço especial'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Importação em massa */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Importar preços em massa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Envie um arquivo <strong>CSV ou Excel (.xlsx)</strong> com as colunas{' '}
            <span className="font-mono">document</span> (CPF/CNPJ do cliente),{' '}
            <span className="font-mono">sku</span> (produto) e{' '}
            <span className="font-mono">price</span> (preço especial). Se o par cliente+produto já
            existir, o preço é <strong>atualizado</strong>.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={pickImportFile}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            <FileUp className="mr-2 h-4 w-4" />
            {importing ? 'Importando…' : 'Escolher arquivo'}
          </Button>

          {importResult && (
            <div className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap gap-3">
                <span className="font-medium text-green-700 dark:text-green-400">
                  {importResult.created} criado(s)
                </span>
                <span className="font-medium text-blue-700 dark:text-blue-400">
                  {importResult.updated} atualizado(s)
                </span>
                <span className="font-medium text-amber-700 dark:text-amber-400">
                  {importResult.skipped} pulado(s)
                </span>
              </div>
              {importResult.errors.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium text-destructive">
                    {importResult.errors.length} linha(s) com erro:
                  </p>
                  <ul className="max-h-40 space-y-1 overflow-auto text-xs text-muted-foreground">
                    {importResult.errors.map((err, idx) => (
                      <li key={idx}>
                        <span className="text-destructive">•</span> {err.error}{' '}
                        <span className="font-mono">
                          (doc: {String(err.row?.document ?? '—')}, sku:{' '}
                          {String(err.row?.sku ?? '—')})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Listagem */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Preços especiais cadastrados{' '}
            <span className="font-normal text-muted-foreground">({total})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filtros da listagem */}
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por empresa, produto ou SKU…"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="Preço mín."
                value={filterMin}
                onChange={(e) => setFilterMin(e.target.value)}
                className="w-32"
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="Preço máx."
                value={filterMax}
                onChange={(e) => setFilterMax(e.target.value)}
                className="w-32"
              />
              <Select value={filterSort} onValueChange={(v) => setFilterSort(v as SortOption)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Mais recentes</SelectItem>
                  <SelectItem value="price_asc">Menor preço</SelectItem>
                  <SelectItem value="price_desc">Maior preço</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterSearch('');
                    setFilterMin('');
                    setFilterMax('');
                    setFilterSort('recent');
                  }}
                >
                  Limpar
                </Button>
              )}
            </div>
          </div>

          {loading ? (
            <p className="py-10 text-center text-muted-foreground">Carregando…</p>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters
                  ? 'Nenhum preço especial encontrado com os filtros atuais.'
                  : 'Nenhum preço especial cadastrado.'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                {hasActiveFilters
                  ? 'Ajuste ou limpe os filtros para ver mais resultados.'
                  : 'Use o formulário acima ou a importação em massa para criar o primeiro.'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa (cliente)</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Preço especial</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.customer_name ?? '—'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{row.product_name ?? '—'}</span>
                            {row.product_sku && <SkuChip sku={row.product_sku} />}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(row.price)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEdit(row)}
                              aria-label={`Editar preço de ${row.product_name ?? 'produto'}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDelete(row)}
                              aria-label={`Remover preço de ${row.product_name ?? 'produto'}`}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {pages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Página {page} de {pages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= pages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de edição */}
      <Dialog open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar preço especial</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4" noValidate>
            {editing && (
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Empresa:</span>{' '}
                  <span className="font-medium">{editing.customer_name ?? '—'}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Produto:</span>{' '}
                  <span className="font-medium">{editing.product_name ?? editing.product_sku ?? '—'}</span>
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-price">Preço especial (R$) *</Label>
              <Input
                id="edit-price"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={editSaving}>
                {editSaving ? 'Salvando…' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}