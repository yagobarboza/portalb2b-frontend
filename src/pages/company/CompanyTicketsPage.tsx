import { useCallback, useEffect, useMemo, useRef, useState } from 'react'; // ✅ useRef adicionado
import { toast } from 'sonner';
import { Paperclip, Search, Send, TicketIcon, UserCog } from 'lucide-react'; // ✅ ArrowLeft removido
import { useAuth } from '../../context/AuthContext';
import { api, ApiError } from '../../lib/api';
import {
  assignTicket, getTicket, listTickets,
  sendTicketMessage, updateTicketStatus, uploadTicketAttachment,
} from '../../lib/ticketsApi';
import { ChatAttachment } from '../../components/chat/ChatAttachment'; // ✅ substitui getAttachmentUrl
import {
  ticketPriorityClass, ticketPriorityLabel, ticketStatusClass, ticketStatusLabel,
} from '../../lib/ticketStatus';
import { formatDateTime } from '../../lib/format';
import type {
  CustomerPage, Ticket, TicketDetail, TicketPriority, TicketStatus, UserPage,
} from '@/types/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';

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
  const [customerMap, setCustomerMap] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [message, setMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [newStatus, setNewStatus] = useState<TicketStatus | ''>('');
  const [newAssignee, setNewAssignee] = useState<string>('');
  const [savingAction, setSavingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const attachRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const users = await api.get<UserPage>('/users', { page: 1, page_size: 100 });
        if (active) setAssignees(users.items);
      } catch { /* não derruba */ }
      try {
        const cust = await api.get<CustomerPage>('/customers', { page: 1, page_size: 100 });
        const cm: Record<string, string> = {};
        for (const c of cust.items) cm[c.id] = c.name;
        if (active) setCustomerMap(cm);
      } catch { /* não derruba */ }
    })();
    return () => { active = false; };
  }, []);

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
      setMessage('');
    } catch {
      toast.error('Erro ao abrir o chamado.');
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || !message.trim() || sending) return;
    setSending(true);
    try {
      await sendTicketMessage(detail.id, message.trim(), isInternal);
      setMessage('');
      setDetail(await getTicket(detail.id));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  };

  const handleAttach = async (file: File) => {
    if (!detail || sending) return;
    setSending(true);
    try {
      await uploadTicketAttachment(detail.id, file);
      setDetail(await getTicket(detail.id));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao enviar anexo.');
    } finally {
      setSending(false);
    }
  };

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (file) handleAttach(file);
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
      {/* Cabeçalho com total */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tickets</h1>
        <p className="text-sm text-muted-foreground">
          Atendimento aos clientes — {total} chamado(s) no total.
        </p>
      </div>

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
              <SelectItem value="all">Todos</SelectItem>
              {(['open', 'under_review', 'awaiting_customer', 'awaiting_company', 'resolved', 'closed'] as TicketStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{ticketStatusLabel(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-48">
          <Select value={filterPriority} onValueChange={(v) => { setFilterPriority(v as 'all' | TicketPriority); setPage(1); }}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {(['low', 'medium', 'high', 'urgent'] as TicketPriority[]).map((p) => (
                <SelectItem key={p} value={p}>{ticketPriorityLabel(p)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="py-10 text-center text-muted-foreground">Carregando…</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <TicketIcon className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <h3 className="text-lg font-semibold text-muted-foreground">Nenhum chamado encontrado</h3>
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left transition-colors hover:bg-muted/30"
                    onClick={() => openTicket(t)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">#{t.number}</span>
                          <span className="truncate font-medium">{t.title}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {customerName(t.customer_id)} · {formatDateTime(t.updated_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={ticketStatusClass(t.status)}>{ticketStatusLabel(t.status)}</Badge>
                        <Badge className={ticketPriorityClass(t.priority)}>{ticketPriorityLabel(t.priority)}</Badge>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
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

      {/* Detalhe — visual e-mail */}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) { setDetail(null); setActionError(null); } }}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">
                  #{detail.number} · {customerName(detail.customer_id)} — {detail.title}
                </DialogTitle>
              </DialogHeader>

              <div className="flex flex-wrap gap-2 text-xs">
                <Badge className={ticketStatusClass(detail.status)}>{ticketStatusLabel(detail.status)}</Badge>
                <Badge className={ticketPriorityClass(detail.priority)}>{ticketPriorityLabel(detail.priority)}</Badge>
                {detail.category && <Badge variant="secondary">{detail.category}</Badge>}
                {detail.assignee_id && (
                  <Badge variant="outline">Resp.: {assigneeNameMap[detail.assignee_id] ?? detail.assignee_id.slice(0, 8)}</Badge>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Aberto por <strong>{customerName(detail.customer_id)}</strong> · {formatDateTime(detail.created_at)}
              </p>

              {detail.description && (
                <p className="rounded-md border bg-muted/20 p-3 text-sm whitespace-pre-wrap">{detail.description}</p>
              )}

              {/* Thread */}
              <div className="space-y-3">
                {detail.messages.map((msg) => {
                  let author = 'Equipe';
                  if (msg.author_customer_id) author = customerName(msg.author_customer_id);
                  else if (msg.author_user_id) author = msg.author_user_id === user?.id ? 'Você' : assigneeNameMap[msg.author_user_id] ?? 'Equipe';
                  return (
                    <div key={msg.id} className={`rounded-md border p-3 ${msg.is_internal ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-muted/30'}`}>
                      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-medium">{msg.is_internal ? '🔒 Nota interna' : author}</span>
                        <span>{formatDateTime(msg.created_at)}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      {/* ✅ Anexo: imagem/vídeo inline; demais → download direto */}
                      {msg.attachment_file_id && <ChatAttachment fileId={msg.attachment_file_id} />}
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
                  placeholder={isInternal ? 'Escreva uma nota interna…' : 'Escreva uma resposta…'}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <input
                    ref={attachRef}
                    type="file"
                    className="hidden"
                    onChange={pickFile}
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                  />
                  <Button type="button" variant="outline" size="icon" aria-label="Anexar" disabled={sending} onClick={() => attachRef.current?.click()}>
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button type="submit" disabled={sending || message.trim().length === 0} className="ml-auto">
                    <Send className="mr-2 h-4 w-4" />{sending ? 'Enviando…' : 'Responder'}
                  </Button>
                </div>
              </form>

              {/* Gestão */}
              <div className="grid gap-3 border-t pt-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="t-status">Alterar status</Label>
                  <Select value={newStatus || 'none'} onValueChange={(v) => setNewStatus(v === 'none' ? '' : (v as TicketStatus))}>
                    <SelectTrigger id="t-status" className="w-full"><SelectValue placeholder="Novo status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Selecione…</SelectItem>
                      {(['under_review', 'awaiting_customer', 'resolved', 'closed'] as TicketStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>{ticketStatusLabel(s)}</SelectItem>
                      ))}
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