import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { FileUp, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { uploadCustomersCsv } from '../../lib/uploads';
import type { Customer, CustomerImportResult, CustomerPage } from '@/types/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '../../components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

const PAGE_SIZE = 20;

interface CustomerForm {
  name: string;
  email: string;
  phone: string;
  document: string;
}

const emptyForm: CustomerForm = { name: '', email: '', phone: '', document: '' };

function PageHeading({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
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

const statusBadge = (status: Customer['status']) => {
  if (status === 'active') return <Badge variant="default">Ativo</Badge>;
  if (status === 'inactive') return <Badge variant="secondary">Inativo</Badge>;
  return <Badge variant="destructive">Bloqueado</Badge>;
};

export default function ClientsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  // Importação CSV
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<CustomerImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Debounce da busca.
  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<CustomerPage>('/customers', {
        page,
        page_size: PAGE_SIZE,
        search: searchDebounced || undefined,
      });
      setCustomers(data.items);
      setTotal(data.total);
      setPages(data.pages || 1);
    } catch {
      toast.error('Não foi possível carregar os clientes.');
    } finally {
      setLoading(false);
    }
  }, [page, searchDebounced]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => { setForm(emptyForm); setFormError(null); };

  const setField = (field: keyof CustomerForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      setFormError(null);
    };

  const validate = (): string | null => {
    if (form.name.trim().length < 2) return 'Informe o nome do cliente.';
    if (form.email.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'E-mail inválido.';
    }
    if (form.document.trim()) {
      const digits = form.document.replace(/\D/g, '');
      if (digits.length !== 11 && digits.length !== 14) return 'Documento inválido (CPF 11 ou CNPJ 14 dígitos).';
    }
    return null;
  };

  const buildPayload = () => ({
    name: form.name.trim(),
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    document: form.document.trim() || null,
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const invalid = validate();
    if (invalid) { setFormError(invalid); return; }
    setSaving(true);
    setFormError(null);
    try {
      await api.post<Customer>('/customers', buildPayload());
      toast.success(
        form.email.trim()
          ? 'Cliente cadastrado. Convite de acesso enviado ao e-mail.'
          : 'Cliente cadastrado.'
      );
      setCreateOpen(false);
      resetForm();
      if (page !== 1) setPage(1); else load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Erro ao cadastrar cliente.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCustomer || saving) return;
    const invalid = validate();
    if (invalid) { setFormError(invalid); return; }
    setSaving(true);
    setFormError(null);
    try {
      await api.patch<Customer>(`/customers/${editCustomer.id}`, buildPayload());
      toast.success('Cliente atualizado.');
      setEditCustomer(null);
      resetForm();
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Erro ao atualizar cliente.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeactivate = async () => {
    if (!deactivateTarget) return;
    setSaving(true);
    try {
      // Soft delete no backend (marca como inativo).
      await api.delete(`/customers/${deactivateTarget.id}`);
      toast.success('Cliente desativado.');
      setDeactivateTarget(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao desativar cliente.');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (c: Customer) => {
    setEditCustomer(c);
    setForm({
      name: c.name,
      email: c.email ?? '',
      phone: c.phone ?? '',
      document: c.document ?? '',
    });
    setFormError(null);
  };

  const onPickCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImportError(null);
    setImportResult(null);
    if (!file) return;
    setImporting(true);
    try {
      const result = await uploadCustomersCsv(file);
      setImportResult(result);
      if (result.created > 0) {
        toast.success(`${result.created} cliente(s) importado(s).`);
        if (page !== 1) setPage(1); else load();
      } else {
        toast.info('Nenhum cliente novo importado.');
      }
    } catch (err) {
      setImportError(err instanceof ApiError ? err.message : 'Erro ao importar o arquivo.');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <PageHeading
        title="Clientes"
        description="Cadastre clientes, gerencie status e importe em lote."
        action={
          <div className="flex gap-2">
            <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) { setImportResult(null); setImportError(null); } }}>
              <DialogTrigger asChild>
                <Button variant="outline"><FileUp className="mr-2 h-4 w-4" />Importar CSV</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Importar clientes (CSV)</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Envie um arquivo <code>.csv</code> com as colunas:{' '}
                    <code>name</code>, <code>email</code>, <code>phone</code>, <code>document</code>.
                    Clientes com e-mail recebem convite de acesso automaticamente.
                  </p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={onPickCsv}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={importing}
                    onClick={() => fileRef.current?.click()}
                  >
                    <FileUp className="mr-2 h-4 w-4" />
                    {importing ? 'Importando…' : 'Escolher arquivo CSV'}
                  </Button>

                  {importError && <p role="alert" className="text-sm text-destructive">{importError}</p>}

                  {importResult && (
                    <div className="space-y-3 rounded-lg border p-4">
                      <div className="flex gap-4 text-sm">
                        <span className="text-emerald-600 font-medium">Criados: {importResult.created}</span>
                        <span className="text-muted-foreground">Ignorados: {importResult.skipped}</span>
                      </div>
                      {importResult.errors.length > 0 && (
                        <div>
                          <p className="mb-2 text-sm font-medium text-destructive">
                            {importResult.errors.length} linha(s) com erro:
                          </p>
                          <div className="max-h-48 overflow-auto rounded border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Dados da linha</TableHead>
                                  <TableHead>Erro</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {importResult.errors.map((err, i) => (
                                  <TableRow key={i}>
                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                      {JSON.stringify(err.row)}
                                    </TableCell>
                                    <TableCell className="text-xs text-destructive">{err.error}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Novo cliente</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Cadastrar cliente</DialogTitle></DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4" noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input id="name" value={form.name} onChange={setField('name')} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" value={form.email} onChange={setField('email')} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input id="phone" value={form.phone} onChange={setField('phone')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="document">CPF/CNPJ</Label>
                      <Input id="document" value={form.document} onChange={setField('document')} inputMode="numeric" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O fornecimento do e-mail gera um convite de acesso imediato para o cliente.
                  </p>
                  {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
                  <DialogFooter>
                    <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Cadastrar cliente'}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Busca */}
      <div className="relative mb-5 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nome ou documento"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Clientes <span className="font-normal text-muted-foreground">({total})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="py-10 text-center text-muted-foreground">Carregando…</p>
          ) : customers.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">Nenhum cliente encontrado.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>CPF/CNPJ</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">{c.email ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{c.phone ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{c.document ?? '—'}</TableCell>
                      <TableCell>{statusBadge(c.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(c)} aria-label={`Editar ${c.name}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {c.status === 'active' && (
                            <Button size="icon" variant="ghost" onClick={() => setDeactivateTarget(c)} aria-label={`Desativar ${c.name}`}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {pages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-xs text-muted-foreground">Página {page} de {pages}</p>
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

      {/* Edição */}
      <Dialog open={!!editCustomer} onOpenChange={(o) => { if (!o) { setEditCustomer(null); resetForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar cliente</DialogTitle></DialogHeader>
          {editCustomer && (
            <form onSubmit={handleEdit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome *</Label>
                <Input id="edit-name" value={form.name} onChange={setField('name')} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">E-mail</Label>
                <Input id="edit-email" type="email" value={form.email} onChange={setField('email')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Telefone</Label>
                  <Input id="edit-phone" value={form.phone} onChange={setField('phone')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-document">CPF/CNPJ</Label>
                  <Input id="edit-document" value={form.document} onChange={setField('document')} inputMode="numeric" />
                </div>
              </div>
              {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
              <DialogFooter>
                <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmação de desativação */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={(o) => { if (!o) setDeactivateTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateTarget?.name} será desativado e perderá o acesso ao portal. Essa ação pode ser revertida reativando o cadastro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDeactivate} disabled={saving}>
              Desativar cliente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}