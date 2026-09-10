import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BadgePercent, FileUp, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import type {
  Customer,
  CustomerPage,
  DiscountType,
  Product,
  QuantityDiscount,
  QuantityDiscountImportResult,
  QuantityDiscountPage,
} from '@/types/api';
import { formatCurrency } from '../../lib/format';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';

const PAGE_SIZE = 20;
const ALL_CUSTOMERS = 'all';
const SPECIFIC_CUSTOMER = 'specific';
const IMPORT_MAX_BYTES = 2 * 1024 * 1024; // 2 MB (mesmo limite do backend)
const IMPORT_EXTENSIONS = ['.csv', '.xlsx', '.xlsm'];

function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

/** Remove tudo que não for dígito (CPF/CNPJ) — mesma normalização do backend. */
const normalizeDigits = (value: string) => (value || '').replace(/\D/g, '');

/** Renderiza o desconto conforme o tipo: "5%" ou "R$ 2,50/un". */
function formatDiscount(type: DiscountType, value: number | string): string {
  const n = Number(value);
  return type === 'fixed' ? `${formatCurrency(n)}/un` : `${n}%`;
}

interface RuleForm {
  sku: string;
  customerMode: string; // 'all' | 'specific'
  document: string;
  min_quantity: string;
  discount_type: DiscountType;
  discount_value: string;
}

const emptyForm: RuleForm = {
  sku: '',
  customerMode: ALL_CUSTOMERS,
  document: '',
  min_quantity: '10',
  discount_type: 'percent',
  discount_value: '',
};

export default function QuantityDiscountsPage() {
  const [rules, setRules] = useState<QuantityDiscount[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filtro por SKU (resolve o produto → product_id antes de listar)
  const [skuFilter, setSkuFilter] = useState('');
  const [filterProductId, setFilterProductId] = useState<string | null>(null);
  const [filterLoading, setFilterLoading] = useState(false);

  // Modal de criação/edição
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<QuantityDiscount | null>(null);
  const [form, setForm] = useState<RuleForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Modal de exclusão
  const [deleteTarget, setDeleteTarget] = useState<QuantityDiscount | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Modal de importação
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<QuantityDiscountImportResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<QuantityDiscountPage>('/catalog/discounts', {
        page,
        page_size: PAGE_SIZE,
        product_id: filterProductId || undefined,
      });
      setRules(data.items);
      setTotal(data.total);
      setPages(data.pages || 1);
    } catch {
      toast.error('Não foi possível carregar as regras de desconto.');
    } finally {
      setLoading(false);
    }
  }, [page, filterProductId]);

  useEffect(() => {
    load();
  }, [load]);

  const setField =
    (key: keyof RuleForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const openCreate = () => {
    setEdit(null);
    setForm(emptyForm);
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (rule: QuantityDiscount) => {
    setEdit(rule);
    setForm({
      sku: rule.product_sku ?? '',
      customerMode: rule.customer_id ? SPECIFIC_CUSTOMER : ALL_CUSTOMERS,
      document: '', // vazio = mantém o cliente atual
      min_quantity: String(rule.min_quantity),
      discount_type: rule.discount_type,
      discount_value: String(Number(rule.discount_value)),
    });
    setFormError(null);
    setOpen(true);
  };

  /** Resolve o produto pelo SKU (endpoint leve, sem listagem). */
  const resolveProduct = async (sku: string): Promise<Product | null> => {
    try {
      return await api.get<Product>('/catalog/products/by-sku', { sku });
    } catch {
      return null;
    }
  };

  /** Resolve o cliente pelo documento (CPF/CNPJ) via busca. */
  const resolveCustomer = async (document: string): Promise<Customer | null> => {
    const digits = normalizeDigits(document);
    if (!digits) return null;
    try {
      const data = await api.get<CustomerPage>('/customers', {
        search: digits,
        page_size: 5,
      });
      return (
        data.items.find((c) => normalizeDigits(c.document ?? '') === digits) ?? null
      );
    } catch {
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setFormError(null);

    const sku = form.sku.trim();
    const minQty = Number(form.min_quantity);
    const value = Number(form.discount_value);

    if (!sku) return setFormError('Informe o SKU do produto.');
    if (!Number.isInteger(minQty) || minQty < 1)
      return setFormError('A quantidade mínima deve ser um número inteiro maior que zero.');
    if (!Number.isFinite(value) || value <= 0)
      return setFormError('O valor do desconto deve ser maior que zero.');
    if (form.discount_type === 'percent' && value > 100)
      return setFormError('O desconto percentual deve ser no máximo 100%.');
    if (form.customerMode === SPECIFIC_CUSTOMER && !form.document.trim() && !edit?.customer_id)
      return setFormError('Informe o CPF/CNPJ do cliente (ou escolha "Todos os clientes").');

    setSaving(true);
    try {
      // 1) Resolve o produto pelo SKU
      const product = await resolveProduct(sku);
      if (!product) {
        setFormError(`SKU "${sku}" não encontrado no catálogo.`);
        return;
      }

      // 2) Resolve o cliente (quando específico)
      let customerId: string | null = null;
      if (form.customerMode === SPECIFIC_CUSTOMER) {
        if (form.document.trim()) {
          const customer = await resolveCustomer(form.document);
          if (!customer) {
            setFormError('Cliente não encontrado para o CPF/CNPJ informado.');
            return;
          }
          customerId = customer.id;
        } else {
          customerId = edit?.customer_id ?? null; // mantém o cliente atual na edição
        }
      }

      const payload = {
        product_id: product.id,
        customer_id: customerId,
        min_quantity: minQty,
        discount_type: form.discount_type,
        discount_value: value,
      };

      if (edit) {
        await api.patch<QuantityDiscount>(`/catalog/discounts/${edit.id}`, payload);
        toast.success('Regra de desconto atualizada.');
      } else {
        await api.post<QuantityDiscount>('/catalog/discounts', payload);
        toast.success('Regra de desconto criada.');
      }
      setOpen(false);
      load();
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : 'Erro ao salvar a regra de desconto.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await api.delete(`/catalog/discounts/${deleteTarget.id}`);
      toast.success('Regra de desconto removida.');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao remover a regra.');
    } finally {
      setDeleting(false);
    }
  };

  const applySkuFilter = async () => {
    const sku = skuFilter.trim();
    if (!sku) {
      setFilterProductId(null);
      setPage(1);
      return;
    }
    setFilterLoading(true);
    try {
      const product = await resolveProduct(sku);
      if (!product) {
        toast.error(`SKU "${sku}" não encontrado no catálogo.`);
        return;
      }
      setFilterProductId(product.id);
      setPage(1);
    } finally {
      setFilterLoading(false);
    }
  };

  const clearSkuFilter = () => {
    setSkuFilter('');
    setFilterProductId(null);
    setPage(1);
  };

  const handleImport = async () => {
    if (!importFile || importing) return;
    if (importFile.size > IMPORT_MAX_BYTES) {
      toast.error('Arquivo excede o limite de 2 MB.');
      return;
    }
    const name = importFile.name.toLowerCase();
    if (!IMPORT_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      toast.error('Formato inválido. Envie um arquivo .csv, .xlsx ou .xlsm.');
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const form_data = new FormData();
      form_data.append('file', importFile);
      const result = await api.upload<QuantityDiscountImportResult>(
        '/catalog/discounts/import',
        form_data,
      );
      setImportResult(result);
      toast.success(
        `Importação concluída: ${result.created} criada(s), ${result.updated} atualizada(s).`,
      );
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao importar o arquivo.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <PageHeading
        title="Descontos por Quantidade"
        description="Configure descontos progressivos por faixa de quantidade — para todos os clientes ou para um cliente específico."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setImportResult(null); setImportFile(null); setImportOpen(true); }}>
              <FileUp className="mr-2 h-4 w-4" />Importar planilha
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />Nova regra
            </Button>
          </div>
        }
      />

      {/* Filtro por SKU */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Filtrar por SKU do produto"
            value={skuFilter}
            onChange={(e) => setSkuFilter(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applySkuFilter(); } }}
          />
        </div>
        <Button variant="outline" onClick={applySkuFilter} disabled={filterLoading}>
          {filterLoading ? 'Buscando…' : 'Filtrar'}
        </Button>
        {filterProductId && (
          <Button variant="ghost" onClick={clearSkuFilter}>
            <X className="mr-2 h-4 w-4" />Limpar
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {total} regra(s) configurada(s)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="py-10 text-center text-muted-foreground">Carregando…</p>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BadgePercent className="mb-3 h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-semibold text-muted-foreground">Nenhuma regra de desconto</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground/70">
                Crie uma regra manualmente ou importe uma planilha (
                <span className="font-mono">sku, document, min_quantity, discount_type, discount_value</span>
                ) para aplicar descontos por volume.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Escopo</TableHead>
                    <TableHead>A partir de</TableHead>
                    <TableHead>Desconto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <p className="font-medium text-foreground">{rule.product_name ?? '—'}</p>
                        <p className="font-mono text-xs text-muted-foreground">{rule.product_sku ?? '—'}</p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {rule.customer_id ? rule.customer_name ?? 'Cliente' : 'Todos os clientes'}
                      </TableCell>
                      <TableCell className="text-foreground">{rule.min_quantity} un</TableCell>
                      <TableCell className="font-semibold text-foreground">
                        {formatDiscount(rule.discount_type, rule.discount_value)}
                      </TableCell>
                      <TableCell>
                        {rule.is_active ? (
                          <span className="inline-flex items-center rounded-full bg-foreground px-2 py-0.5 text-xs font-medium text-background">
                            Ativa
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            Inativa
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(rule)} aria-label="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(rule)}
                            aria-label="Remover"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {pages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Página {page} de {pages}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                      Anterior
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ---------- Modal criar/editar ---------- */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setFormError(null); }}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{edit ? 'Editar regra de desconto' : 'Nova regra de desconto'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="d-sku">SKU do produto *</Label>
              <Input
                id="d-sku"
                value={form.sku}
                onChange={setField('sku')}
                placeholder="Ex.: SKU-001"
                className="font-mono"
                required
              />
              <p className="text-xs text-muted-foreground">
                Digite o SKU — o produto é resolvido automaticamente.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="d-scope">Escopo do cliente</Label>
                <Select
                  value={form.customerMode}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, customerMode: v }))}
                >
                  <SelectTrigger id="d-scope" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_CUSTOMERS}>Todos os clientes</SelectItem>
                    <SelectItem value={SPECIFIC_CUSTOMER}>Cliente específico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-doc">CPF/CNPJ do cliente</Label>
                <Input
                  id="d-doc"
                  value={form.document}
                  onChange={setField('document')}
                  placeholder="Somente se específico"
                  disabled={form.customerMode !== SPECIFIC_CUSTOMER}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="d-min">Qtd. mínima *</Label>
                <Input
                  id="d-min"
                  type="number"
                  step="1"
                  min="1"
                  inputMode="numeric"
                  value={form.min_quantity}
                  onChange={setField('min_quantity')}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-type">Tipo *</Label>
                <Select
                  value={form.discount_type}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, discount_type: v as DiscountType }))}
                >
                  <SelectTrigger id="d-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentual (%)</SelectItem>
                    <SelectItem value="fixed">Valor por unidade (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-value">
                  {form.discount_type === 'percent' ? 'Desconto (%) *' : 'Desconto (R$/un) *'}
                </Label>
                <Input
                  id="d-value"
                  type="number"
                  step={form.discount_type === 'percent' ? '1' : '0.01'}
                  min="0"
                  value={form.discount_value}
                  onChange={setField('discount_value')}
                  required
                />
              </div>
            </div>

            <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Ao atingir a faixa, o desconto vale para <strong>todas as unidades</strong> do produto
              no carrinho. Uma regra de cliente específico tem prioridade sobre a regra geral.
            </p>

            {formError && (
              <p role="alert" className="text-sm text-destructive">{formError}</p>
            )}

            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---------- Modal excluir ---------- */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remover regra de desconto</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remover a faixa de <strong>{deleteTarget?.min_quantity} un</strong> de{' '}
            <strong>{deleteTarget?.product_name ?? deleteTarget?.product_sku}</strong> (
            {deleteTarget ? formatDiscount(deleteTarget.discount_type, deleteTarget.discount_value) : ''}
            )? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Removendo…' : 'Remover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Modal importar ---------- */}
      <Dialog open={importOpen} onOpenChange={(o) => { if (!o) setImportOpen(false); }}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar descontos por planilha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Colunas esperadas</p>
              <p className="mt-1 font-mono">
                sku, document, min_quantity, discount_type, discount_value
              </p>
              <p className="mt-1">
                <strong>document</strong> em branco = todos os clientes · <strong>discount_type</strong>{' '}
                = percent | fixed · arquivos .csv, .xlsx ou .xlsm (máx. 2 MB).
              </p>
              <p className="mt-1">Regra já existente (mesmo produto + cliente + faixa) é atualizada.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="d-file">Arquivo *</Label>
              <Input
                id="d-file"
                type="file"
                accept=".csv,.xlsx,.xlsm"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {importResult && (
              <div className="space-y-2 rounded-md border p-3 text-sm">
                <p className="font-medium text-foreground">Resultado da importação</p>
                <p className="text-muted-foreground">
                  {importResult.created} criada(s) · {importResult.updated} atualizada(s) ·{' '}
                  {importResult.skipped} ignorada(s)
                </p>
                {importResult.errors.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded bg-destructive/5 p-2">
                    {importResult.errors.map((err, i) => (
                      <p key={i} className="text-xs text-destructive">
                        Linha {String(err.row)}: {err.error}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportOpen(false)} disabled={importing}>
              Fechar
            </Button>
            <Button onClick={handleImport} disabled={importing || !importFile}>
              {importing ? 'Importando…' : 'Importar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}