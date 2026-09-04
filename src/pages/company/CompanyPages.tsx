import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { BarChart3, FileUp, Package, Pencil, Plus, Search, Trash2, Upload, Users } from 'lucide-react';
import { mockCustomers, mockOrders, mockProducts } from '../../data/mock';
import { formatCurrency, formatDate } from '../../lib/format';
import type { OrderStatus, Product } from '../../types';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../components/ui/alert-dialog';
import { Textarea } from '../../components/ui/textarea';

const statusLabel: Record<OrderStatus, string> = { submitted: 'Aguardando análise', approved: 'Aprovado', shipped: 'Enviado', cancelled: 'Cancelado' };
const statusClass: Record<OrderStatus, string> = { submitted: 'bg-amber-100 text-amber-800', approved: 'bg-blue-100 text-blue-800', shipped: 'bg-emerald-100 text-emerald-800', cancelled: 'bg-red-100 text-red-800' };

function PageHeading({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-7"><div><h1 className="text-3xl font-bold tracking-tight">{title}</h1><p className="mt-1 text-muted-foreground">{description}</p></div>{action}</div>;
}

export function DashboardPage() {
  const pending = mockOrders.filter((o) => o.status === 'submitted').length;
  const revenue = mockOrders.filter((o) => o.status !== 'cancelled').reduce((sum, o) => sum + o.total, 0);
  const kpis = [{ label: 'Total de pedidos', value: mockOrders.length, icon: Package, tone: 'text-blue-600 bg-blue-100' }, { label: 'Pedidos pendentes', value: pending, icon: BarChart3, tone: 'text-amber-600 bg-amber-100' }, { label: 'Clientes ativos', value: mockCustomers.filter((c) => c.status === 'ativo').length, icon: Users, tone: 'text-emerald-600 bg-emerald-100' }, { label: 'Receita acumulada', value: formatCurrency(revenue), icon: BarChart3, tone: 'text-violet-600 bg-violet-100' }];
  return <div><PageHeading title="Visão Geral" description="Acompanhe a operação da sua empresa em tempo real." action={<Button onClick={() => toast.info('Ação rápida disponível no catálogo')}><Plus className="mr-2 h-4 w-4" />Nova ação</Button>} /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis.map((k) => <Card key={k.label}><CardContent className="flex items-center gap-4 p-5"><div className={`rounded-xl p-3 ${k.tone}`}><k.icon className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">{k.label}</p><p className="text-2xl font-bold">{k.value}</p></div></CardContent></Card>)}</div><div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]"><Card><CardHeader><CardTitle>Pedidos por status</CardTitle></CardHeader><CardContent><div className="space-y-4">{(['submitted', 'approved', 'shipped', 'cancelled'] as OrderStatus[]).map((status) => { const count = mockOrders.filter((o) => o.status === status).length; return <div key={status}><div className="mb-1 flex justify-between text-sm"><span>{statusLabel[status]}</span><strong>{count}</strong></div><div className="h-2 rounded-full bg-muted"><div className={`h-2 rounded-full ${status === 'submitted' ? 'bg-amber-500' : status === 'approved' ? 'bg-blue-500' : status === 'shipped' ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${Math.max(8, count / mockOrders.length * 100)}%` }} /></div></div>})}</div></CardContent></Card><Card><CardHeader><CardTitle>Pedidos recentes</CardTitle></CardHeader><CardContent className="space-y-3">{mockOrders.slice(0, 5).map((o) => <div key={o.id} className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"><div className="min-w-0"><p className="font-medium">#{o.id.replace('order-', '')} · {o.customerName}</p><p className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</p></div><div className="text-right"><p className="font-semibold">{formatCurrency(o.total)}</p><Badge className={statusClass[o.status]}>{statusLabel[o.status]}</Badge></div></div>)}</CardContent></Card></div></div>;
}

export function CatalogPage() {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState(mockProducts);
  const [createOpen, setCreateOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [preview, setPreview] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const editFileRef = useRef<HTMLInputElement>(null);

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase()));

  const createProduct = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setProducts((prev) => [{ id: `prod-${Date.now()}`, sku: `TM-${Date.now().toString().slice(-6)}`, name: String(form.get('name')), category: String(form.get('category')), price: Number(form.get('price')), description: String(form.get('description') || 'Novo produto cadastrado'), stock: Number(form.get('stock')), imageUrl: preview, tenantId: 'tenant-1', active: true }, ...prev]);
    setCreateOpen(false); setPreview(''); toast.success('Produto cadastrado');
  };

  const updateProduct = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editProduct) return;
    const form = new FormData(e.currentTarget);
    setProducts((prev) => prev.map((p) => p.id === editProduct.id ? { ...p, name: String(form.get('name')), category: String(form.get('category')), price: Number(form.get('price')), description: String(form.get('description') || p.description), stock: Number(form.get('stock')), imageUrl: preview || p.imageUrl } : p));
    setEditProduct(null); setPreview(''); toast.success('Produto atualizado');
  };

  const confirmDelete = () => {
    if (!deleteProduct) return;
    setProducts((prev) => prev.filter((p) => p.id !== deleteProduct.id));
    toast.success('Produto excluído');
    setDeleteProduct(null);
  };

  const imageUpload = (onSet: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const reader = new FileReader(); reader.onload = () => onSet(String(reader.result)); reader.readAsDataURL(file); }
  };

  return (
    <div>
      <PageHeading title="Catálogo" description="Gerencie produtos, preços e disponibilidade." action={
        <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setPreview(''); }}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Cadastrar produto</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Cadastrar produto</DialogTitle></DialogHeader>
            <form onSubmit={createProduct} className="space-y-4">
              <div className="space-y-2"><Label>Nome</Label><Input name="name" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Categoria</Label><Input name="category" required /></div>
                <div className="space-y-2"><Label>Estoque</Label><Input name="stock" type="number" required /></div>
              </div>
              <div className="space-y-2"><Label>Preço</Label><Input name="price" type="number" step="0.01" required /></div>
              <div className="space-y-2"><Label>Descrição</Label><Textarea name="description" rows={2} /></div>
              <div className="rounded-lg border border-dashed p-4 text-center">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={imageUpload(setPreview)} />
                {preview ? <img src={preview} alt="Prévia" className="mx-auto h-24 rounded object-cover" /> : <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />}
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}><FileUp className="mr-2 h-4 w-4" />Escolher foto local</Button>
              </div>
              <DialogFooter><Button type="submit">Salvar produto</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      } />

      <div className="mb-5 flex max-w-md items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar produto ou categoria" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Imagem</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Estoque</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="h-10 w-10 overflow-hidden rounded-md bg-muted/60 flex items-center justify-center">
                    {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-muted-foreground/40" />}
                  </div>
                </TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell><Badge variant="secondary">{p.category}</Badge></TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{p.sku}</TableCell>
                <TableCell className="font-semibold">{formatCurrency(p.price)}</TableCell>
                <TableCell>{p.stock} un.</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditProduct(p); setPreview(''); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteProduct(p)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editProduct} onOpenChange={(o) => { if (!o) { setEditProduct(null); setPreview(''); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar produto</DialogTitle></DialogHeader>
          {editProduct && (
            <form onSubmit={updateProduct} className="space-y-4">
              <div className="space-y-2"><Label>Nome</Label><Input name="name" defaultValue={editProduct.name} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Categoria</Label><Input name="category" defaultValue={editProduct.category} required /></div>
                <div className="space-y-2"><Label>Estoque</Label><Input name="stock" type="number" defaultValue={editProduct.stock} required /></div>
              </div>
              <div className="space-y-2"><Label>Preço</Label><Input name="price" type="number" step="0.01" defaultValue={editProduct.price} required /></div>
              <div className="space-y-2"><Label>Descrição</Label><Textarea name="description" rows={2} defaultValue={editProduct.description} /></div>
              <div className="rounded-lg border border-dashed p-4 text-center">
                <input ref={editFileRef} type="file" accept="image/*" className="hidden" onChange={imageUpload(setPreview)} />
                {(preview || editProduct.imageUrl) ? <img src={preview || editProduct.imageUrl} alt="Prévia" className="mx-auto h-24 rounded object-cover" /> : <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />}
                <Button type="button" variant="outline" onClick={() => editFileRef.current?.click()}><FileUp className="mr-2 h-4 w-4" />Escolher foto local</Button>
              </div>
              <DialogFooter><Button type="submit">Salvar alterações</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteProduct} onOpenChange={(o) => { if (!o) setDeleteProduct(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este produto? Essa ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>Excluir produto</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { default as CompanyOrdersPage } from './CompanyOrdersPage';
export { default as ClientsPage } from './ClientsPage';
export { default as TeamPage } from './TeamPage';
export { default as CompanyTicketsPage } from './CompanyTicketsPage';
export { default as CompanyChatPage } from './CompanyChatPage';
