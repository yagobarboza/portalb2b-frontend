import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, MessageCircle, Send } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { toChatMessage, useChatWebSocket } from '../../lib/websocket';
import type { ChatMessage, ChatMessagePage, ChatRoom } from '@/types/api';
import { formatDate, formatDateTime } from '../../lib/format';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { ScrollArea } from '../../components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';

const PAGE_SIZE = 50;

const SECTOR_LABELS: Record<string, string> = {
  comercial: 'Comercial',
  financeiro: 'Financeiro',
  suporte: 'Suporte',
  garantia: 'Garantia',
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

  const scrollRef = useRef<HTMLDivElement>(null);

  // Recepção em tempo real via WebSocket (status não exibido nesta tela).
  useChatWebSocket({
    roomId: selected?.id ?? null,
    enabled: !!selected,
    onMessage: (msg) => {
      // Normaliza ChatWsMessage → ChatMessage (created_at nunca null no estado).
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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rooms.filter((r) => {
      const matchSector = filterSector === 'all' || r.sector === filterSector;
      const matchSearch =
        !term ||
        (SECTOR_LABELS[r.sector ?? ''] ?? r.sector ?? '').toLowerCase().includes(term);
      return matchSector && matchSearch;
    });
  }, [rooms, filterSector, search]);

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
        {/* Lista de conversas */}
        <div className="flex w-full flex-col lg:w-[340px] lg:flex-shrink-0">
          <div className="mb-3 space-y-2">
            <Input
              className="h-9"
              placeholder="Buscar conversa por setor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={filterSector} onValueChange={(v) => setFilterSector(v)}>
              <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Setor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os setores</SelectItem>
                {Object.entries(SECTOR_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-2">
                {loading ? (
                  <p className="p-8 text-center text-sm text-muted-foreground">Carregando…</p>
                ) : filtered.length === 0 ? (
                  <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma conversa encontrada</p>
                ) : (
                  filtered.map((room) => (
                    <button
                      key={room.id}
                      onClick={() => openRoom(room)}
                      className={`mb-1 w-full rounded-lg border p-3 text-left transition-colors ${
                        selected?.id === room.id
                          ? 'border-primary/30 bg-primary/10'
                          : 'border-transparent hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-muted text-primary">
                          <MessageCircle className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate text-sm font-medium">{sectorLabel(room.sector)}</span>
                            <span className="flex-shrink-0 text-[10px] text-muted-foreground">
                              {formatDate(room.created_at)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">{statusLabel(room.status)}</span>
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                            <span className="text-[10px] text-muted-foreground">
                              Cliente {room.customer_id?.slice(0, 8)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>

        {/* Chat aberto */}
        {selected ? (
          <div className="flex min-w-0 flex-1 flex-col">
            <Card className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center gap-3 border-b px-4 py-3">
                <Button variant="ghost" size="icon" className="-ml-1 lg:hidden" onClick={() => setSelected(null)}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{sectorLabel(selected.sector)}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{sectorLabel(selected.sector)}</Badge>
                    <Badge variant="outline" className="text-[10px]">{statusLabel(selected.status)}</Badge>
                    <span className="truncate text-xs text-muted-foreground">
                      Cliente {selected.customer_id?.slice(0, 8)}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setTransferTarget(selected); setTransferSector(''); setTransferError(null); }}
                >
                  Transferir setor
                </Button>
              </div>

              <ScrollArea className="flex-1 px-4 py-4">
                <div className="space-y-4" ref={scrollRef}>
                  {messages.length === 0 && (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      Nenhuma mensagem ainda.
                    </p>
                  )}
                  {messages.map((msg) => {
                    const mine = msg.sender_type !== 'customer';
                    return (
                      <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className="max-w-[75%]">
                          <div
                            className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                              mine ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted text-foreground'
                            }`}
                          >
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                          </div>
                          <p className={`mt-1 text-[10px] text-muted-foreground ${mine ? 'text-right' : ''}`}>
                            {formatDateTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {!isClosed ? (
                <div className="flex gap-2 border-t p-3">
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
                <div className="border-t p-4 text-center text-sm text-muted-foreground">Conversa encerrada</div>
              )}
            </Card>
          </div>
        ) : (
          <div className="hidden min-w-0 flex-1 lg:flex">
            <Card className="flex w-full items-center justify-center">
              <CardContent className="p-12 text-center">
                <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <h3 className="text-lg font-semibold text-muted-foreground">Selecione uma conversa</h3>
                <p className="mt-1 text-sm text-muted-foreground/70">
                  Escolha uma conversa na lista para começar o atendimento.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Modal de transferência de setor (apenas atendente — backend revalida) */}
      <Dialog open={!!transferTarget} onOpenChange={(o) => { if (!o) setTransferTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Transferir conversa de setor</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Mover a conversa para outro setor de atendimento.
              </p>
              <Select value={transferSector || 'none'} onValueChange={(v) => setTransferSector(v === 'none' ? '' : v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Setor de destino" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione…</SelectItem>
                  {Object.entries(SECTOR_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {transferError && <p role="alert" className="text-sm text-destructive">{transferError}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setTransferTarget(null)} disabled={transferring}>
                Cancelar
              </Button>
              <Button onClick={confirmTransfer} disabled={transferring || !transferSector}>
                {transferring ? 'Transferindo…' : 'Transferir'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}