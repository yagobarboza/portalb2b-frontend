import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, MessageCircle, Paperclip, Send } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { toChatMessage, useChatWebSocket } from '../../lib/websocket';
import type {
  ChatMessage, ChatMessagePage, ChatRoom, CustomerPage, UserPage,
} from '@/types/api';
import { getAttachmentUrl } from '../../lib/ticketsApi';
import { formatDateTime } from '../../lib/format'; // ✅ formatDate removido (não usado)
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card'; // ✅ CardContent adicionado
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';

const PAGE_SIZE = 50;

const SECTOR_LABELS: Record<string, string> = {
  sales: 'Vendas',
  commercial: 'Comercial',
  financial: 'Financeiro',
  support: 'Suporte',
  service: 'Serviços',
};

const ROOM_STATUS_LABEL: Record<string, string> = {
  open: 'Aberta',
  closed: 'Encerrada',
};

export default function CompanyChatPage() {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [filterSector, setFilterSector] = useState<'all' | string>('all');
  const [search, setSearch] = useState('');
  const [transferTarget, setTransferTarget] = useState<ChatRoom | null>(null);
  const [transferSector, setTransferSector] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [closeTarget, setCloseTarget] = useState<ChatRoom | null>(null);
  const [closing, setClosing] = useState(false);
  const [customerMap, setCustomerMap] = useState<Record<string, string>>({});
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cust = await api.get<CustomerPage>('/customers', { page: 1, page_size: 100 });
        const cm: Record<string, string> = {};
        for (const c of cust.items) cm[c.id] = c.name;
        if (active) setCustomerMap(cm);
      } catch { /* não derruba */ }
      try {
        const users = await api.get<UserPage>('/users', { page: 1, page_size: 100 });
        const um: Record<string, string> = {};
        for (const u of users.items) um[u.id] = u.full_name;
        if (active) setUserMap(um);
      } catch { /* não derruba */ }
    })();
    return () => { active = false; };
  }, []);

  useChatWebSocket({
    roomId: selected?.id ?? null,
    enabled: !!selected,
    onMessage: (msg) => {
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, toChatMessage(msg)]
      );
      if (selected && msg.sender_type === 'customer') {
        api.post(`/chat/rooms/${selected.id}/read`).catch(() => {});
      }
    },
  });

  const loadRooms = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<ChatRoom[]>('/chat/rooms');
      setRooms(data);
    } catch {
      toast.error('Não foi possível carregar as conversas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  const openRoom = async (room: ChatRoom) => {
    setSelected(room);
    try {
      const data = await api.get<ChatMessagePage>(`/chat/rooms/${room.id}/messages`, {
        page: 1,
        page_size: PAGE_SIZE,
      });
      setMessages(data.items);
      api.post(`/chat/rooms/${room.id}/read`).catch(() => {});
    } catch {
      setMessages([]);
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [messages, selected?.id]);

  const handleSend = async () => {
    const content = message.trim();
    if (!content || !selected || sending) return;
    setSending(true);
    try {
      await api.post<ChatMessage>(`/chat/rooms/${selected.id}/messages`, { content });
      setMessage('');
      await openRoom(selected);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  };

  const handleAttach = async (file: File) => {
    if (!selected || sending) return;
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.upload<ChatMessage>(`/chat/rooms/${selected.id}/attachments`, formData);
      await openRoom(selected);
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

  const confirmClose = async () => {
    if (!closeTarget || closing) return;
    setClosing(true);
    try {
      const updated = await api.post<ChatRoom>(`/chat/rooms/${closeTarget.id}/close`);
      toast.success('Conversa encerrada.');
      setRooms((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setSelected((prev) => (prev && prev.id === updated.id ? updated : prev));
      setCloseTarget(null);
      setMessages([]);
      await openRoom(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao encerrar a conversa.');
    } finally {
      setClosing(false);
    }
  };

  const confirmTransfer = async () => {
    if (!transferTarget || !transferSector || transferring) return;
    setTransferring(true);
    setTransferError(null);
    try {
      const updated = await api.post<ChatRoom>(`/chat/rooms/${transferTarget.id}/transfer`, {
        sector: transferSector,
      });
      toast.success('Conversa transferida de setor.');
      setRooms((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setSelected((prev) => (prev && prev.id === updated.id ? updated : prev));
      setTransferTarget(null);
      setTransferSector('');
    } catch (err) {
      setTransferError(err instanceof ApiError ? err.message : 'Erro ao transferir a conversa.');
    } finally {
      setTransferring(false);
    }
  };

  const customerName = (id?: string | null) => (id ? customerMap[id] ?? id.slice(0, 8) : '—');

  const senderName = (m: ChatMessage) => {
    if (m.sender_type === 'system') return 'Sistema';
    if (m.sender_user_id) return userMap[m.sender_user_id] ?? 'Equipe';
    if (m.sender_customer_id) return customerMap[m.sender_customer_id] ?? 'Cliente';
    return 'Equipe';
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rooms.filter((r) => {
      const matchSector = filterSector === 'all' || r.sector === filterSector;
      const matchSearch =
        !term ||
        customerName(r.customer_id).toLowerCase().includes(term) ||
        (SECTOR_LABELS[r.sector ?? ''] ?? r.sector ?? '').toLowerCase().includes(term);
      return matchSector && matchSearch;
    });
  }, [rooms, filterSector, search, customerMap]);

  const sectorLabel = (s: string | null) => SECTOR_LABELS[s ?? ''] ?? s ?? 'Atendimento';
  const statusLabel = (s: string | null) => ROOM_STATUS_LABEL[s ?? 'open'] ?? s ?? 'open';
  const isClosed = selected?.status === 'closed';

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="px-6 pt-4 pb-2">
        <h1 className="text-2xl font-bold tracking-tight">Chat de Atendimento</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Atenda seus clientes em tempo real ({filtered.length} conversa(s)).
        </p>
      </div>

      <div className="flex min-h-0 flex-1 gap-4 px-4 pb-4">
        <div className="flex w-full flex-col lg:w-[340px] lg:flex-shrink-0">
          <div className="mb-3 space-y-2">
            <Input
              className="h-9"
              placeholder="Buscar conversa por cliente ou setor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={filterSector} onValueChange={(v) => setFilterSector(v === 'all' ? 'all' : v)}>
              <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Setor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os setores</SelectItem>
                {Object.keys(SECTOR_LABELS).map((s) => (
                  <SelectItem key={s} value={s}>{SECTOR_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Carregando…</p>
              ) : filtered.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma conversa.</p>
              ) : (
                <div className="p-2">
                  {filtered.map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50 ${selected?.id === room.id ? 'bg-muted/70' : ''}`}
                      onClick={() => openRoom(room)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{customerName(room.customer_id)}</span>
                        <Badge variant="outline" className="text-[10px]">{sectorLabel(room.sector)}</Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{statusLabel(room.status)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {selected ? (
            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="ghost" className="lg:hidden" onClick={() => setSelected(null)} aria-label="Voltar">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{customerName(selected.customer_id)}</p>
                    <p className="text-xs text-muted-foreground">{sectorLabel(selected.sector)} · {statusLabel(selected.status)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setTransferTarget(selected); setTransferSector(''); setTransferError(null); }}>
                    Transferir setor
                  </Button>
                  {!isClosed && (
                    <Button size="sm" variant="destructive" onClick={() => setCloseTarget(selected)}>
                      Encerrar conversa
                    </Button>
                  )}
                </div>
              </div>

              <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
                <div className="space-y-3 px-4 py-4">
                  {messages.map((m) => {
                    const own = !!m.sender_user_id && !m.sender_customer_id;
                    return (
                      <div key={m.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-lg border px-3 py-2 ${own ? 'bg-primary/10' : 'bg-muted/30'}`}>
                          <p className="mb-0.5 text-xs font-medium text-muted-foreground">{senderName(m)}</p>
                          <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                          {m.attachment_file_id && (
                            <a
                              href={getAttachmentUrl(m.attachment_file_id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                            >
                              <Paperclip className="h-3 w-3" /> Baixar anexo
                            </a>
                          )}
                          <p className="mt-1 text-right text-[10px] text-muted-foreground">{formatDateTime(m.created_at)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {!isClosed ? (
                <div className="flex gap-2 border-t p-3">
                  <input
                    ref={attachRef}
                    type="file"
                    className="hidden"
                    onChange={pickFile}
                    accept="image/jpeg,image/png,application/pdf"
                  />
                  <Button type="button" variant="outline" size="icon" aria-label="Anexar" disabled={sending} onClick={() => attachRef.current?.click()}>
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    placeholder="Digite sua mensagem…"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    className="flex-1"
                    maxLength={4000}
                  />
                  <Button onClick={handleSend} disabled={!message.trim() || sending} size="icon" aria-label="Enviar">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p className="border-t p-3 text-center text-sm text-muted-foreground">📌 Conversa encerrada.</p>
              )}
            </Card>
          ) : (
            <Card className="flex w-full items-center justify-center">
              <CardContent className="p-12 text-center">
                <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <h3 className="text-lg font-semibold text-muted-foreground">Selecione uma conversa</h3>
                <p className="mt-1 text-sm text-muted-foreground/70">
                  Escolha uma conversa na lista para começar o atendimento.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Modal de transferência */}
      <Dialog open={!!transferTarget} onOpenChange={(o) => { if (!o) setTransferTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Transferir conversa de setor</DialogTitle></DialogHeader>
          {transferTarget && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Cliente: <strong>{customerName(transferTarget.customer_id)}</strong>
              </p>
              <div className="space-y-2">
                <Label htmlFor="transfer-sector">Novo setor</Label>
                <Select value={transferSector} onValueChange={(v) => { setTransferSector(v); setTransferError(null); }}>
                  <SelectTrigger id="transfer-sector" className="w-full"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(SECTOR_LABELS).map((s) => (
                      <SelectItem key={s} value={s}>{SECTOR_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {transferError && <p role="alert" className="text-sm text-destructive">{transferError}</p>}
              <DialogFooter>
                <Button onClick={confirmTransfer} disabled={!transferSector || transferring}>
                  {transferring ? 'Transferindo…' : 'Transferir'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal encerrar conversa */}
      <Dialog open={!!closeTarget} onOpenChange={(o) => { if (!o) setCloseTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Encerrar conversa?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            A conversa com <strong>{closeTarget ? customerName(closeTarget.customer_id) : ''}</strong> será
            encerrada e o cliente não poderá mais enviar mensagens. Deseja continuar?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmClose} disabled={closing}>
              {closing ? 'Encerrando…' : 'Encerrar conversa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}