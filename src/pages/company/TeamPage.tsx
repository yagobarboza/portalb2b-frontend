import { useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Send, UserCheck, UserX } from 'lucide-react';
import { mockTeamMembers } from '../../data/mock';
import type { TeamMember, TeamRole } from '../../types';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../components/ui/alert-dialog';

const ROLE_LABELS: Record<TeamRole, string> = {
  admin: 'Administrador',
  vendedor: 'Vendedor',
  suporte: 'Suporte',
  financeiro: 'Financeiro',
};

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

interface TeamForm {
  name: string;
  email: string;
  cpf: string;
  role: TeamRole;
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>(mockTeamMembers);
  const [open, setOpen] = useState(false);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [form, setForm] = useState<TeamForm>({ name: '', email: '', cpf: '', role: 'vendedor' });
  const [deactivateTarget, setDeactivateTarget] = useState<TeamMember | null>(null);

  const add = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setMembers((m) => [...m, {
      id: `team-${Date.now()}`,
      name: String(f.get('name')),
      email: String(f.get('email')),
      cpf: String(f.get('cpf') || ''),
      role: String(f.get('role')) as TeamRole,
      tenantId: 'tenant-1',
      active: true,
      joinedAt: new Date().toISOString(),
    }]);
    setOpen(false);
    toast.success('Convite enviado');
  };

  const openEdit = (m: TeamMember) => {
    setEditMember(m);
    setForm({ name: m.name, email: m.email, cpf: m.cpf || '', role: m.role });
  };

  const saveEdit = () => {
    if (!editMember) return;
    setMembers((prev) => prev.map((m) =>
      m.id === editMember.id
        ? { ...m, name: form.name, email: form.email, cpf: form.cpf, role: form.role }
        : m
    ));
    setEditMember(null);
    toast.success('Colaborador atualizado');
  };

  const toggleActive = (id: string) => {
    setMembers((prev) => prev.map((m) =>
      m.id === id ? { ...m, active: !m.active } : m
    ));
    const member = members.find((m) => m.id === id);
    toast.success(`Colaborador ${member?.active ? 'desativado' : 'ativado'}`);
  };

  const confirmDeactivate = () => {
    if (!deactivateTarget) return;
    setMembers((prev) => prev.map((m) =>
      m.id === deactivateTarget.id ? { ...m, active: false } : m
    ));
    toast.success('Colaborador desativado');
    setDeactivateTarget(null);
  };

  const renderForm = (isEdit: boolean) => (
    <form onSubmit={isEdit ? (e) => { e.preventDefault(); saveEdit(); } : add} className="space-y-4">
      <div className="space-y-2">
        <Label>Nome</Label>
        <Input name="name" required defaultValue={isEdit ? form.name : undefined} value={isEdit ? form.name : undefined} onChange={isEdit ? (e) => setForm((f) => ({ ...f, name: e.target.value })) : undefined} />
      </div>
      <div className="space-y-2">
        <Label>Email</Label>
        <Input name="email" type="email" required defaultValue={isEdit ? form.email : undefined} value={isEdit ? form.email : undefined} onChange={isEdit ? (e) => setForm((f) => ({ ...f, email: e.target.value })) : undefined} />
      </div>
      <div className="space-y-2">
        <Label>CPF</Label>
        <Input name="cpf" placeholder="000.000.000-00" defaultValue={isEdit ? form.cpf : undefined} value={isEdit ? form.cpf : undefined} onChange={isEdit ? (e) => setForm((f) => ({ ...f, cpf: e.target.value })) : undefined} />
      </div>
      <div className="space-y-2">
        <Label>Perfil</Label>
        <select
          name="role"
          defaultValue={isEdit ? form.role : 'vendedor'}
          value={isEdit ? form.role : undefined}
          onChange={isEdit ? (e) => setForm((f) => ({ ...f, role: e.target.value as TeamRole })) : undefined}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        >
          <option value="vendedor">Vendedor</option>
          <option value="suporte">Suporte</option>
          <option value="financeiro">Financeiro</option>
          <option value="admin">Administrador</option>
        </select>
      </div>
      <DialogFooter>
        <Button type="submit">{isEdit ? 'Salvar alterações' : 'Enviar convite'}</Button>
      </DialogFooter>
    </form>
  );

  return (
    <div>
      <PageHeading title="Equipe" description="Gerencie os acessos e responsabilidades do time." action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Send className="mr-2 h-4 w-4" />Convidar membro</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Convidar membro</DialogTitle></DialogHeader>
            {renderForm(false)}
          </DialogContent>
        </Dialog>
      } />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((m) => (
          <Card key={m.id} className={m.active ? '' : 'opacity-60'}>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 font-bold text-primary flex-shrink-0">
                  {m.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{m.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{m.email}</p>
                  {m.cpf && <p className="text-xs text-muted-foreground">CPF: {m.cpf}</p>}
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="secondary">{ROLE_LABELS[m.role]}</Badge>
                    <span className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${m.active ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                      <span className="text-xs text-muted-foreground">{m.active ? 'Ativo' : 'Inativo'}</span>
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-end gap-2 border-t pt-3">
                <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />Editar
                </Button>
                {m.active ? (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeactivateTarget(m)}>
                    <UserX className="mr-1.5 h-3.5 w-3.5" />Desativar
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className="text-emerald-600" onClick={() => toggleActive(m.id)}>
                    <UserCheck className="mr-1.5 h-3.5 w-3.5" />Ativar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editMember} onOpenChange={(o) => { if (!o) setEditMember(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar colaborador</DialogTitle></DialogHeader>
          {renderForm(true)}
        </DialogContent>
      </Dialog>

      {/* Deactivate confirmation */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={(o) => { if (!o) setDeactivateTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar colaborador?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateTarget?.name} perderá acesso ao sistema, mas seus registros históricos serão mantidos. Você poderá reativá-lo a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDeactivate}>Desativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
