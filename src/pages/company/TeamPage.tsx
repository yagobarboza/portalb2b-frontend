import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Send, Shield, Trash2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { PERMISSIONS, PERMISSION_GROUPS } from '../../lib/constants';
import type { PermissionCode } from '../../lib/constants';
import type { InviteResponse, Role, RoleList, UserPage, UserRead } from '@/types/api';
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

const PAGE_SIZE = 20;

const ROLE_LABELS: Record<string, string> = {
  products: 'Produtos e Catálogo',
  orders: 'Pedidos',
  tickets: 'Tickets',
  financial: 'Financeiro',
  admin: 'Administração',
};

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

const statusBadge = (status: string) => {
  if (status === 'active') return <Badge variant="default">Ativo</Badge>;
  if (status === 'inactive') return <Badge variant="secondary">Inativo</Badge>;
  return <Badge variant="destructive">Bloqueado</Badge>;
};

export default function TeamPage() {
  const { user: me, hasPermission } = useAuth();
  const can = (p: string) => hasPermission(p);

  const [users, setUsers] = useState<UserRead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [invites, setInvites] = useState<InviteResponse[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRead | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<UserRead | null>(null);
  const [cancelInvite, setCancelInvite] = useState<InviteResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRoleSlug, setInviteRoleSlug] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editStatus, setEditStatus] = useState('active');
  const [editError, setEditError] = useState<string | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleSlug, setRoleSlug] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [rolePerms, setRolePerms] = useState<PermissionCode[]>([]);
  const [roleError, setRoleError] = useState<string | null>(null);

  const loadRoles = useCallback(async () => {
    try {
      const data = await api.get<RoleList>('/roles');
      setRoles(data.items);
    } catch {
      toast.error('Não foi possível carregar os perfis de acesso.');
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<UserPage>('/users', { page, page_size: PAGE_SIZE });
      // ✅ BUG 3: GET /users retorna TODOS os usuários do tenant, inclusive
      // clientes (role 'cliente'). Equipe = apenas quem NÃO é cliente.
      // Os clientes continuam visíveis apenas na página "Clientes".
      const team = data.items.filter((u) => !u.roles?.includes('cliente'));
      setUsers(team);
      setTotal(team.length);
      setPages(1);
    } catch {
      toast.error('Não foi possível carregar a equipe.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  const loadInvites = useCallback(async () => {
    try {
      const data = await api.get<InviteResponse[]>('/invitations');
      setInvites(data);
    } catch {
      setInvites([]);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { loadRoles(); }, [loadRoles]);
  useEffect(() => { loadInvites(); }, [loadInvites]);

  // ✅ BUG 3: perfis válidos p/ convidar membro da equipe — TODOS os perfis
  // do tenant (admin, vendedor, financeiro, suporte + customizados),
  // excluindo 'cliente' (comprador) e 'super_admin' (global).
  const selectableRoles = roles.filter(
    (r) => r.slug !== 'cliente' && r.slug !== 'super_admin'
  );

  const submitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setInviteError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      setInviteError('Informe um e-mail válido.');
      return;
    }
    if (!inviteRoleSlug) {
      setInviteError('Selecione o perfil de acesso.');
      return;
    }
    setSaving(true);
    try {
      await api.post<InviteResponse>('/invitations', {
        email: inviteEmail.trim(),
        full_name: inviteName.trim() || null,
        role_slug: inviteRoleSlug,
      });
      toast.success('Convite enviado. O colaborador receberá um link de acesso.');
      setInviteOpen(false);
      setInviteEmail('');
      setInviteName('');
      setInviteRoleSlug('');
      loadInvites();
    } catch (err) {
      setInviteError(err instanceof ApiError ? err.message : 'Erro ao enviar convite.');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (u: UserRead) => {
    setEditUser(u);
    setEditRoles(u.roles);
    setEditStatus(u.status);
    setEditError(null);
  };

  const toggleEditRole = (slug: string) => {
    setEditRoles((prev) =>
      prev.includes(slug) ? prev.filter((r) => r !== slug) : [...prev, slug]
    );
    setEditError(null);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser || saving) return;
    setEditError(null);
    if (editRoles.length === 0) {
      setEditError('Selecione ao menos um perfil de acesso.');
      return;
    }
    setSaving(true);
    try {
      await api.patch<UserRead>(`/users/${editUser.id}`, {
        role_slugs: editRoles,
        status: editStatus,
      });
      toast.success('Colaborador atualizado.');
      setEditUser(null);
      loadUsers();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : 'Erro ao atualizar colaborador.');
    } finally {
      setSaving(false);
    }
  };

  const isSelf = (u: UserRead) => me?.id === u.id;

  const confirmDeactivate = async () => {
    if (!deactivateTarget || saving) return;
    setSaving(true);
    try {
      await api.delete(`/users/${deactivateTarget.id}`);
      toast.success('Colaborador desativado.');
      setDeactivateTarget(null);
      loadUsers();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao desativar colaborador.');
    } finally {
      setSaving(false);
    }
  };

  const confirmCancelInvite = async () => {
    if (!cancelInvite || saving) return;
    setSaving(true);
    try {
      await api.delete(`/invitations/${cancelInvite.id}`);
      toast.success('Convite cancelado.');
      setCancelInvite(null);
      loadInvites();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao cancelar convite.');
    } finally {
      setSaving(false);
    }
  };

  const toggleRolePerm = (code: PermissionCode) => {
    setRolePerms((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
    setRoleError(null);
  };

  const slugify = (value: string) =>
    value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '');

  const submitRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setRoleError(null);
    if (roleName.trim().length < 2) { setRoleError('Informe o nome do perfil.'); return; }
    const slug = slugify(roleSlug || roleName);
    if (!/^[a-z0-9-_]+$/.test(slug)) { setRoleError('Identificador inválido (use minúsculas, números, hífen).'); return; }
    setSaving(true);
    try {
      await api.post<Role>('/roles', {
        name: roleName.trim(),
        slug,
        description: roleDescription.trim() || null,
        permission_codes: rolePerms,
      });
      toast.success('Perfil de acesso criado.');
      setRoleOpen(false);
      setRoleName(''); setRoleSlug(''); setRoleDescription(''); setRolePerms([]);
      loadRoles();
    } catch (err) {
      setRoleError(err instanceof ApiError ? err.message : 'Erro ao criar perfil.');
    } finally {
      setSaving(false);
    }
  };

  const pendingInvites = invites.length;

  return (
    <div>
      <PageHeading
        title="Equipe"
        description="Gerencie acessos, convites e perfis de permissão."
        action={
          <div className="flex gap-2">
            {can(PERMISSIONS.ADMIN_MANAGE) && (
              <Dialog open={roleOpen} onOpenChange={(o) => { setRoleOpen(o); if (!o) { setRoleName(''); setRoleSlug(''); setRoleDescription(''); setRolePerms([]); setRoleError(null); } }}>
                <DialogTrigger asChild>
                  <Button variant="outline"><Shield className="mr-2 h-4 w-4" />Perfis de acesso</Button>
                </DialogTrigger>
                {/* ✅ Scroll: permite rolar para baixo no dialog */}
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Perfis de acesso (Roles)</DialogTitle></DialogHeader>
                  <div className="max-h-72 space-y-2 overflow-auto">
                    {roles.map((r) => (
                      <div key={r.id} className="flex items-start justify-between gap-2 rounded-md border p-3">
                        <div>
                          <p className="text-sm font-medium">
                            {r.name}
                            {r.is_system && <Badge className="ml-2">Sistema</Badge>}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">{r.slug}</p>
                          {r.description && <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={submitRole} className="space-y-4 border-t pt-4" noValidate>
                    <p className="text-sm font-medium">Criar novo perfil</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="role-name">Nome *</Label>
                        <Input id="role-name" value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="Ex.: Vendedor Premium" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role-slug">Identificador (slug)</Label>
                        <Input id="role-slug" value={roleSlug} onChange={(e) => setRoleSlug(e.target.value)} placeholder="vendedor-premium" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role-desc">Descrição</Label>
                      <Input id="role-desc" value={roleDescription} onChange={(e) => setRoleDescription(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Permissões</Label>
                      {Object.entries(PERMISSION_GROUPS).map(([domain, codes]) => (
                        <div key={domain} className="rounded-md border p-3">
                          <p className="mb-2 text-sm font-medium">{ROLE_LABELS[domain] ?? domain}</p>
                          <div className="grid gap-1.5 sm:grid-cols-2">
                            {codes.map((code) => (
                              <label key={code} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-input"
                                  checked={rolePerms.includes(code)}
                                  onChange={() => toggleRolePerm(code)}
                                />
                                <span className="font-mono text-xs">{code}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    {roleError && <p role="alert" className="text-sm text-destructive">{roleError}</p>}
                    <DialogFooter>
                      <Button type="submit" disabled={saving}>{saving ? 'Criando…' : 'Criar perfil'}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
            {can(PERMISSIONS.USER_CREATE) && (
              <Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) setInviteError(null); }}>
                <DialogTrigger asChild>
                  <Button><Send className="mr-2 h-4 w-4" />Convidar membro</Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>Convidar membro da equipe</DialogTitle></DialogHeader>
                  <form onSubmit={submitInvite} className="space-y-4" noValidate>
                    <div className="space-y-2">
                      <Label htmlFor="invite-email">E-mail *</Label>
                      <Input id="invite-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colaborador@empresa.com.br" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invite-name">Nome completo</Label>
                      <Input id="invite-name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Perfil de acesso *</Label>
                      <Select value={inviteRoleSlug} onValueChange={(value) => { setInviteRoleSlug(value); setInviteError(null); }}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Selecione o perfil" /></SelectTrigger>
                        <SelectContent>
                          {selectableRoles.map((r) => (
                            <SelectItem key={r.id} value={r.slug}>{r.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {inviteError && <p role="alert" className="text-sm text-destructive">{inviteError}</p>}
                    <DialogFooter>
                      <Button type="submit" disabled={saving}>{saving ? 'Enviando…' : 'Enviar convite'}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        }
      />

      {pendingInvites > 0 && can(PERMISSIONS.USER_READ) && (
        <Card className="mb-5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Convites pendentes <span className="font-normal text-muted-foreground">({pendingInvites})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Expira em</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell><Badge variant="secondary">{inv.role_slug}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(inv.expires_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      {can(PERMISSIONS.USER_DELETE) && (
                        <Button size="icon" variant="ghost" onClick={() => setCancelInvite(inv)} aria-label="Cancelar convite">
                          <Trash2 className="h-4 w-4 text-destructive" />
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Membros da equipe <span className="font-normal text-muted-foreground">({total})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="py-10 text-center text-muted-foreground">Carregando…</p>
          ) : users.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">Nenhum membro encontrado.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Perfis</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const self = isSelf(u);
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          {u.full_name}
                          {self && <Badge className="ml-2">Você</Badge>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {u.roles.map((slug) => (
                              <Badge key={slug} variant="secondary">{slug}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{statusBadge(u.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {can(PERMISSIONS.USER_UPDATE) && (
                              <Button size="icon" variant="ghost" onClick={() => openEdit(u)} aria-label={`Editar ${u.full_name}`}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {can(PERMISSIONS.USER_DELETE) && !self && u.status === 'active' && (
                              <Button size="icon" variant="ghost" onClick={() => setDeactivateTarget(u)} aria-label={`Desativar ${u.full_name}`}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {pages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-xs text-muted-foreground">Página {page} de {pages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                    <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editUser} onOpenChange={(o) => { if (!o) setEditUser(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar colaborador</DialogTitle></DialogHeader>
          {editUser && (
            <form onSubmit={submitEdit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={editUser.full_name} disabled />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input value={editUser.email} disabled />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={(value) => { setEditStatus(value); setEditError(null); }}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                    <SelectItem value="blocked">Bloqueado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Perfis de acesso</Label>
                <div className="max-h-48 space-y-1 overflow-auto rounded-md border p-3">
                  {roles.filter((r) => r.slug !== 'super_admin').map((r) => (
                    <label key={r.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input"
                        checked={editRoles.includes(r.slug)}
                        onChange={() => toggleEditRole(r.slug)}
                      />
                      <span>{r.name}</span>
                      {r.is_system && <span className="text-xs text-muted-foreground">(sistema)</span>}
                    </label>
                  ))}
                </div>
              </div>
              {editError && <p role="alert" className="text-sm text-destructive">{editError}</p>}
              <DialogFooter>
                <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deactivateTarget} onOpenChange={(o) => { if (!o) setDeactivateTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar colaborador?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateTarget?.full_name} perderá o acesso ao painel. Essa ação pode ser revertida reativando o usuário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDeactivate} disabled={saving}>
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!cancelInvite} onOpenChange={(o) => { if (!o) setCancelInvite(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar convite?</AlertDialogTitle>
            <AlertDialogDescription>
              O convite para {cancelInvite?.email} será invalidado e o link de acesso deixará de funcionar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmCancelInvite} disabled={saving}>
              Cancelar convite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}