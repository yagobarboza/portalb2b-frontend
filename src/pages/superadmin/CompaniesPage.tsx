import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Building2, Plus, Search } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import type { Company, CompanyPage } from '../../types/api';
import { isValidHexColor } from '../../lib/branding';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

const PAGE_SIZE = 20;
const SLUG_RE = /^[a-z0-9-]+$/;

interface CompanyForm {
  name: string;
  cnpj: string;
  slug: string;
  domain: string;
  primary_color: string;
  secondary_color: string;
  admin_email: string;
  admin_full_name: string;
}

const emptyForm: CompanyForm = {
  name: '',
  cnpj: '',
  slug: '',
  domain: '',
  primary_color: '',
  secondary_color: '',
  admin_email: '',
  admin_full_name: '',
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<CompanyPage>('/companies', {
        page,
        page_size: PAGE_SIZE,
        search: search || undefined,
      });
      setCompanies(data.items);
      setTotal(data.total);
    } catch {
      toast.error('Não foi possível carregar as empresas.');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  const activeCount = companies.filter((c) => c.status === 'active').length;
  const inactiveCount = companies.filter((c) => c.status === 'inactive').length;

  const setField = (field: keyof CompanyForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setFormError(null);
  };

  // Validação local espelhando o backend — nunca confia só no servidor.
  const validate = (): string | null => {
    if (form.name.trim().length < 2) return 'Informe o nome da empresa.';
    const digits = form.cnpj.replace(/\D/g, '');
    if (digits.length < 14) return 'CNPJ inválido (mínimo 14 dígitos).';
    if (!SLUG_RE.test(form.slug)) return 'Identificador (slug) inválido: use apenas letras minúsculas, números e hífen.';
    if (form.primary_color && !isValidHexColor(form.primary_color)) return 'Cor primária inválida (use formato #RRGGBB).';
    if (form.secondary_color && !isValidHexColor(form.secondary_color)) return 'Cor secundária inválida (use formato #RRGGBB).';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.admin_email)) return 'E-mail do administrador inválido.';
    if (form.admin_full_name.trim().length < 2) return 'Informe o nome do administrador.';
    return null;
  };

  const create = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    const invalid = validate();
    if (invalid) {
      setFormError(invalid);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await api.post('/companies', {
        name: form.name.trim(),
        cnpj: form.cnpj.replace(/\D/g, ''),
        slug: form.slug.trim(),
        domain: form.domain.trim() || undefined,
        primary_color: form.primary_color.trim() || undefined,
        secondary_color: form.secondary_color.trim() || undefined,
        admin_email: form.admin_email.trim(),
        admin_full_name: form.admin_full_name.trim(),
      });
      toast.success('Empresa criada. Convite enviado ao administrador.');
      setOpen(false);
      setForm(emptyForm);
      setPage(1);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Erro ao criar empresa.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-rose-600">Administração global</p>
          <h1 className="text-3xl font-bold tracking-tight">Empresas</h1>
          <p className="mt-1 text-muted-foreground">Gerencie os tenants e a operação da plataforma.</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Nova empresa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar nova empresa</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="name">Nome da empresa</Label>
                <Input id="name" value={form.name} onChange={setField('name')} placeholder="Ex.: Nova Distribuidora" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input id="cnpj" value={form.cnpj} onChange={setField('cnpj')} placeholder="00.000.000/0000-00" inputMode="numeric" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Identificador (slug)</Label>
                <Input id="slug" value={form.slug} onChange={setField('slug')} placeholder="nova-distribuidora" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="domain">Domínio (opcional)</Label>
                <Input id="domain" value={form.domain} onChange={setField('domain')} placeholder="compras.minhaempresa.com.br" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="primary_color">Cor primária</Label>
                  <Input id="primary_color" value={form.primary_color} onChange={setField('primary_color')} placeholder="#1e40af" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondary_color">Cor secundária</Label>
                  <Input id="secondary_color" value={form.secondary_color} onChange={setField('secondary_color')} placeholder="#7c3aed" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin_email">E-mail do administrador</Label>
                <Input id="admin_email" type="email" value={form.admin_email} onChange={setField('admin_email')} placeholder="admin@empresa.com.br" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin_full_name">Nome do administrador</Label>
                <Input id="admin_full_name" value={form.admin_full_name} onChange={setField('admin_full_name')} placeholder="Nome completo" required />
              </div>

              {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}

              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Criando…' : 'Criar empresa'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 p-5">
          <div className="rounded-xl bg-blue-100 p-3 text-blue-700"><Building2 className="h-5 w-5" /></div>
          <div><p className="text-sm text-muted-foreground">Total de empresas</p><p className="text-2xl font-bold">{total}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Ativas</p><p className="text-2xl font-bold text-emerald-600">{activeCount}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Inativas</p><p className="text-2xl font-bold">{inactiveCount}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Empresas cadastradas</span>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por nome ou slug…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-muted-foreground">Carregando…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Identificador</TableHead>
                  <TableHead>Cor principal</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-semibold">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.cnpj ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{c.slug}</TableCell>
                    <TableCell>
                      {isValidHexColor(c.primary_color) ? (
                        <span className="mr-2 inline-block h-4 w-4 rounded-full align-middle" style={{ backgroundColor: c.primary_color }} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>
                        {c.status === 'active' ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}