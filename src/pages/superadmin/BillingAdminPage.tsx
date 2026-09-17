import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ExternalLink, Filter, Loader2, Plus, Receipt, Search,
} from 'lucide-react';
import { api } from '../../lib/api';
import type {
  BillingCharge, BillingChargeType, BillingStatus, BillingType,
  Company, CompanyPage,
} from '../../types/api';
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { formatCurrency, formatDate } from '../../lib/format';
import {
  createBillingCharge, createBillingSubscription, fetchAllBillingCharges,
} from '../../services/billing';
import { cn } from '../../lib/utils';

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<BillingStatus, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  overdue: 'Vencido',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
};

const STATUS_STYLE: Record<BillingStatus, string> = {
  pending: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
  refunded: 'bg-amber-100 text-amber-700',
};

const TYPE_LABEL: Record<string, string> = {
  mensalidade: 'Mensalidade',
  implantacao: 'Implantação',
  modulo: 'Módulo novo',
  custom: 'Customizada',
};

const BILLING_LABEL: Record<BillingType, string> = {
  pix: 'PIX',
  boleto: 'Boleto',
  credit_card: 'Cartão',
};

/** CNPJ sem máscara (apenas dígitos). */
const onlyDigits = (v: string) => v.replace(/\D/g, '');

/** Campo CNPJ com resolução automática do nome da empresa. */
function CompanyCnpjField(props: {
  cnpj: string;
  onChange: (cnpj: string, found: Company | null) => void;
  companies: Company[];
  error?: string | null;
}) {
  const { cnpj, onChange, companies, error } = props;
  const byDigits = useMemo(() => {
    const m = new Map<string, Company>();
    companies.forEach((c) => {
      if (c.cnpj) m.set(onlyDigits(c.cnpj), c);
    });
    return m;
  }, [companies]);

  const digits = onlyDigits(cnpj);
  const found = cnpj.trim() ? byDigits.get(digits) ?? null : null;

  return (
    <div className="space-y-2">
      <Label htmlFor="cnpj-empresa">CNPJ da empresa *</Label>
      <Input
        id="cnpj-empresa"
        value={cnpj}
        onChange={(e) => onChange(e.target.value, byDigits.get(onlyDigits(e.target.value)) ?? null)}
        placeholder="Somente números — ex.: 12345678000190"
        inputMode="numeric"
        autoComplete="off"
        required
      />
      {found ? (
        <p className="text-xs font-medium text-green-600">
          {found.name} <span className="text-muted-foreground">({found.status === 'active' ? 'ativa' : 'inativa'})</span>
        </p>
      ) : cnpj.trim() && digits.length >= 8 ? (
        <p className="text-xs text-destructive">CNPJ não encontrado entre as empresas cadastradas.</p>
      ) : (
        <p className="text-xs text-muted-foreground">Digite o CNPJ — o nome da empresa aparece automaticamente.</p>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/** Formulário de cobrança avulsa. */
interface ChargeForm {
  cnpj: string;
  type: BillingChargeType | '';
  value: string;
  due_date: string;
  billing_type: BillingType;
  description: string;
}

/** Formulário de assinatura mensal. */
interface SubForm {
  cnpj: string;
  value: string;
  billing_type: BillingType;
  next_due_date: string;
}

const emptyChargeForm = (): ChargeForm => ({
  cnpj: '', type: '', value: '', due_date: '', billing_type: 'pix', description: '',
});

const emptySubForm = (): SubForm => ({
  cnpj: '', value: '', billing_type: 'pix', next_due_date: '',
});

export default function BillingAdminPage() {
  const [charges, setCharges] = useState<BillingCharge[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [status, setStatus] = useState<BillingStatus | 'all'>('all');
  const [type, setType] = useState<string>('all');

  // Empresas (mapa tenant_id → nome, e resolução por CNPJ)
  const [companies, setCompanies] = useState<Company[]>([]);
  const companyMap = useMemo(
    () => new Map(companies.map((c) => [c.id, c.name])),
    [companies],
  );

  // Criação de cobrança
  const [createOpen, setCreateOpen] = useState(false);
  const [chargeForm, setChargeForm] = useState<ChargeForm>(emptyChargeForm());
  const [chargeCompany, setChargeCompany] = useState<Company | null>(null);
  const [chargeError, setChargeError] = useState<string | null>(null);
  const [chargeSaving, setChargeSaving] = useState(false);

  // Criação de assinatura
  const [subOpen, setSubOpen] = useState(false);
  const [subForm, setSubForm] = useState<SubForm>(emptySubForm());
  const [subCompany, setSubCompany] = useState<Company | null>(null);
  const [subError, setSubError] = useState<string | null>(null);
  const [subSaving, setSubSaving] = useState(false);

  // Debounce da busca (padrão CompaniesPage)
  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearchDebounced(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [search]);

  // Carrega empresas para o mapa de nomes e resolução por CNPJ
  useEffect(() => {
    api.get<CompanyPage>('/companies', { page: 1, page_size: 1000 })
      .then((d) => setCompanies(d.items))
      .catch(() => toast.error('Não foi possível carregar as empresas.'));
  }, []);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const data = await fetchAllBillingCharges({
        page: p,
        page_size: PAGE_SIZE,
        status: status === 'all' ? undefined : status,
        type: type === 'all' ? undefined : type,
        search: searchDebounced || undefined,
      });
      setCharges(data.items);
      setTotal(data.total);
      setPages(data.pages || 1);
    } catch {
      toast.error('Não foi possível carregar as cobranças.');
    } finally {
      setLoading(false);
    }
  }, [status, type, searchDebounced]);

  useEffect(() => { load(page); }, [page, load]);

  // ── Criar cobrança avulsa ──
  const handleCreateCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (chargeSaving) return;
    if (!chargeCompany) { setChargeError('Informe um CNPJ válido de uma empresa cadastrada.'); return; }
    if (!chargeForm.type) { setChargeError('Selecione o tipo de cobrança.'); return; }
    const value = Number.parseFloat(chargeForm.value);
    if (!Number.isFinite(value) || value <= 0) {
      setChargeError('Informe um valor maior que zero.'); return;
    }
    if (!chargeForm.due_date) { setChargeError('Informe a data de vencimento.'); return; }

    setChargeSaving(true);
    setChargeError(null);
    try {
      await createBillingCharge(chargeForm.cnpj, {
        type: chargeForm.type as 'implantacao' | 'custom' | 'modulo',
        value,
        due_date: chargeForm.due_date,
        billing_type: chargeForm.billing_type,
        description: chargeForm.description.trim() || null,
      });
      toast.success(`Cobrança criada para ${chargeCompany.name}.`);
      setCreateOpen(false);
      setChargeForm(emptyChargeForm());
      setChargeCompany(null);
      setPage(1);
    } catch (err) {
      setChargeError(err instanceof Error ? err.message : 'Erro ao criar a cobrança.');
    } finally {
      setChargeSaving(false);
    }
  };

  // ── Criar assinatura mensal ──
  const handleCreateSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subSaving) return;
    if (!subCompany) { setSubError('Informe um CNPJ válido de uma empresa cadastrada.'); return; }

    const value = subForm.value.trim()
      ? Number.parseFloat(subForm.value)
      : null;
    if (value !== null && (!Number.isFinite(value) || value <= 0)) {
      setSubError('Valor da mensalidade inválido.'); return;
    }

    setSubSaving(true);
    setSubError(null);
    try {
      await createBillingSubscription(subForm.cnpj, {
        value,
        billing_type: subForm.billing_type,
        next_due_date: subForm.next_due_date || null,
      });
      toast.success(`Assinatura mensal criada para ${subCompany.name}.`);
      setSubOpen(false);
      setSubForm(emptySubForm());
      setSubCompany(null);
      setPage(1);
    } catch (err) {
      setSubError(err instanceof Error ? err.message : 'Erro ao criar a assinatura.');
    } finally {
      setSubSaving(false);
    }
  };

  const openInvoice = (c: BillingCharge) => {
    if (c.checkout_url) {
      window.open(c.checkout_url, '_blank', 'noopener,noreferrer');
    }
  };

  const canOpenInvoice = (c: BillingCharge) =>
    !!c.checkout_url && (c.status === 'pending' || c.status === 'overdue');

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pagamentos & Assinaturas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Situação financeira de todas as empresas — crie cobranças informando apenas o CNPJ.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => { setChargeError(null); setChargeForm(emptyChargeForm()); setChargeCompany(null); setCreateOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Nova cobrança
          </Button>
          <Button variant="outline" onClick={() => { setSubError(null); setSubForm(emptySubForm()); setSubCompany(null); setSubOpen(true); }}>
            <Receipt className="mr-2 h-4 w-4" /> Nova assinatura
          </Button>
        </div>
      </div>

      {/* Busca + filtros */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por empresa ou referência…"
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={status} onValueChange={(v) => { setStatus(v as BillingStatus | 'all'); setPage(1); }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
              <SelectItem value="overdue">Vencido</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
              <SelectItem value="refunded">Reembolsado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="mensalidade">Mensalidade</SelectItem>
              <SelectItem value="implantacao">Implantação</SelectItem>
              <SelectItem value="modulo">Módulo novo</SelectItem>
              <SelectItem value="custom">Customizada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando cobranças…
        </div>
      ) : charges.length === 0 ? (
        <div className="py-20 text-center">
          <Receipt className="mx-auto mb-4 h-16 w-16 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold text-muted-foreground">Nenhuma cobrança</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie a primeira cobrança ou assinatura para uma empresa.
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {charges.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {companyMap.get(c.tenant_id) ?? '—'}
                    </TableCell>
                    <TableCell>{TYPE_LABEL[c.type] ?? c.type}</TableCell>
                    <TableCell>{formatCurrency(c.value)}</TableCell>
                    <TableCell>{formatDate(c.due_date)}</TableCell>
                    <TableCell>{BILLING_LABEL[c.billing_type] ?? c.billing_type}</TableCell>
                    <TableCell>
                      <Badge className={cn('font-medium', STATUS_STYLE[c.status])}>
                        {STATUS_LABEL[c.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canOpenInvoice(c) && (
                        <Button size="sm" variant="outline" onClick={() => openInvoice(c)}>
                          <ExternalLink className="mr-2 h-4 w-4" /> Fatura
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Paginação */}
      <div className="flex items-center justify-between pt-4 text-sm text-muted-foreground">
        <span>{total} cobrança(s) · página {page} de {pages}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Anterior
          </Button>
          <Button variant="outline" size="sm" disabled={page >= pages || loading} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
            Próxima
          </Button>
        </div>
      </div>

      {/* ── Diálogo: Nova cobrança ── */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!chargeSaving) setCreateOpen(o); }}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova cobrança (avulsa)</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCharge} className="space-y-4" noValidate>
            <CompanyCnpjField
              cnpj={chargeForm.cnpj}
              onChange={(cnpj, found) => { setChargeForm((prev) => ({ ...prev, cnpj })); setChargeCompany(found); }}
              companies={companies}
              error={chargeError}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ch-type">Tipo *</Label>
                <Select
                  value={chargeForm.type}
                  onValueChange={(v) => setChargeForm((prev) => ({ ...prev, type: v as BillingChargeType }))}
                >
                  <SelectTrigger id="ch-type">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="implantacao">Implantação</SelectItem>
                    <SelectItem value="modulo">Módulo novo</SelectItem>
                    <SelectItem value="custom">Customizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ch-billing">Forma de pagamento *</Label>
                <Select
                  value={chargeForm.billing_type}
                  onValueChange={(v) => setChargeForm((prev) => ({ ...prev, billing_type: v as BillingType }))}
                >
                  <SelectTrigger id="ch-billing">
                    <SelectValue placeholder="Forma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="credit_card">Cartão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ch-value">Valor (R$) *</Label>
                <Input
                  id="ch-value"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={chargeForm.value}
                  onChange={(e) => setChargeForm((prev) => ({ ...prev, value: e.target.value }))}
                  placeholder="0,00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ch-due">Vencimento *</Label>
                <Input
                  id="ch-due"
                  type="date"
                  value={chargeForm.due_date}
                  onChange={(e) => setChargeForm((prev) => ({ ...prev, due_date: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-desc">Descrição (opcional)</Label>
              <Input
                id="ch-desc"
                value={chargeForm.description}
                onChange={(e) => setChargeForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Ex.: Módulo novo — CRM, Taxa de implantação…"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={chargeSaving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={chargeSaving || !chargeCompany}>
                {chargeSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar cobrança
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo: Nova assinatura ── */}
      <Dialog open={subOpen} onOpenChange={(o) => { if (!subSaving) setSubOpen(o); }}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova assinatura mensal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSub} className="space-y-4" noValidate>
            <CompanyCnpjField
              cnpj={subForm.cnpj}
              onChange={(cnpj, found) => { setSubForm((prev) => ({ ...prev, cnpj })); setSubCompany(found); }}
              companies={companies}
              error={subError}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="sb-value">Valor da mensalidade (R$) *</Label>
                <Input
                  id="sb-value"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={subForm.value}
                  onChange={(e) => setSubForm((prev) => ({ ...prev, value: e.target.value }))}
                  placeholder="Ex.: 499,90"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sb-billing">Forma de pagamento *</Label>
                <Select
                  value={subForm.billing_type}
                  onValueChange={(v) => setSubForm((prev) => ({ ...prev, billing_type: v as BillingType }))}
                >
                  <SelectTrigger id="sb-billing">
                    <SelectValue placeholder="Forma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="credit_card">Cartão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sb-due">Primeiro vencimento (opcional)</Label>
              <Input
                id="sb-due"
                type="date"
                value={subForm.next_due_date}
                onChange={(e) => setSubForm((prev) => ({ ...prev, next_due_date: e.target.value }))}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              O valor preenchido vira a mensalidade da empresa (e o padrão das próximas cobranças).
              Se deixar vazio, usa o valor cadastrado no monthly_fee.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSubOpen(false)} disabled={subSaving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={subSaving || !subCompany}>
                {subSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar assinatura
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}