import { useState } from 'react';
import { toast } from 'sonner';
import { Check, FileUp, Pencil, Plus, Search, Tag, Trash2, UserCheck, UserX } from 'lucide-react';
import { mockCustomers, mockProducts } from '../../data/mock';
import { formatCurrency } from '../../lib/format';
import type { Customer, CustomerPricing } from '../../types';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../components/ui/alert-dialog';
import { Switch } from '../../components/ui/switch';
import { Checkbox } from '../../components/ui/checkbox';
import { ScrollArea } from '../../components/ui/scroll-area';

const UF_LIST = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

function PageHeading({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-7">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function validateCnpj(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, '');
  return clean.length === 14;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateCep(cep: string): boolean {
  return /^\d{5}-?\d{3}$/.test(cep);
}

interface AddForm {
  cnpj: string;
  name: string;
  fantasyName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  cep: string;
}

const emptyForm: AddForm = {
  cnpj: '', name: '', fantasyName: '', email: '', phone: '', address: '', city: '', state: '', cep: '',
};

export default function ClientsPage() {
  const [search, setSearch] = useState('');
  const [imported, setImported] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>(mockCustomers);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<'activate' | 'deactivate' | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<AddForm>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof AddForm, string>>>({});
  const [pricingCustomer, setPricingCustomer] = useState<Customer | null>(null);

  const rows = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.cnpj.includes(search)
  );

  const toggleStatus = (id: string) => {
    setCustomers((prev) => prev.map((c) =>
      c.id === id ? { ...c, status: c.status === 'ativo' ? 'inativo' : 'ativo' } : c
    ));
    const customer = customers.find((c) => c.id === id);
    toast.success(`Cliente ${customer?.status === 'ativo' ? 'desativado' : 'ativado'}`);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === rows.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(rows.map((c) => c.id));
    }
  };

  const confirmBulkAction = () => {
    if (!bulkAction) return;
    const newStatus = bulkAction === 'activate' ? 'ativo' : 'inativo';
    setCustomers((prev) => prev.map((c) =>
      selectedIds.includes(c.id) ? { ...c, status: newStatus } : c
    ));
    toast.success(`${selectedIds.length} cliente(s) ${bulkAction === 'activate' ? 'ativado(s)' : 'desativado(s)'}`);
    setSelectedIds([]);
    setBulkAction(null);
  };

  const validateForm = (f: AddForm): Partial<Record<keyof AddForm, string>> => {
    const e: Partial<Record<keyof AddForm, string>> = {};
    if (!validateCnpj(f.cnpj)) e.cnpj = 'CNPJ deve ter 14 dígitos';
    if (!f.name.trim()) e.name = 'Razão social é obrigatória';
    if (!validateEmail(f.email)) e.email = 'E-mail inválido';
    if (!f.phone.trim()) e.phone = 'Telefone é obrigatório';
    if (!f.address.trim()) e.address = 'Endereço é obrigatório';
    if (!f.city.trim()) e.city = 'Cidade é obrigatória';
    if (!f.state) e.state = 'Estado é obrigatório';
    if (f.cep && !validateCep(f.cep)) e.cep = 'CEP inválido';
    return e;
  };

  const handleAdd = () => {
    const e = validateForm(form);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    const newCustomer: Customer = {
      id: `cust-${Date.now()}`,
      name: form.name,
      fantasyName: form.fantasyName || undefined,
      email: form.email,
      cnpj: form.cnpj,
      phone: form.phone,
      address: form.address,
      city: form.city,
      state: form.state,
      cep: form.cep || undefined,
      status: 'ativo',
      tenantId: 'tenant-1',
      negotiatedPrices: [],
    };
    setCustomers((prev) => [newCustomer, ...prev]);
    setAddOpen(false);
    setForm(emptyForm);
    setErrors({});
    toast.success('Cliente cadastrado com sucesso');
  };

  const handleEdit = () => {
    if (!editCustomer) return;
    const e = validateForm(form);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setCustomers((prev) => prev.map((c) =>
      c.id === editCustomer.id
        ? { ...c, name: form.name, fantasyName: form.fantasyName || undefined, email: form.email, cnpj: form.cnpj, phone: form.phone, address: form.address, city: form.city, state: form.state, cep: form.cep || undefined }
        : c
    ));
    setEditCustomer(null);
    setForm(emptyForm);
    setErrors({});
    toast.success('Cliente atualizado');
  };

  const openEdit = (c: Customer) => {
    setEditCustomer(c);
    setForm({
      cnpj: c.cnpj, name: c.name, fantasyName: c.fantasyName || '', email: c.email, phone: c.phone, address: c.address, city: c.city, state: c.state, cep: c.cep || '',
    });
  };

  const savePricing = (customerId: string, prices: CustomerPricing[]) => {
    setCustomers((prev) => prev.map((c) =>
      c.id === customerId ? { ...c, negotiatedPrices: prices } : c
    ));
    setPricingCustomer((prev) => prev ? { ...prev, negotiatedPrices: prices } : prev);
    toast.success('Preços negociados atualizados');
  };

  const renderForm = (isEdit: boolean) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>CNPJ</Label>
          <Input
            value={form.cnpj}
            onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
            placeholder="00.000.000/0000-00"
          />
          {errors.cnpj && <p className="text-xs text-destructive">{errors.cnpj}</p>}
        </div>
        <div className="space-y-2">
          <Label>Telefone</Label>
          <Input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="(00) 0000-0000"
          />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Razão Social</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Empresa Ltda"
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>
      <div className="space-y-2">
        <Label>Nome Fantasia</Label>
        <Input
          value={form.fantasyName}
          onChange={(e) => setForm((f) => ({ ...f, fantasyName: e.target.value }))}
          placeholder="Nome fantasia (opcional)"
        />
      </div>
      <div className="space-y-2">
        <Label>E-mail</Label>
        <Input
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          placeholder="contato@empresa.com.br"
        />
        {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
      </div>
      <div className="space-y-2">
        <Label>Endereço</Label>
        <Input
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          placeholder="Rua, número, complemento"
        />
        {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>Cidade</Label>
          <Input
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
          />
          {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
        </div>
        <div className="space-y-2">
          <Label>Estado</Label>
          <select
            value={form.state}
            onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="">UF</option>
            {UF_LIST.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
          {errors.state && <p className="text-xs text-destructive">{errors.state}</p>}
        </div>
        <div className="space-y-2">
          <Label>CEP</Label>
          <Input
            value={form.cep}
            onChange={(e) => setForm((f) => ({ ...f, cep: e.target.value }))}
            placeholder="00000-000"
          />
          {errors.cep && <p className="text-xs text-destructive">{errors.cep}</p>}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => { setAddOpen(false); setEditCustomer(null); setForm(emptyForm); setErrors({}); }}>
          Cancelar
        </Button>
        <Button onClick={isEdit ? handleEdit : handleAdd}>
          {isEdit ? 'Salvar alterações' : 'Cadastrar cliente'}
        </Button>
      </DialogFooter>
    </div>
  );

  return (
    <div>
      <PageHeading title="Clientes" description="Cadastre clientes, gerencie status e negocie preços especiais." action={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setImported(true); toast.success('CSV simulado importado com sucesso'); }}>
            <FileUp className="mr-2 h-4 w-4" />Importar CSV
          </Button>
          <Button onClick={() => { setForm(emptyForm); setErrors({}); setAddOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />Adicionar cliente
          </Button>
        </div>
      } />

      <div className="mb-5 flex items-center gap-2 max-w-md">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome, e-mail ou CNPJ" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {imported && (
        <Card className="mb-5 border-emerald-200 bg-emerald-50">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-emerald-800">
            <Check className="h-4 w-4" />Prévia importada: 3 novos registros prontos para revisão.
          </CardContent>
        </Card>
      )}

      {selectedIds.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/50 p-3">
          <span className="text-sm font-medium">{selectedIds.length} selecionado(s)</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setBulkAction('activate')}>
              <UserCheck className="mr-1.5 h-4 w-4" />Ativar selecionados
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkAction('deactivate')}>
              <UserX className="mr-1.5 h-4 w-4" />Desativar selecionados
            </Button>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>Limpar</Button>
        </div>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={rows.length > 0 && selectedIds.length === rows.length}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Localização</TableHead>
              <TableHead>Preços negociados</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id} className={selectedIds.includes(c.id) ? 'bg-muted/40' : ''}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.includes(c.id)}
                    onCheckedChange={() => toggleSelect(c.id)}
                  />
                </TableCell>
                <TableCell>
                  <p className="font-semibold">{c.name}</p>
                  {c.fantasyName && <p className="text-xs text-muted-foreground">{c.fantasyName}</p>}
                  <p className="text-xs text-muted-foreground">{c.cnpj}</p>
                </TableCell>
                <TableCell>
                  <p>{c.email}</p>
                  <p className="text-xs text-muted-foreground">{c.phone}</p>
                </TableCell>
                <TableCell>{c.city}/{c.state}</TableCell>
                <TableCell>
                  <Badge variant={c.negotiatedPrices.length > 0 ? 'default' : 'secondary'}>
                    {c.negotiatedPrices.length} produto(s)
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={c.status === 'ativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground'}>
                    {c.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end items-center gap-1">
                    <Button size="icon" variant="ghost" title="Preços negociados" onClick={() => setPricingCustomer(c)}>
                      <Tag className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" title="Editar" onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Switch
                      checked={c.status === 'ativo'}
                      onCheckedChange={() => toggleStatus(c.id)}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) { setForm(emptyForm); setErrors({}); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar cliente</DialogTitle>
          </DialogHeader>
          {renderForm(false)}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editCustomer} onOpenChange={(o) => { if (!o) { setEditCustomer(null); setForm(emptyForm); setErrors({}); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
          </DialogHeader>
          {renderForm(true)}
        </DialogContent>
      </Dialog>

      {/* Bulk confirm */}
      <AlertDialog open={!!bulkAction} onOpenChange={(o) => { if (!o) setBulkAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkAction === 'activate' ? 'Ativar clientes selecionados?' : 'Desativar clientes selecionados?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === 'activate'
                ? `${selectedIds.length} cliente(s) serão ativados e poderão realizar pedidos novamente.`
                : `${selectedIds.length} cliente(s) serão desativados e não poderão realizar pedidos.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkAction}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Negotiated Prices Dialog */}
      {pricingCustomer && (
        <NegotiatedPricesDialog
          customer={pricingCustomer}
          onClose={() => setPricingCustomer(null)}
          onSave={savePricing}
        />
      )}
    </div>
  );
}

function NegotiatedPricesDialog({
  customer,
  onClose,
  onSave,
}: {
  customer: Customer;
  onClose: () => void;
  onSave: (customerId: string, prices: CustomerPricing[]) => void;
}) {
  const [prices, setPrices] = useState<CustomerPricing[]>([...customer.negotiatedPrices]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bulkPrice, setBulkPrice] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  const getPrice = (productId: string) => prices.find((p) => p.productId === productId)?.price;

  const setProductPrice = (productId: string, price: number | undefined) => {
    setPrices((prev) => {
      if (price === undefined || isNaN(price)) {
        return prev.filter((p) => p.productId !== productId);
      }
      const exists = prev.find((p) => p.productId === productId);
      if (exists) {
        return prev.map((p) => p.productId === productId ? { ...p, price } : p);
      }
      return [...prev, { productId, price }];
    });
  };

  const toggleProductSelect = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((x) => x !== productId) : [...prev, productId]
    );
  };

  const applyBulkPrice = () => {
    const price = Number(bulkPrice);
    if (isNaN(price) || selectedProductIds.length === 0) return;
    setPrices((prev) => {
      const updated = [...prev];
      selectedProductIds.forEach((pid) => {
        const idx = updated.findIndex((p) => p.productId === pid);
        if (idx >= 0) {
          updated[idx] = { productId: pid, price };
        } else {
          updated.push({ productId: pid, price });
        }
      });
      return updated;
    });
    toast.success(`Preço aplicado a ${selectedProductIds.length} produto(s)`);
    setSelectedProductIds([]);
    setBulkPrice('');
  };

  const removeBulkPrices = () => {
    setPrices((prev) => prev.filter((p) => !selectedProductIds.includes(p.productId)));
    toast.success(`Preços removidos de ${selectedProductIds.length} produto(s)`);
    setSelectedProductIds([]);
    setConfirmRemove(false);
  };

  const handleSave = () => {
    onSave(customer.id, prices);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Preços negociados — {customer.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Defina preços especiais por produto. O preço padrão é exibido para comparação.
          </p>

          {/* Bulk actions */}
          {selectedProductIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 p-3">
              <span className="text-sm font-medium">{selectedProductIds.length} selecionado(s)</span>
              <Input
                type="number"
                step="0.01"
                placeholder="Preço"
                value={bulkPrice}
                onChange={(e) => setBulkPrice(e.target.value)}
                className="w-32 h-8"
              />
              <Button size="sm" onClick={applyBulkPrice} disabled={!bulkPrice}>
                Aplicar preço
              </Button>
              <Button size="sm" variant="outline" className="text-destructive" onClick={() => setConfirmRemove(true)}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />Remover preços
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedProductIds([])}>Limpar</Button>
            </div>
          )}

          {/* Products table */}
          <ScrollArea className="h-[45vh] rounded-lg border">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Preço padrão</TableHead>
                  <TableHead>Preço negociado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockProducts.map((p) => {
                  const negotiated = getPrice(p.id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedProductIds.includes(p.id)}
                          onCheckedChange={() => toggleProductSelect(p.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.sku}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatCurrency(p.price)}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder={formatCurrency(p.price)}
                          value={negotiated ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setProductPrice(p.id, val === '' ? undefined : Number(val));
                          }}
                          className="h-8 w-28"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>

          <div className="flex items-center justify-between">
            <Badge variant="secondary">
              {prices.length} produto(s) com preço negociado
            </Badge>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleSave}>Salvar preços</Button>
            </DialogFooter>
          </div>
        </div>

        {/* Confirm bulk remove */}
        <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover preços negociados?</AlertDialogTitle>
              <AlertDialogDescription>
                Os preços negociados de {selectedProductIds.length} produto(s) serão removidos. Eles voltarão ao preço padrão.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={removeBulkPrices}>
                Remover preços
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
