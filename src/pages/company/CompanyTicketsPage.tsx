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
  CustomerPage, Ticket, TicketDetail, TicketPriority, TicketStatus, UserPage,
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
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | TicketStatus>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | TicketPriority>('all');
  const [assignees, setAssignees] = useState<UserPage['items']>([]);
  // Mapas de nomes (cliente = empresa compradora; atendentes).
  const [customerMap, setCustomerMap] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [message, setMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [newStatus, setNewStatus] = useState<TicketStatus | ''>('');
  const [newAssignee, setNewAssignee] = useState<string>('');
  const [savingAction, setSavingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Debounce da busca.
  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  // Carrega atendentes (para atribuição) + clientes (para nomes).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const users = await api.get<UserPage>('/users', { page: 1, page_size: 100 });
        if (active) {
          setAssignees(users.items.filter((u: UserPage['items'][number]) => !u.roles?.includes('cliente')));
        }
      } catch {
        // Falha aqui não derruba a página.
      }
      try {
        const cust = await api.get<CustomerPage>('/customers', { page: 1, page_size: 100 });
        const cm: Record<string, string> = {};
        for (const c of cust.items) cm[c.id] = c.name;
        if (active) setCustomerMap(cm);
      } catch {
        // Falha aqui não derruba a página.
      }
    })();
    return () => { active = false; };
  }, []);

  // Mapa de nomes dos atendentes (do state assignees).
  const assigneeNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of assignees) map[u.id] = u.full_name;
    return map;
  }, [assignees]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listTickets({
        page,
        page_size: PAGE_SIZE,
        ...(filterStatus !== 'all' ? { status: filterStatus } : {}),
        ...(filterPriority !== 'all' ? { priority: filterPriority } : {}),
      });
      setTickets(data.items);
      setTotal(data.total);
      // TicketPage não tem "pages" — calcula a partir do total.
      setPages(Math.max(1, Math.ceil(data.total / PAGE_SIZE)));
    } catch {
      toast.error('Não foi possível carregar os chamados.');
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterPriority]);

  useEffect(() => { load(); }, [load]);

  const openTicket = async (t: Ticket) => {
    try {
      const full = await getTicket(t.id);
      setDetail(full);
      setActionError(null);
      setNewStatus('');
      setNewAssignee('');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao abrir o chamado.');
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || !message.trim() || sending) return;
    setSending(true);
    try {
      await sendTicketMessage(detail.id, message.trim(), isInternal);
      setMessage('');
      const full = await getTicket(detail.id);
      setDetail(full);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  };

  const saveStatus = async () => {
    if (!detail || !newStatus || savingAction) return;
    setSavingAction(true);
    setActionError(null);
    try {
      await updateTicketStatus(detail.id, newStatus);
      toast.success('Status atualizado.');
      setDetail(await getTicket(detail.id));
      setNewStatus('');
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Erro ao atualizar status.');
    } finally {
      setSavingAction(false);
    }
  };

  const saveAssignee = async () => {
    if (!detail || !newAssignee || savingAction) return;
    setSavingAction(true);
    setActionError(null);
    try {
      await assignTicket(detail.id, newAssignee);
      toast.success('Responsável atribuído.');
      setDetail(await getTicket(detail.id));
      setNewAssignee('');
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Erro ao atribuir responsável.');
    } finally {
      setSavingAction(false);
    }
  };

  const filtered = useMemo(() => {
    const term = searchDebounced.toLowerCase();
    if (!term) return tickets;
    return tickets.filter((t) =>
      t.title.toLowerCase().includes(term) ||
      t.number.toLowerCase().includes(term) ||
      customerMap[t.customer_id ?? '']?.toLowerCase().includes(term)
    );
  }, [tickets, searchDebounced, customerMap]);

  const customerName = (id?: string | null) => (id ? customerMap[id] ?? id.slice(0, 8) : '—');

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por título, nº ou cliente…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v as 'all' | TicketStatus); setPage(1); }}>
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
        <div className="w-full sm:w-48">
          <Select value={filterPriority} onValueChange={(v) => { setFilterPriority(v as 'all' | TicketPriority); setPage(1); }}>
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
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <TicketIcon className="mb-3 h-10 w-10 text-muted-foreground/40" />
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
                      <TableCell className="text-muted-foreground">{customerName(t.customer_id)}</TableCell>
                      <TableCell>
                        <Badge className={ticketPriorityClass(t.priority)}>{ticketPriorityLabel(t.priority)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={ticketStatusClass(t.status)}>{ticketStatusLabel(t.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(t.updated_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Abrir chamado"
                          onClick={(e) => { e.stopPropagation(); openTicket(t); }}
                        >
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

      {/* Detalhe do chamado */}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) { setDetail(null); setActionError(null); } }}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>Chamado #{detail.number} · {detail.title}</DialogTitle>
              </DialogHeader>

              <div className="flex flex-wrap gap-2">
                <Badge className={ticketPriorityClass(detail.priority)}>{ticketPriorityLabel(detail.priority)}</Badge>
                <Badge className={ticketStatusClass(detail.status)}>{ticketStatusLabel(detail.status)}</Badge>
                {detail.category && <Badge variant="secondary">{detail.category}</Badge>}
                {detail.assignee_id && (
                  <Badge variant="outline">Resp.: {assigneeNameMap[detail.assignee_id] ?? detail.assignee_id.slice(0, 8)}</Badge>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                Aberto por:{' '}
                <strong>{detail.customer_id ? customerName(detail.customer_id) : 'Equipe interna'}</strong>
                {' '}· {formatDateTime(detail.created_at)}
              </p>
              {detail.description && <p className="text-sm">{detail.description}</p>}

              {/* Mensagens */}
              <div className="space-y-3">
                {detail.messages.map((msg) => {
                  let author = 'Equipe';
                  if (msg.author_customer_id) {
                    author = customerName(msg.author_customer_id);
                  } else if (msg.author_user_id) {
                    author = msg.author_user_id === user?.id
                      ? 'Você'
                      : assigneeNameMap[msg.author_user_id] ?? 'Equipe';
                  }
                  return (
                    <div
                      key={msg.id}
                      className={`rounded-md border p-3 ${msg.is_internal ? 'bg-amber-50' : 'bg-muted/30'}`}
                    >
                      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-medium">
                          {msg.is_internal ? 'Nota interna' : author}
                        </span>
                        <span>{formatDateTime(msg.created_at)}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  );
                })}
              </div>

              {/* Resposta */}
              <form onSubmit={sendMessage} className="space-y-2 border-t pt-3">
                <div className="flex items-center gap-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                    />
                    Nota interna (só a equipe vê)
                  </Label>
                </div>
                <Textarea
                  rows={2}
                  maxLength={4000}
                  placeholder={isInternal ? 'Escreva uma nota interna…' : 'Escreva uma resposta ao cliente…'}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <Button type="submit" disabled={sending || message.trim().length === 0}>
                  {sending ? 'Enviando…' : 'Enviar'}
                </Button>
              </form>

              {/* Gestão */}
              <div className="grid gap-3 border-t pt-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="t-status">Alterar status</Label>
                  <Select value={newStatus || 'none'} onValueChange={(v) => setNewStatus(v === 'none' ? '' : (v as TicketStatus))}>
                    <SelectTrigger id="t-status" className="w-full"><SelectValue placeholder="Novo status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Selecione…</SelectItem>
                      <SelectItem value="under_review">Em Análise</SelectItem>
                      <SelectItem value="awaiting_customer">Aguardando Cliente</SelectItem>
                      <SelectItem value="resolved">Resolvido</SelectItem>
                      <SelectItem value="closed">Fechado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={saveStatus} disabled={!newStatus || savingAction}>
                    Aplicar status
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-assignee">Atribuir responsável</Label>
                  <Select value={newAssignee || 'none'} onValueChange={(v) => setNewAssignee(v === 'none' ? '' : v)}>
                    <SelectTrigger id="t-assignee" className="w-full"><SelectValue placeholder="Responsável" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Selecione…</SelectItem>
                      {assignees.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={saveAssignee} disabled={!newAssignee || savingAction}>
                    <UserCog className="mr-2 h-4 w-4" />Atribuir
                  </Button>
                </div>
              </div>

              {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}