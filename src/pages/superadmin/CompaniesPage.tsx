import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Building2, Loader2, Pencil, Plus, Power, RotateCcw, Search } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import type { Company, CompanyPage, CompanyUpdate } from '../../types/api';
import { isSafeAssetUrl, isValidHexColor } from '../../lib/branding';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';

const PAGE_SIZE = 20;

/** Formulário de criação de empresa (CompanyCreateRequest). */
interface CompanyForm {
  name: string;
  cnpj: string;
  slug: string;
  domain: string;
  logo_url: string;
  favicon_url: string;
  primary_color: string;
  secondary_color: string;
  admin_email: string;
  admin_full_name: string;
}

/** Formulário de edição (CompanyUpdate — sem cnpj, sem admin). */
interface CompanyEditForm {
  name: string;
  slug: string;
  domain: string;
  logo_url: string;
  favicon_url: string;
  primary_color: string;
  secondary_color: string;
}

const emptyForm = (): CompanyForm => ({
  name: '', cnpj: '', slug: '', domain: '',
  logo_url: '', favicon_url: '',
  primary_color: '', secondary_color: '', admin_email: '', admin_full_name: '',
});

/** Preenche o form de edição a partir da empresa (valores atuais). */
const editFormFrom = (c: Company): CompanyEditForm => ({
  name: c.name,
  slug: c.slug,
  domain: c.domain ?? '',
  logo_url: c.logo_url ?? '',
  favicon_url: c.favicon_url ?? '',
  primary_color: c.primary_color ?? '',
  secondary_color: c.secondary_color ?? '',
});

/**
 * ✅ Formata o CNPJ para exibição: 00.000.000/0000-00.
 * Se o valor não tiver 14 dígitos, devolve como veio (sem inventar).
 */
function formatCNPJ(value: string | null | undefined): string {
  if (!value) return '—';
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 14) return value;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

/** Data ISO 8601 UTC → local (pt-BR). */
function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(d);
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Busca (debounce)
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');

  // Criação
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CompanyForm>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Status (inativar/reativar)
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  // Edição (PATCH /companies/{id})
  const [editFor, setEditFor] = useState<Company | null>(null);
  const [editForm, setEditForm] = useState<CompanyEditForm>(editFormFrom({} as Company));
  const [editError, setEditError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearchDebounced(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const data = await api.get<CompanyPage>('/companies', {
        page: p,
        page_size: PAGE_SIZE,
        search: searchDebounced || undefined,
      });
      setCompanies(data.items);
      setTotal(data.total);
      setPages(data.pages || 1);
    } catch {
      toast.error('Não foi possível carregar as empresas.');
    } finally {
      setLoading(false);
    }
  }, [searchDebounced]);

  useEffect(() => { load(page); }, [page, load]);

  const setField = (key: keyof CompanyForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const setEditField = (key: keyof CompanyEditForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setEditForm((prev) => ({ ...prev, [key]: e.target.value }));

  // ── Criar empresa ──
  const validate = (): string | null => {
    if (!form.name.trim()) return 'Informe o nome da empresa.';
    if (!form.cnpj.trim()) return 'Informe o CNPJ.';
    if (!form.slug.trim()) return 'Informe o slug.';
    if (form.logo_url.trim() && !isSafeAssetUrl(form.logo_url)) {
      return 'URL do logo inválida. Use uma URL HTTP/HTTPS ou um caminho relativo.';
    }
    if (form.favicon_url.trim() && !isSafeAssetUrl(form.favicon_url)) {
      return 'URL do favicon inválida. Use uma URL HTTP/HTTPS ou um caminho relativo.';
    }
    if (form.primary_color.trim() && !isValidHexColor(form.primary_color)) {
      return 'Cor primária inválida (use #RRGGBB).';
    }
    if (form.secondary_color.trim() && !isValidHexColor(form.secondary_color)) {
      return 'Cor secundária inválida (use #RRGGBB).';
    }
    if (!form.admin_email.trim()) return 'Informe o e-mail do administrador.';
    if (!form.admin_full_name.trim()) return 'Informe o nome do administrador.';
    return null;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const invalid = validate();
    if (invalid) { setFormError(invalid); return; }
    setSaving(true);
    setFormError(null);
    try {
      await api.post('/companies', {
        name: form.name.trim(),
        cnpj: form.cnpj.trim(),
        slug: form.slug.trim(),
        domain: form.domain.trim() || undefined,
        logo_url: form.logo_url.trim() || undefined,
        favicon_url: form.favicon_url.trim() || undefined,
        primary_color: form.primary_color.trim() || undefined,
        secondary_color: form.secondary_color.trim() || undefined,
        admin_email: form.admin_email.trim(),
        admin_full_name: form.admin_full_name.trim(),
      });
      toast.success('Empresa criada. Convite enviado ao administrador.');
      setCreateOpen(false);
      setForm(emptyForm());
      if (page !== 1) setPage(1);
      else load(1);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Erro ao criar a empresa.');
    } finally {
      setSaving(false);
    }
  };

  // ── Editar empresa (PATCH /companies/{id} — Super Admin) ──
  const openEdit = (c: Company) => {
    setEditFor(c);
    setEditForm(editFormFrom(c));
    setEditError(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFor || editing) return;
    if (!editForm.name.trim()) { setEditError('Informe o nome da empresa.'); return; }
    if (!editForm.slug.trim()) { setEditError('Informe o slug.'); return; }
    if (editForm.primary_color.trim() && !isValidHexColor(editForm.primary_color)) {
      setEditError('Cor primária inválida (use #RRGGBB).'); return;
    }
    if (editForm.secondary_color.trim() && !isValidHexColor(editForm.secondary_color)) {
      setEditError('Cor secundária inválida (use #RRGGBB).'); return;
    }

    setEditing(true);
    setEditError(null);
    try {
      // Só envia os campos preenchidos; vazio = omite (backend mantém o atual).
      const payload: CompanyUpdate = {
        name: editForm.name.trim(),
        slug: editForm.slug.trim(),
        domain: editForm.domain.trim() || undefined,
        logo_url: editForm.logo_url.trim() || undefined,
        favicon_url: editForm.favicon_url.trim() || undefined,
        primary_color: editForm.primary_color.trim() || undefined,
        secondary_color: editForm.secondary_color.trim() || undefined,
      };
      const updated = await api.patch<Company>(`/companies/${editFor.id}`, payload);
      setCompanies((prev) =>
        prev.map((item) => (item.id === editFor.id ? updated : item)),
      );
      toast.success('Empresa atualizada.');
      setEditFor(null);
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : 'Erro ao atualizar a empresa.');
    } finally {
      setEditing(false);
    }
  };

  // ── Inativar / Reativar (PATCH /companies/{id}/status — Super Admin) ──
  const toggleStatus = async (c: Company) => {
    const action = c.status === 'active' ? 'inativar' : 'reativar';
    const warn =
      c.status === 'active'
        ? `Inativar a empresa "${c.name}"?\n\nTodos os usuários do tenant serão desativados e as sessões revogadas. Os acessos ao portal serão bloqueados imediatamente.`
        : `Reativar a empresa "${c.name}"?`;
    if (!window.confirm(warn)) return;

    setStatusUpdatingId(c.id);
    try {
      const updated = await api.patch<Company>(`/companies/${c.id}/status`, {
        status: c.status === 'active' ? 'inactive' : 'active',
      });
      setCompanies((prev) =>
        prev.map((item) => (item.id === c.id ? updated : item)),
      );
      toast.success(action === 'inativar' ? 'Empresa inativada.' : 'Empresa reativada.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao alterar o status.');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const resetForm = () => {
    setForm(emptyForm());
    setFormError(null);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Empresas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie as empresas (tenants) da plataforma. Ao inativar, os acessos
            do tenant são bloqueados imediatamente.
          </p>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Nova empresa
        </Button>
      </div>

      {/* Busca */}
      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, CNPJ ou slug…"
            className="pl-8"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando empresas…
        </div>
      ) : companies.length === 0 ? (
        <div className="py-20 text-center">
          <Building2 className="mx-auto mb-4 h-16 w-16 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold text-muted-foreground">Nenhuma empresa</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie a primeira empresa para começar.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {companies.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="truncate text-base">{c.name}</CardTitle>
                  <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>
                    {c.status === 'active' ? 'Ativa' : 'Inativa'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 pt-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-mono">{c.slug}</span>
                    {/* ✅ CNPJ formatado (00.000.000/0000-00) */}
                    {c.cnpj && <span>{formatCNPJ(c.cnpj)}</span>}
                    {c.domain && <span>{c.domain}</span>}
                    <span>Criada em {formatDate(c.created_at)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={statusUpdatingId === c.id}
                    onClick={() => openEdit(c)}
                    aria-label={`Editar ${c.name}`}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                  </Button>
                  {c.status === 'active' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={statusUpdatingId === c.id}
                      onClick={() => toggleStatus(c)}
                      aria-label={`Inativar ${c.name}`}
                    >
                      {statusUpdatingId === c.id
                        ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        : <Power className="mr-1 h-3.5 w-3.5" />}
                      Inativar
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      disabled={statusUpdatingId === c.id}
                      onClick={() => toggleStatus(c)}
                      aria-label={`Reativar ${c.name}`}
                    >
                      {statusUpdatingId === c.id
                        ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        : <RotateCcw className="mr-1 h-3.5 w-3.5" />}
                      Reativar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Paginação */}
          <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
            <span>
              {total} empresa(s) · página {page} de {pages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pages || loading}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
              >
                Próxima
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Diálogo: editar empresa (PATCH /companies/{id}) ── */}
      <Dialog open={!!editFor} onOpenChange={(o) => { if (!editing && !o) setEditFor(null); }}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar empresa — {editFor?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="e-name">Nome *</Label>
              <Input id="e-name" value={editForm.name} onChange={setEditField('name')} required />
            </div>

            {/* ✅ CNPJ: visível e formatado, BLOQUEADO para edição (não editável
                pelo PATCH /companies/{id}). readOnly permite copiar o valor. */}
            <div className="space-y-2">
              <Label htmlFor="e-cnpj">CNPJ</Label>
              <Input
                id="e-cnpj"
                value={formatCNPJ(editFor?.cnpj)}
                readOnly
                aria-readonly="true"
                tabIndex={-1}
                className="cursor-not-allowed bg-muted text-muted-foreground focus-visible:ring-0"
              />
              <p className="text-xs text-muted-foreground">Este campo não pode ser alterado.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="e-slug">Slug *</Label>
                <Input id="e-slug" value={editForm.slug} onChange={setEditField('slug')} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-domain">Domínio</Label>
                <Input id="e-domain" value={editForm.domain} onChange={setEditField('domain')} placeholder="portal.minhaempresa.com.br" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-logo">Logo (URL)</Label>
              <Input id="e-logo" value={editForm.logo_url} onChange={setEditField('logo_url')} placeholder="https://cdn.exemplo.com/logo.png" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-favicon">Favicon (URL)</Label>
              <Input id="e-favicon" value={editForm.favicon_url} onChange={setEditField('favicon_url')} placeholder="https://cdn.exemplo.com/favicon.ico" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="e-primary">Cor primária (hex)</Label>
                <Input id="e-primary" value={editForm.primary_color} onChange={setEditField('primary_color')} placeholder="#1976D2" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-secondary">Cor secundária (hex)</Label>
                <Input id="e-secondary" value={editForm.secondary_color} onChange={setEditField('secondary_color')} placeholder="#388E3C" />
              </div>
            </div>

            {/* ✅ Informações somente-leitura: status e data de criação.
                O status é alterado pelos botões Inativar/Reativar do cartão. */}
            <p className="text-xs text-muted-foreground">
              Status: {editFor?.status === 'active' ? 'Ativa' : 'Inativa'} · Criada em{' '}
              {formatDate(editFor?.created_at)}. Para alterar o status, use os botões do cartão.
            </p>

            {editError && (
              <p role="alert" className="text-sm text-destructive">{editError}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditFor(null)} disabled={editing}>
                Cancelar
              </Button>
              <Button type="submit" disabled={editing}>
                {editing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                {editing ? 'Salvando…' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo: nova empresa ── */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!saving) setCreateOpen(o); }}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova empresa</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="c-name">Nome *</Label>
              <Input id="c-name" value={form.name} onChange={setField('name')} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="c-cnpj">CNPJ *</Label>
                <Input id="c-cnpj" value={form.cnpj} onChange={setField('cnpj')} placeholder="00.000.000/0000-00" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-slug">Slug *</Label>
                <Input id="c-slug" value={form.slug} onChange={setField('slug')} placeholder="minha-empresa" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-domain">Domínio (opcional)</Label>
              <Input id="c-domain" value={form.domain} onChange={setField('domain')} placeholder="portal.minhaempresa.com.br" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-logo">Logo (URL)</Label>
              <Input
                id="c-logo"
                type="url"
                value={form.logo_url}
                onChange={setField('logo_url')}
                placeholder="https://cdn.exemplo.com/logo.png"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-favicon">Favicon (URL)</Label>
              <Input
                id="c-favicon"
                type="url"
                value={form.favicon_url}
                onChange={setField('favicon_url')}
                placeholder="https://cdn.exemplo.com/favicon.ico"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="c-primary">Cor primária (hex)</Label>
                <Input id="c-primary" value={form.primary_color} onChange={setField('primary_color')} placeholder="#1976D2" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-secondary">Cor secundária (hex)</Label>
                <Input id="c-secondary" value={form.secondary_color} onChange={setField('secondary_color')} placeholder="#388E3C" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="c-admin-email">E-mail do admin *</Label>
                <Input id="c-admin-email" type="email" value={form.admin_email} onChange={setField('admin_email')} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-admin-name">Nome do admin *</Label>
                <Input id="c-admin-name" value={form.admin_full_name} onChange={setField('admin_full_name')} required />
              </div>
            </div>
            {formError && (
              <p role="alert" className="text-sm text-destructive">{formError}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Criando…' : 'Criar empresa'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
