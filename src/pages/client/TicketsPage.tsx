import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MessageCircle, Plus, TicketIcon } from 'lucide-react';
import {
  createTicket, getTicket, listTickets, sendTicketMessage,
} from '../../lib/ticketsApi';
import {
  ticketPriorityClass, ticketPriorityLabel, ticketStatusClass, ticketStatusLabel,
} from '../../lib/ticketStatus';
import { formatDate, formatDateTime } from '../../lib/format';
import type { Ticket, TicketDetail, TicketPriority } from '@/types/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';

const PAGE_SIZE = 20;

export default function ClientTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<TicketDetail | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);

  // Novo chamado
  const [form, setForm] = useState({ title: '', description: '', category: '', priority: 'medium' as TicketPriority });
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
  setLoading(true);
  try {
    const data = await listTickets({ page, page_size: PAGE_SIZE });
    setTickets(data.items);
    setPages(Math.ceil(data.total / data.page_size) || 1);
  } catch {
    toast.error('Não foi possível carregar seus chamados.');
  } finally {
    setLoading(false);
  }
}, [page]);

  useEffect(() => { load(); }, [load]);

  const openTicket = async (t: Ticket) => {
    try {
      const detail = await getTicket(t.id);
      setSelected(detail);
    } catch {
      // Anti-vazamento: acesso negado retorna 404 genérico no backend.
      toast.error('Não foi possível abrir o chamado.');
    }
  };

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (form.title.trim().length < 3) {
      setFormError('Informe um título (mín. 3 caracteres).');
      return;
    }
    setSending(true);
    try {
      await createTicket({
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        priority: form.priority,
      });
      toast.success('Chamado aberto com sucesso!');
      setShowNew(false);
      setForm({ title: '', description: '', category: '', priority: 'medium' });
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao abrir chamado.');
    } finally {
      setSending(false);
    }
  };

  const submitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || sending) return;
    if (newMsg.trim().length === 0) return;
    setSending(true);
    try {
      // Cliente: SEMPRE mensagem pública. O parâmetro is_internal nem existe
      // neste fluxo — o backend responde 403 se um cliente tentar nota interna.
      await sendTicketMessage(selected.id, newMsg.trim());
      setNewMsg('');
      setSelected(await getTicket(selected.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Meus Chamados</h1>
          <p className="mt-1 text-muted-foreground">Acompanhe e abra chamados de suporte.</p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="mr-2 h-4 w-4" />Abrir chamado
        </Button>
      </div>

      {loading ? (
        <p className="py-16 text-center text-muted-foreground">Carregando…</p>
      ) : tickets.length === 0 ? (
        <div className="py-16 text-center">
          <TicketIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <h3 className="text-lg font-semibold text-muted-foreground">Nenhum chamado encontrado</h3>
          <p className="mt-1 text-sm text-muted-foreground/70">Seus chamados aparecerão aqui.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {tickets.map((t) => (
              <Card key={t.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => openTicket(t)}>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">#{t.number} · {t.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(t.created_at)}</p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <Badge className={ticketPriorityClass(t.priority)}>{ticketPriorityLabel(t.priority)}</Badge>
                    <Badge className={ticketStatusClass(t.status)}>{ticketStatusLabel(t.status)}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {pages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Página {page} de {pages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Novo chamado */}
      <Dialog open={showNew} onOpenChange={(o) => { setShowNew(o); if (!o) setFormError(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Abrir chamado</DialogTitle></DialogHeader>
          <form onSubmit={submitNew} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="t-title">Título *</Label>
              <Input id="t-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="t-category">Categoria</Label>
                <Input id="t-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ex.: Faturamento" />
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as TicketPriority })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-description">Descrição</Label>
              <Textarea id="t-description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
            <DialogFooter>
              <Button type="submit" disabled={sending}>{sending ? 'Abrindo…' : 'Abrir chamado'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detalhe */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>Chamado #{selected.number} · {selected.title}</DialogTitle>
              </DialogHeader>

              <div className="flex flex-wrap gap-2">
                <Badge className={ticketPriorityClass(selected.priority)}>{ticketPriorityLabel(selected.priority)}</Badge>
                <Badge className={ticketStatusClass(selected.status)}>{ticketStatusLabel(selected.status)}</Badge>
                {selected.category && <Badge variant="secondary">{selected.category}</Badge>}
              </div>

              {selected.description && (
                <p className="mt-3 text-sm text-muted-foreground">{selected.description}</p>
              )}

              {/* Thread — o backend JÁ filtra is_internal para o cliente */}
              <div className="mt-4 max-h-80 space-y-2 overflow-auto rounded-md border p-3">
                {selected.messages.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
                )}
                {selected.messages.map((msg) => (
                  <div key={msg.id} className="rounded-md bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">
                      {msg.author_customer_id ? 'Você' : 'Equipe de suporte'}
                      {' · '}
                      {formatDateTime(msg.created_at)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{msg.content}</p>
                  </div>
                ))}
              </div>

              {/* Responder — o cliente só envia mensagens públicas.
                  O parâmetro is_internal nem existe neste fluxo (backend 403 se tentado). */}
              <form onSubmit={submitMessage} className="mt-4 flex gap-2">
                <Textarea
                  className="min-h-[40px] flex-1"
                  rows={1}
                  placeholder="Escreva uma mensagem…"
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  maxLength={4000}
                />
                <Button type="submit" disabled={sending || newMsg.trim().length === 0}>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  {sending ? 'Enviando…' : 'Enviar'}
                </Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}