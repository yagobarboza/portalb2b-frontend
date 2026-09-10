import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Inbox, Paperclip, Search, Send, TicketIcon, UserCog } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api, ApiError } from '../../lib/api';
import {
  assignTicket, getTicket, listTickets,
  sendTicketMessage, updateTicketStatus, uploadTicketAttachment,
} from '../../lib/ticketsApi';
import { ChatAttachment } from '../../components/chat/ChatAttachment';
import {
  ticketPriorityLabel, ticketStatusLabel,
} from '../../lib/ticketStatus';
import { formatDateTime } from '../../lib/format';
import { cn } from '../../lib/utils';
import type {
  CustomerPage, Ticket, TicketDetail, TicketPriority, TicketStatus, UserPage,
} from '@/types/api';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';

const PAGE_SIZE = 20;
/** Ticket com o nome do responsável (agora enviado pelo backend). */
type TicketDetailWithName = TicketDetail & { assignee_name?: string | null };
type TicketWithName = Ticket & { assignee_name?: string | null };

// ── Paleta de status e prioridade: legível em Light e Dark ───────────────────
const STATUS_CHIP: Record<TicketStatus, string> = {
  open: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100',
  under_review: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100',
  awaiting_company: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-100',
  awaiting_customer: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
  resolved: 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100',
  closed: 'bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100',
};
const PRIORITY_CHIP: Record<TicketPriority, string> = {
  low: 'bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100',
  medium: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100',
  high: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-100',
  urgent: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100',
};

function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${className ?? ''}`}>
      {children}
    </span>
  );
}

export default function CompanyTicketsPage() {
  const { user } = useAuth();
  // ✅ Inicial REAL do usuário da empresa logado (fallback seguro).
  const myInitial = (user?.full_name?.trim() || 'E').charAt(0).toUpperCase();

  const [tickets, setTickets] = useState<TicketWithName[]>([]);
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
  const [detail, setDetail] = useState<TicketDetailWithName | null>(null);
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

  const assigneeLabel = (t: { assignee_id?: string | null; assignee_name?: string | null }) => {
    if (!t.assignee_id) return '—';
    return t.assignee_name ?? assigneeNameMap[t.assignee_id] ?? '—';
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listTickets({
        page,
        page_size: PAGE_SIZE,
        ...(filterStatus !== 'all' ? { status: filterStatus } : {}),
        ...(filterPriority !== 'all' ? { priority: filterPriority } : {}),
      });
      setTickets(data.items as TicketWithName[]);
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
      const full = (await getTicket(t.id)) as TicketDetailWithName;
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
      setDetail((await getTicket(detail.id)) as TicketDetailWithName);
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
      setDetail((await getTicket(detail.id)) as TicketDetailWithName);
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
      setDetail((await getTicket(detail.id)) as TicketDetailWithName);
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
      setDetail((await getTicket(detail.id)) as TicketDetailWithName);
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
  const needsAttention = (t: Ticket) => t.status !== 'resolved' && t.status !== 'closed';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tickets</h1>
        <p className="text-sm text-muted-foreground">
          Atendimento aos clientes — {total} chamado(s) no total.
        </p>
      </div>

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

      <div className="grid items-start gap-4 lg:grid-cols-[340px_1fr]">
        {/* ── Lista (caixa de entrada) ── */}
        <Card
          className={cn(
            'flex max-h-[45vh] flex-col overflow-hidden lg:sticky lg:top-20 lg:max-h-[calc(100vh-8rem)]',
            detail ? 'hidden lg:flex' : 'flex',
          )}
        >
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Inbox className="h-4 w-4" />Caixa de entrada
            </p>
            <span className="text-xs text-muted-foreground">{filtered.length} chamado(s)</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="py-10 text-center text-muted-foreground">Carregando…</p>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <TicketIcon className="mb-2 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Nenhum chamado encontrado.</p>
              </div>
            ) : (
              <ul className="divide-y">
                {filtered.map((t) => {
                  const attention = needsAttention(t);
                  const active = detail?.id === t.id;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => openTicket(t)}
                        className={cn(
                          'w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/30',
                          active && 'bg-muted/40',
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                            {customerName(t.customer_id).charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className={cn('truncate text-sm', attention ? 'font-semibold' : 'text-muted-foreground')}>
                                {customerName(t.customer_id)}
                              </p>
                              <span className="shrink-0 text-[11px] text-muted-foreground">{formatDateTime(t.updated_at)}</span>
                            </div>
                            <p className={cn('truncate text-sm leading-tight', attention && 'font-semibold')}>{t.title}</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1">
                              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{t.description}</span>
                              <Chip className={STATUS_CHIP[t.status]}>{ticketStatusLabel(t.status)}</Chip>
                              <Chip className={PRIORITY_CHIP[t.priority]}>{ticketPriorityLabel(t.priority)}</Chip>
                            </div>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between border-t px-3 py-1.5">
              <p className="text-xs text-muted-foreground">Página {page} de {pages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
              </div>
            </div>
          )}
        </Card>

        {/* ── Leitura (e-mail) ── */}
        <Card className={cn('flex flex-col', detail ? 'flex' : 'hidden lg:flex')}>
          {detail ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="-ml-2 h-8 w-8 lg:hidden"
                      onClick={() => setDetail(null)}
                      aria-label="Voltar"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h2 className="truncate text-base font-bold">#{detail.number} · {detail.title}</h2>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Aberto em {formatDateTime(detail.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip className={STATUS_CHIP[detail.status]}>{ticketStatusLabel(detail.status)}</Chip>
                  <Chip className={PRIORITY_CHIP[detail.priority]}>{ticketPriorityLabel(detail.priority)}</Chip>
                  {detail.category && (
                    <Chip className="border border-border text-muted-foreground">{detail.category}</Chip>
                  )}
                  {detail.assignee_id && (
                    <Chip className="border border-border text-muted-foreground">
                      Resp.: {assigneeLabel(detail)}
                    </Chip>
                  )}
                </div>
              </div>

              <div className="border-b bg-muted/20 px-4 py-1.5 text-[11px] text-muted-foreground">
                <span><span className="font-medium">De:</span> <strong>{customerName(detail.customer_id)}</strong></span>
                <span className="mx-2 text-muted-foreground/40">|</span>
                <span><span className="font-medium">Para:</span> <strong>Equipe de atendimento</strong></span>
              </div>

              {detail.description && (
                <div className="border-b px-4 py-2.5">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {detail.description}
                  </p>
                </div>
              )}

              {/* ── Thread: mensagens diferenciadas por autor (chat) ── */}
              <div className="flex-1 space-y-3 p-3">
                {detail.messages.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
                ) : (
                  detail.messages.map((msg) => {
                    const isInternal = msg.is_internal;
                    const isMine = Boolean(msg.author_user_id && msg.author_user_id === user?.id);
                    const isCustomer = Boolean(msg.author_customer_id);
                    const alignRight = !isCustomer && !isInternal;
                    const author =
                      isInternal ? '🔒 Nota interna' :
                      isMine ? 'Você' :
                      isCustomer ? customerName(msg.author_customer_id) :
                      msg.author_user_id ? (assigneeNameMap[msg.author_user_id] ?? 'Equipe') : 'Equipe';
                    const avatarLetter =
                      isInternal ? '🔒' :
                      isCustomer ? customerName(msg.author_customer_id).charAt(0).toUpperCase() :
                      myInitial; // ✅ inicial REAL do usuário da empresa
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          'flex items-end gap-2',
                          alignRight && 'flex-row-reverse',
                        )}
                      >
                        <div
                          className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                            isInternal
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                              : alignRight
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground ring-1 ring-border',
                          )}
                        >
                          {avatarLetter}
                        </div>

                        <div
                          className={cn(
                            'max-w-[80%] rounded-2xl border px-3.5 py-2',
                            isInternal
                              ? 'rounded-bl-sm border-amber-300/60 bg-amber-50 dark:bg-amber-950/30'
                              : alignRight
                                ? 'rounded-br-sm border-primary/25 bg-primary text-primary-foreground'
                                : 'rounded-bl-sm border-border bg-muted/40',
                          )}
                        >
                          <div
                            className={cn(
                              'mb-0.5 flex items-baseline justify-between gap-2 text-[11px]',
                              isInternal
                                ? 'text-amber-700 dark:text-amber-300'
                                : alignRight ? 'text-primary-foreground/80' : 'text-muted-foreground',
                            )}
                          >
                            <span className="font-bold uppercase tracking-wide">{author}</span>
                            <span className="shrink-0">{formatDateTime(msg.created_at)}</span>
                          </div>
                          <p
                            className={cn(
                              'whitespace-pre-wrap text-sm leading-relaxed',
                              isInternal
                                ? 'text-amber-900 dark:text-amber-100'
                                : alignRight ? 'text-primary-foreground' : '',
                            )}
                          >
                            {msg.content}
                          </p>
                          {msg.attachment_file_id && <ChatAttachment fileId={msg.attachment_file_id} />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form onSubmit={sendMessage} className="space-y-1.5 border-t p-3">
                <Label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                  />
                  Nota interna (só a equipe vê)
                </Label>
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

              <div className="grid gap-3 border-t p-3 sm:grid-cols-2">
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
              {actionError && <p role="alert" className="px-4 pb-3 text-sm text-destructive">{actionError}</p>}
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
              <Inbox className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">Selecione um chamado para ler</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}