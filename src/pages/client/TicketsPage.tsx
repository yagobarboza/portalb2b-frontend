import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft, Paperclip, Plus, Send, Ticket as TicketIcon,
} from 'lucide-react';
import {
  createTicket, getTicket, listTickets, sendTicketMessage, uploadTicketAttachment,
} from '../../lib/ticketsApi';
import { ChatAttachment } from '../../components/chat/ChatAttachment'; // ✅ substitui getAttachmentUrl
import { ticketPriorityLabel, ticketStatusLabel } from '../../lib/ticketStatus';
import { formatDateTime, formatDate } from '../../lib/format';
import type {
  Ticket, TicketDetail, TicketPriority, TicketStatus,
} from '@/types/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
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

  // ── Detalhe (cara de e-mail/thread) ──
  if (selected) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelected(null)} aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold">{selected.title}</h1>
            <p className="text-xs text-muted-foreground">
              #{selected.number} · {formatDateTime(selected.created_at)}
            </p>
          </div>
          <Badge>{ticketStatusLabel(selected.status)}</Badge>
        </div>

        <Card className="overflow-hidden">
          <div className="border-b bg-muted/30 px-4 py-3 text-sm">
            <p>
              <span className="text-muted-foreground">Status: </span>
              <strong>{ticketStatusLabel(selected.status)}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Prioridade: </span>
              <strong>{ticketPriorityLabel(selected.priority)}</strong>
            </p>
            {selected.category && (
              <p>
                <span className="text-muted-foreground">Categoria: </span>
                <strong>{selected.category}</strong>
              </p>
            )}
          </div>

          <div className="space-y-4 px-4 py-4">
            {selected.messages.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma mensagem ainda.
              </p>
            )}
            {selected.messages.map((m) => {
              const mine = !m.author_user_id;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg border px-3 py-2 ${mine ? 'bg-primary/10' : 'bg-muted/30'}`}>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      {mine ? 'Você' : 'Suporte'} · {formatDateTime(m.created_at)}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                    {/* ✅ Anexo: imagem/vídeo inline; demais → download direto */}
                    {m.attachment_file_id && <ChatAttachment fileId={m.attachment_file_id} />}
                  </div>
                </div>
              );
            })}
          </div>

          {closed ? (
            <p className="border-t bg-muted/20 px-4 py-4 text-center text-sm text-muted-foreground">
              📌 Este ticket foi encerrado. Não é possível enviar novas mensagens.
            </p>
          ) : (
            <form onSubmit={handleSend} className="space-y-2 border-t p-4">
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
        </Card>
      </div>
    );
  }

  // ── Lista ──
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tickets de Suporte</h1>
          <p className="mt-1 text-muted-foreground">
            Acompanhe e abra solicitações de suporte ({total} no total).
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="mr-2 h-4 w-4" />Novo ticket
        </Button>
      </div>

      {loading ? (
        <p className="py-16 text-center text-muted-foreground">Carregando…</p>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <TicketIcon className="mb-4 h-16 w-16 text-muted-foreground/30" />
          <h3 className="text-lg font-semibold text-muted-foreground">Nenhum ticket</h3>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Crie um ticket para obter suporte.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Card key={t.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => openTicket(t)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">#{t.number}</span>
                      <h3 className="truncate font-semibold">{t.title}</h3>
                    </div>
                    <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{t.description}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge>{ticketStatusLabel(t.status)}</Badge>
                      <Badge variant="outline">{ticketPriorityLabel(t.priority)}</Badge>
                      <span className="ml-auto text-xs text-muted-foreground">{formatDate(t.updated_at)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Página {page} de {pages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
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