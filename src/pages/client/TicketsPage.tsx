import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft, Inbox, Paperclip, Plus, Send, Ticket as TicketIcon,
} from 'lucide-react';
import {
  createTicket, getTicket, listTickets, sendTicketMessage, uploadTicketAttachment,
} from '../../lib/ticketsApi';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../lib/useBranding';
import { ChatAttachment } from '../../components/chat/ChatAttachment';
import { ticketPriorityLabel, ticketStatusLabel } from '../../lib/ticketStatus';
import { formatDateTime, formatDate } from '../../lib/format';
import { cn } from '../../lib/utils';
import type {
  Ticket, TicketDetail, TicketPriority, TicketStatus,
} from '@/types/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';

const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];
const CATEGORIES = ['Suporte técnico', 'Comercial', 'Financeiro', 'Cadastro', 'Outro'];
/** Ticket fechado/resolvido → cliente não pode mais enviar mensagens/anexos. */
const isClosedForClient = (status: TicketStatus) =>
  status === 'resolved' || status === 'closed';

export default function ClientTicketsPage() {
  const { user } = useAuth();
  const { branding } = useBranding();
  // ✅ Inicial REAL do cliente logado e da empresa (com fallback seguro).
  const myInitial = (user?.full_name?.trim() || 'V').charAt(0).toUpperCase();
  const supportInitial = (branding?.name?.trim() || 'S').charAt(0).toUpperCase();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TicketDetail | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const attachRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [form, setForm] = useState<{
    title: string; description: string; category: string; priority: TicketPriority;
  }>({ title: '', description: '', category: CATEGORIES[0], priority: 'medium' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listTickets({ page, page_size: 20 });
      setTickets(data.items);
      setTotal(data.total);
      setPages(Math.max(1, Math.ceil(data.total / 20)));
    } catch {
      toast.error('Não foi possível carregar seus tickets.');
    } finally {
      setLoading(false);
    }
  }, [page]);
  useEffect(() => { load(); }, [load]);

  const openTicket = async (t: Ticket) => {
    try {
      setSelected(await getTicket(t.id));
      setNewMsg('');
      setPendingFile(null);
    } catch {
      toast.error('Erro ao abrir o ticket.');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Preencha título e descrição.');
      return;
    }
    try {
      const created = await createTicket({
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category || null,
        priority: form.priority,
      });
      toast.success('Ticket criado com sucesso!');
      setShowNew(false);
      setForm({ title: '', description: '', category: CATEGORIES[0], priority: 'medium' });
      setPage(1);
      load();
      openTicket(created);
    } catch {
      toast.error('Erro ao criar o ticket.');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !newMsg.trim() || sending) return;
    if (isClosedForClient(selected.status)) {
      toast.error('Este ticket foi encerrado.');
      return;
    }
    setSending(true);
    try {
      await sendTicketMessage(selected.id, newMsg.trim());
      setNewMsg('');
      setSelected(await getTicket(selected.id));
    } catch {
      toast.error('Erro ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  };

  const handleAttach = async (file: File) => {
    if (!selected || sending) return;
    if (isClosedForClient(selected.status)) {
      toast.error('Este ticket foi encerrado.');
      return;
    }
    setSending(true);
    try {
      await uploadTicketAttachment(selected.id, file);
      setPendingFile(null);
      setSelected(await getTicket(selected.id));
    } catch {
      toast.error('Erro ao enviar anexo.');
    } finally {
      setSending(false);
    }
  };

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (file) handleAttach(file);
  };

  const closed = selected ? isClosedForClient(selected.status) : false;
  const needsAttention = (t: Ticket) => t.status === 'open' || t.status === 'awaiting_company';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tickets de Suporte</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe e abra solicitações de suporte ({total} no total).
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="mr-2 h-4 w-4" />Novo ticket
        </Button>
      </div>

      {loading ? (
        <p className="py-16 text-center text-muted-foreground">Carregando…</p>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[340px_1fr]">
          {/* ── Lista (caixa de entrada) ── */}
          <Card
            className={cn(
              'flex max-h-[45vh] flex-col overflow-hidden lg:sticky lg:top-20 lg:max-h-[calc(100vh-8rem)]',
              selected ? 'hidden lg:flex' : 'flex',
            )}
          >
            <div className="flex items-center justify-between border-b px-3 py-2">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Inbox className="h-4 w-4" />Caixa de entrada
              </p>
              <span className="text-xs text-muted-foreground">{total} ticket(s)</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {tickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <TicketIcon className="mb-2 h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Nenhum ticket criado.</p>
                </div>
              ) : (
                <ul className="divide-y">
                  {tickets.map((t) => {
                    const attention = needsAttention(t);
                    const active = selected?.id === t.id;
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
                              {supportInitial}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-2">
                                <p className={cn('truncate text-sm', attention ? 'font-semibold' : 'text-muted-foreground')}>
                                  Suporte
                                </p>
                                <span className="shrink-0 text-[11px] text-muted-foreground">{formatDate(t.updated_at)}</span>
                              </div>
                              <p className={cn('truncate text-sm leading-tight', attention && 'font-semibold')}>{t.title}</p>
                              <div className="mt-0.5 flex items-center gap-1.5">
                                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{t.description}</span>
                                <Badge variant={attention ? 'default' : 'outline'} className="shrink-0">
                                  {ticketStatusLabel(t.status)}
                                </Badge>
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
          <Card className={cn('flex flex-col', selected ? 'flex' : 'hidden lg:flex')}>
            {selected ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="-ml-2 h-8 w-8 lg:hidden"
                        onClick={() => setSelected(null)}
                        aria-label="Voltar"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <h2 className="truncate text-base font-bold">{selected.title}</h2>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      #{selected.number} · {formatDateTime(selected.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline">{ticketPriorityLabel(selected.priority)}</Badge>
                    {selected.category && <Badge variant="outline">{selected.category}</Badge>}
                    <Badge>{ticketStatusLabel(selected.status)}</Badge>
                  </div>
                </div>

                <div className="border-b bg-muted/20 px-4 py-1.5 text-[11px] text-muted-foreground">
                  <span><span className="font-medium">De:</span> <strong>Suporte</strong></span>
                  <span className="mx-2 text-muted-foreground/40">|</span>
                  <span><span className="font-medium">Para:</span> <strong>Você</strong></span>
                </div>

                {selected.description && (
                  <div className="border-b px-4 py-2.5">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {selected.description}
                    </p>
                  </div>
                )}

                {/* ── Thread: mensagens diferenciadas por autor (chat) ── */}
                <div className="flex-1 space-y-3 p-3">
                  {selected.messages.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
                  ) : (
                    selected.messages.map((m) => {
                      const mine = !m.author_user_id;
                      return (
                        <div
                          key={m.id}
                          className={cn(
                            'flex items-end gap-2',
                            mine ? 'flex-row-reverse' : '',
                          )}
                        >
                          {/* Avatar com inicial REAL (quem enviou) */}
                          <div
                            className={cn(
                              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                              mine
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground ring-1 ring-border',
                            )}
                          >
                            {mine ? myInitial : supportInitial}
                          </div>

                          {/* Balão */}
                          <div
                            className={cn(
                              'max-w-[80%] rounded-2xl border px-3.5 py-2',
                              mine
                                ? 'rounded-br-sm border-primary/25 bg-primary text-primary-foreground'
                                : 'rounded-bl-sm border-border bg-muted/40',
                            )}
                          >
                            <div
                              className={cn(
                                'mb-0.5 flex items-baseline justify-between gap-2 text-[11px]',
                                mine ? 'text-primary-foreground/80' : 'text-muted-foreground',
                              )}
                            >
                              <span className="font-bold uppercase tracking-wide">
                                {mine ? 'Você' : 'Suporte'}
                              </span>
                              <span className="shrink-0">{formatDateTime(m.created_at)}</span>
                            </div>
                            <p
                              className={cn(
                                'whitespace-pre-wrap text-sm leading-relaxed',
                                mine ? 'text-primary-foreground' : '',
                              )}
                            >
                              {m.content}
                            </p>
                            {m.attachment_file_id && <ChatAttachment fileId={m.attachment_file_id} />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {closed ? (
                  <p className="border-t bg-muted/20 px-4 py-3 text-center text-sm text-muted-foreground">
                    📌 Este ticket foi encerrado. Não é possível enviar novas mensagens.
                  </p>
                ) : (
                  <form onSubmit={handleSend} className="space-y-1.5 border-t p-3">
                    {pendingFile && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Paperclip className="h-3 w-3" /> {pendingFile.name}
                      </p>
                    )}
                    <Textarea
                      rows={2}
                      maxLength={4000}
                      placeholder="Escreva sua resposta…"
                      value={newMsg}
                      onChange={(e) => setNewMsg(e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        ref={attachRef}
                        type="file"
                        className="hidden"
                        onChange={pickFile}
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                      />
                      <Button type="button" variant="outline" size="icon" aria-label="Anexar arquivo" disabled={sending} onClick={() => attachRef.current?.click()}>
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <Button type="submit" disabled={!newMsg.trim() || sending} className="ml-auto">
                        <Send className="mr-2 h-4 w-4" />{sending ? 'Enviando…' : 'Responder'}
                      </Button>
                    </div>
                  </form>
                )}
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
                <Inbox className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">Selecione um ticket para ler</p>
              </div>
            )}
          </Card>
        </div>
      )}

      <Dialog open={showNew} onOpenChange={(o) => { setShowNew(o); if (!o) setForm({ title: '', description: '', category: CATEGORIES[0], priority: 'medium' }); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo ticket</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="t-title">Título *</Label>
              <Input id="t-title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Descreva o assunto em uma frase" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="t-cat">Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                  <SelectTrigger id="t-cat" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-prio">Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((p) => ({ ...p, priority: v as TicketPriority }))}>
                  <SelectTrigger id="t-prio" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((pr) => <SelectItem key={pr} value={pr}>{ticketPriorityLabel(pr)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-desc">Descrição *</Label>
              <Textarea id="t-desc" rows={4} maxLength={10000} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Detalhe o que está acontecendo…" required />
            </div>
            <DialogFooter>
              <Button type="submit">Criar ticket</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}