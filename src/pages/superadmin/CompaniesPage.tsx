import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Building2, Pencil, Plus, Search } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import type { Company, CompanyPage } from '../../types/api';
import { isValidHexColor } from '../../lib/branding';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';

interface CompanyForm {
  id?: string;
  name: string;
  cnpj: string;
  slug: string;
  domain: string;
  admin_email: string;
  admin_full_name: string;
  primary_color: string;
  secondary_color: string;
  logo_url: string;
  favicon_url: string;
}

const emptyForm: CompanyForm = {
  name: '', cnpj: '', slug: '', domain: '', admin_email: '', admin_full_name: '',
  primary_color: '#2563eb', secondary_color: '#0f172a', logo_url: '', favicon_url: '',
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<CompanyPage>('/companies', { page, page_size: 20, search: searchDebounced || undefined });
      setCompanies(data.items);
      setTotal(data.total);
      setPages(data.pages || 1);
    } catch {
      toast.error('Não foi possível carregar as empresas.');
    } finally {
      setLoading(false);
    }
  }, [page, searchDebounced]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(false);
    setForm(emptyForm);
    setError(null);
    setOpen(true);
  };

  const openEdit = (c: Company) => {
    setEditing(true);
    setForm({
      id: c.id,
      name: c.name,
      cnpj: c.cnpj ?? '',
      slug: c.slug,
      domain: c.domain ?? '',
      admin_email: '',
      admin_full_name: '',
      primary_color: c.primary_color ?? '#2563eb',
      secondary_color: c.secondary_color ?? '#0f172a',
      logo_url: (c as Company & { logo_url?: string | null }).logo_url ?? '',
      favicon_url: (c as Company & { favicon_url?: string | null }).favicon_url ?? '',
    });
    setError(null);
    setOpen(true);
  };

  const set = (field: keyof CompanyForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, [field]: e.target.value }));

  const validate = (): string | null => {
    if (form.name.trim().length < 2) return 'Informe o nome da empresa.';
    if (!form.cnpj.trim()) return 'Informe o CNPJ.';
    if (!/^[a-z0-9-]+$/.test(form.slug.trim())) return 'Slug inválido (use minúsculas, números, hífen).';
    if (form.primary_color && !isValidHexColor(form.primary_color)) return 'Cor primária inválida.';
    if (form.secondary_color && !isValidHexColor(form.secondary_color)) return 'Cor secundária inválida.';
    if (!editing && !form.admin_email.trim()) return 'Informe o e-mail do administrador.';
    if (!editing && !form.admin_full_name.trim()) return 'Informe o nome do administrador.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const invalid = validate();
    if (invalid) { setError(invalid); return; }
    setSaving(true);
    setError(null);
    try {
      if (editing && form.id) {
        await api.patch<Company>(`/companies/${form.id}`, {
          name: form.name.trim(),
          slug: form.slug.trim(),
          domain: form.domain.trim() || null,
          primary_color: form.primary_color || null,
          secondary_color: form.secondary_color || null,
          logo_url: form.logo_url.trim() || null,
          favicon_url: form.favicon_url.trim() || null,
        });
        toast.success('Empresa atualizada (logo e branding salvos).');
      } else {
        await api.post('/companies', {
          name: form.name.trim(),
          cnpj: form.cnpj.trim(),
          slug: form.slug.trim(),
          domain: form.domain.trim() || null,
          admin_email: form.admin_email.trim(),
          admin_full_name: form.admin_full_name.trim(),
          primary_color: form.primary_color || null,
          secondary_color: form.secondary_color || null,
          logo_url: form.logo_url.trim() || null,
          favicon_url: form.favicon_url.trim() || null,
        });
        toast.success('Empresa criada e administrador convidado.');
      }
      setOpen(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar empresa.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Empresas</h1>
          <p className="text-sm text-muted-foreground">Gerencie tenants, branding e logomarcas.</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nova empresa</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome, slug ou CNPJ…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Empresas <span className="font-normal text-muted-foreground">({total})</span></CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <p className="col-span-full py-10 text-center text-muted-foreground">Carregando…</p>
          ) : companies.length === 0 ? (
            <p className="col-span-full py-10 text-center text-muted-foreground">Nenhuma empresa encontrada.</p>
          ) : (
            companies.map((c) => {
              const logo = (c as Company & { logo_url?: string | null }).logo_url;
              return (
                <Card key={c.id} className="overflow-hidden">
                  <CardContent className="flex items-center gap-3 p-4">
                    {logo ? (
                      <img src={logo} alt={c.name} className="h-12 w-12 rounded-lg object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{c.name}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{c.slug}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>
                          {c.status === 'active' ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(c)} aria-label={`Editar ${c.name}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </CardContent>
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Página {page} de {pages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        </div>
      )}

      {/* Modal criar/editar */}
      <Dialog open={open} onOpenChange={(o) => { if (!o) setOpen(false); }}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar empresa e branding' : 'Nova empresa'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {!editing && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="c-name">Nome *</Label>
                    <Input id="c-name" value={form.name} onChange={set('name')} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="c-cnpj">CNPJ *</Label>
                    <Input id="c-cnpj" value={form.cnpj} onChange={set('cnpj')} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="c-slug">Slug *</Label>
                    <Input id="c-slug" value={form.slug} onChange={set('slug')} placeholder="minha-empresa" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="c-domain">Domínio</Label>
                    <Input id="c-domain" value={form.domain} onChange={set('domain')} placeholder="empresa.com.br" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="c-admin">E-mail do admin *</Label>
                    <Input id="c-admin" type="email" value={form.admin_email} onChange={set('admin_email')} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="c-adminname">Nome do admin *</Label>
                    <Input id="c-adminname" value={form.admin_full_name} onChange={set('admin_full_name')} required />
                  </div>
                </div>
              </>
            )}
            {editing && (
              <div className="space-y-2">
                <Label htmlFor="c-name">Nome *</Label>
                <Input id="c-name" value={form.name} onChange={set('name')} required />
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="c-slug">Slug *</Label>
                    <Input id="c-slug" value={form.slug} onChange={set('slug')} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="c-domain">Domínio</Label>
                    <Input id="c-domain" value={form.domain} onChange={set('domain')} />
                  </div>
                </div>
              </div>
            )}

            {/* Branding: logo + favicon + cores */}
            <div className="rounded-lg border p-4">
              <p className="mb-3 text-sm font-medium">Identidade visual (logo aparece no topo do sistema)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="c-logo">URL da LOGO *</Label>
                  <Input id="c-logo" value={form.logo_url} onChange={set('logo_url')} placeholder="https://cdn.../logo.png" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-favicon">URL do favicon</Label>
                  <Input id="c-favicon" value={form.favicon_url} onChange={set('favicon_url')} placeholder="https://cdn.../favicon.png" />
                </div>
              </div>
              {form.logo_url && (
                <div className="mt-3 flex items-center gap-3 rounded-md bg-muted/40 p-3">
                  <img src={form.logo_url} alt="Prévia da logo" className="h-12 w-12 rounded-lg object-contain" referrerPolicy="no-referrer" />
                  <span className="text-xs text-muted-foreground">Prévia — a logo aparecerá no canto superior esquerdo do painel da empresa e do cliente.</span>
                </div>
              )}
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="c-pcolor">Cor primária</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" className="h-9 w-12 rounded border" value={form.primary_color} onChange={(e) => setForm((p) => ({ ...p, primary_color: e.target.value }))} />
                    <Input id="c-pcolor" value={form.primary_color} onChange={set('primary_color')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-scolor">Cor secundária</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" className="h-9 w-12 rounded border" value={form.secondary_color} onChange={(e) => setForm((p) => ({ ...p, secondary_color: e.target.value }))} />
                    <Input id="c-scolor" value={form.secondary_color} onChange={set('secondary_color')} />
                  </div>
                </div>
              </div>
            </div>

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : editing ? 'Salvar branding' : 'Criar empresa'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}