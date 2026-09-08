import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { MoreVertical, Search, TicketIcon, UserCog } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api, ApiError } from '../../lib/api';
import {
  assignTicket, getTicket, listTickets, sendTicketMessage, updateTicketStatus,
} from '../../lib/ticketsApi';
import {
  ticketPriorityClass, ticketPriorityLabel, ticketStatusClass, ticketStatusLabel,
} from '../../lib/ticketStatus';
import { formatDateTime } from '../../lib/format';
import type {
  Ticket, TicketDetail, TicketPriority, TicketStatus, UserPage,
} from '@/types/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';

const PAGE_SIZE = 20;

export default function CompanyTicketsPage() {
  const { user } = useAuth();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | TicketStatus>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | TicketPriority>('all');

  // Atendentes (para atribuição)
  const [assignees, setAssignees] = useState<UserPage['items']>([]);

  // Detalhe
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [message, setMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);

  // Ações de gestão
  const [newStatus, setNewStatus] = useState<TicketStatus | ''>('');
  const [newAssignee, setNewAssignee] = useState<string>('');
  const [savingAction, setSavingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Debounce da busca.
  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  // Carrega atendentes do tenant p/ o select de atribuição (GET /users).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await api.get<UserPage>('/users', { page: 1, page_size: 100 });
        if (active) setAssignees(data.items);
      } catch {
        // Falha aqui não derruba a página; atribuição fica indisponível.
      }
    })();
    return () => { active = false; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listTickets({
        page,
        page_size: PAGE_SIZE,
        // O backend filtra por tenant; passamos apenas o que ele suporta.
        ...(filterStatus !== 'all' ? { status: filterStatus } : {}),
        ...(filterPriority !== 'all' ? { priority: filterPriority } : {}),
      });
      setTickets(data.items);
      setTotal(data.total);
      setPages(Math.ceil(data.total / data.page_size) || 1);
    } catch {
      toast.error('Não foi possível carregar os chamados.');
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterPriority]);

  useEffect(() => { load(); }, [load]);

  const openTicket = async (t: Ticket) => {
    setActionError(null);
    setMessage('');
    setIsInternal(false);
    setNewStatus('');
    setNewAssignee('');
    try {
      const full = await getTicket(t.id);
      setDetail(full);
    } catch {
      toast.error('Não foi possível abrir o chamado.');
    }
  };

  const submitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || sending) return;
    if (message.trim().length === 0) return;
    setSending(true);
    try {
      // Empresa pode enviar pública OU interna (is_internal=true → só a equipe vê).
      await sendTicketMessage(detail.id, message.trim(), isInternal);
      setMessage('');
      setIsInternal(false);
      setDetail(await getTicket(detail.id));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  };

  const applyStatus = async () => {
    if (!detail || !newStatus || savingAction) return;
    setSavingAction(true);
    setActionError(null);
    try {
      await updateTicketStatus(detail.id, newStatus);
      toast.success('Status do chamado atualizado.');
      setDetail(await getTicket(detail.id));
      setNewStatus('');
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Erro ao atualizar o status.');
    } finally {
      setSavingAction(false);
    }
  };

  const applyAssignee = async () => {
    if (!detail || !newAssignee || savingAction) return;
    setSavingAction(true);
    setActionError(null);
    try {
      await assignTicket(detail.id, newAssignee);
      toast.success('Responsável atribuído.');
      setDetail(await getTicket(detail.id));
      setNewAssignee('');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Erro ao atribuir responsável.');
    } finally {
      setSavingAction(false);
    }
  };

  const filtered = useMemo(() => {
    const term = searchDebounced.toLowerCase();
    if (!term) return tickets;
    return tickets.filter(
      (t) =>
        t.number.toLowerCase().includes(term) ||
        t.title.toLowerCase().includes(term) ||
        (t.category ?? '').toLowerCase().includes(term)
    );
  }, [tickets, searchDebounced]);

  return (
    <div>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Central de Atendimento</h1>
          <p className="mt-1 text-muted-foreground">Chamados de suporte do seu tenant.</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por número, título ou categoria…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="w-full sm:w-44">
          <Select
            value={filterStatus}
            onValueChange={(v) => { setFilterStatus(v as 'all' | TicketStatus); setPage(1); }}
          >
            <SelectTrigger className="w-full"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="open">Aberto</SelectItem>
              <SelectItem value="under_review">Em Análise</SelectItem>
              <SelectItem value="awaiting_customer">Aguardando Cliente</SelectItem>
              <SelectItem value="awaiting_company">Aguardando Empresa</SelectItem>
              <SelectItem value="resolved">Resolvido</SelectItem>
              <SelectItem value="closed">Fechado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-44">
          <Select
            value={filterPriority}
            onValueChange={(v) => { setFilterPriority(v as 'all' | TicketPriority); setPage(1); }}
          >
            <SelectTrigger className="w-full"><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as prioridades</SelectItem>
              <SelectItem value="low">Baixa</SelectItem>
              <SelectItem value="medium">Média</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="urgent">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Chamados <span className="font-normal text-muted-foreground">({total})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="py-10 text-center text-muted-foreground">Carregando…</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <TicketIcon className="mb-4 h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-semibold text-muted-foreground">Nenhum chamado encontrado</h3>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chamado</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Atualizado</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t) => (
                    <TableRow key={t.id} className="cursor-pointer" onClick={() => openTicket(t)}>
                      <TableCell className="font-medium">
                        #{t.number}
                        <span className="block max-w-[260px] truncate text-xs text-muted-foreground">{t.title}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{t.customer_id ?? '—'}</TableCell>
                      <TableCell>
                        <Badge className={ticketPriorityClass(t.priority)}>{ticketPriorityLabel(t.priority)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={ticketStatusClass(t.status)}>{ticketStatusLabel(t.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(t.updated_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" aria-label="Abrir chamado" onClick={(e) => { e.stopPropagation(); openTicket(t); }}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
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

      {/* Detalhe do chamado (empresa) */}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) { setDetail(null); setActionError(null); } }}>
        <DialogContent className="max-w-2xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>Chamado #{detail.number} · {detail.title}</DialogTitle>
              </DialogHeader>

              <div className="flex flex-wrap gap-2">
                <Badge className={ticketPriorityClass(detail.priority)}>{ticketPriorityLabel(detail.priority)}</Badge>
                <Badge className={ticketStatusClass(detail.status)}>{ticketStatusLabel(detail.status)}</Badge>
                {detail.category && <Badge variant="secondary">{detail.category}</Badge>}
                {detail.assignee_id && <Badge variant="outline">Resp.: {detail.assignee_id.slice(0, 8)}…</Badge>}
              </div>

              {/* Thread — empresa vê inclusive notas internas (is_internal) */}
              <div className="mt-4 max-h-72 space-y-2 overflow-auto rounded-md border p-3">
                {detail.messages.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
                )}
                {detail.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-md p-3 ${msg.is_internal ? 'border border-amber-200 bg-amber-50' : 'bg-muted/40'}`}
                  >
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {msg.is_internal
                          ? 'Nota interna'
                          : msg.author_customer_id
                            ? 'Cliente'
                            : msg.author_user_id === user?.id
                              ? 'Você'
                              : 'Atendente'}
                      </span>
                      {msg.is_internal && <Badge variant="secondary" className="text-[10px]">só equipe</Badge>}
                      <span>· {formatDateTime(msg.created_at)}</span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{msg.content}</p>
                  </div>
                ))}
              </div>

              {/* Controles de gestão (apenas empresa — backend revalida) */}
              <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="t-status">Alterar status</Label>
                  <div className="flex gap-2">
                    <Select value={newStatus || 'none'} onValueChange={(v) => setNewStatus(v === 'none' ? '' : (v as TicketStatus))}>
                      <SelectTrigger id="t-status" className="flex-1"><SelectValue placeholder="Novo status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Selecione…</SelectItem>
                        <SelectItem value="under_review">Em Análise</SelectItem>
                        <SelectItem value="awaiting_customer">Aguardando Cliente</SelectItem>
                        <SelectItem value="resolved">Resolvido</SelectItem>
                        <SelectItem value="closed">Fechado</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={applyStatus} disabled={savingAction || !newStatus}>
                      Aplicar
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-assignee">Atribuir responsável</Label>
                  <div className="flex gap-2">
                    <Select value={newAssignee || 'none'} onValueChange={(v) => setNewAssignee(v === 'none' ? '' : v)}>
                      <SelectTrigger id="t-assignee" className="flex-1"><SelectValue placeholder="Atendente" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Selecione…</SelectItem>
                        {assignees.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.full_name || a.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={applyAssignee} disabled={savingAction || !newAssignee}>
                      <UserCog className="mr-1 h-4 w-4" />Atribuir
                    </Button>
                  </div>
                </div>
              </div>

              {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}

              {/* Responder — com alternador de nota interna (is_internal) */}
              <form onSubmit={submitMessage} className="space-y-2">
                <div className="flex items-center gap-3">
                  <Label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                    />
                    Nota interna (visível apenas para a equipe)
                  </Label>
                </div>
                <div className="flex gap-2">
                  <Textarea
                    className="min-h-[60px] flex-1"
                    rows={2}
                    placeholder={isInternal ? 'Escreva uma nota interna…' : 'Escreva uma resposta ao cliente…'}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={4000}
                  />
                  <Button type="submit" disabled={sending || message.trim().length === 0}>
                    {sending ? 'Enviando…' : 'Enviar'}
                  </Button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}