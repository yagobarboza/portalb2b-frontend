import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FolderTree, Pencil, Plus, Tag } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import type { Category } from '@/types/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';

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

const slugify = (value: string) =>
  value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '');

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Category[]>('/catalog/categories');
      setCategories(data);
    } catch {
      toast.error('Não foi possível carregar as categorias.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEdit(null);
    setName('');
    setSlug('');
    setError(null);
    setOpen(true);
  };

  const openEdit = (c: Category) => {
    setEdit(c);
    setName(c.name);
    setSlug(c.slug);
    setError(null);
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError(null);
    if (name.trim().length < 2) { setError('Informe o nome da categoria.'); return; }
    const finalSlug = slugify(slug || name);
    if (!/^[a-z0-9-_]+$/.test(finalSlug)) { setError('Slug inválido (use minúsculas, números, hífen).'); return; }
    setSaving(true);
    try {
      if (edit) {
        await api.patch<Category>(`/catalog/categories/${edit.id}`, { name: name.trim(), slug: finalSlug });
        toast.success('Categoria atualizada.');
      } else {
        await api.post<Category>('/catalog/categories', { name: name.trim(), slug: finalSlug });
        toast.success('Categoria criada.');
      }
      setOpen(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar categoria.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeading
        title="Categorias"
        description="Organize seu catálogo criando categorias de produtos."
        action={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />Nova categoria
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="py-10 text-center text-muted-foreground">Carregando…</p>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FolderTree className="mb-3 h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-semibold text-muted-foreground">Nenhuma categoria</h3>
              <p className="mt-1 text-sm text-muted-foreground/70">
                Crie a primeira categoria para organizar seus produtos.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{c.slug}</p>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(c)} aria-label={`Editar ${c.name}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { if (!o) setOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{edit ? `Editar "${edit.name}"` : 'Nova categoria'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="cat-name">Nome *</Label>
              <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Eletrônicos" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-slug">Slug</Label>
              <Input id="cat-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="eletronicos" />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}