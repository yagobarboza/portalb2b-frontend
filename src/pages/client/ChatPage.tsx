import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, MessageCircle, MessageSquare, Plus, Send } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { toChatMessage, useChatWebSocket } from '../../lib/websocket';
import type { ChatMessage, ChatMessagePage, ChatRoom } from '@/types/api';
import { formatDate, formatDateTime } from '../../lib/format';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { ScrollArea } from '../../components/ui/scroll-area';

const PAGE_SIZE = 50;

// ✅ 5b: slugs da API em inglês + compatibilidade com os antigos.
const SECTOR_LABELS: Record<string, string> = {
  sales: 'Vendas',
  commercial: 'Comercial',
  financial: 'Financeiro',
  support: 'Suporte',
  service: 'Serviços',
  comercial: 'Comercial',
  financeiro: 'Financeiro',
  suporte: 'Suporte',
  garantia: 'Garantia',
};

const ROOM_STATUS_LABEL: Record<string, string> = {
  open: 'Aberta',
  closed: 'Encerrada',
};

export default function ClientChatPage() {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selected, setSelected] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [opening, setOpening] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Recepção em tempo real via WebSocket.
  const { status: wsStatus } = useChatWebSocket({
    roomId: selected?.id ?? null,
    enabled: !!selected,
    onMessage: (msg) => {
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, toChatMessage(msg)]
      );
      if (selected && msg.sender_type !== 'customer') {
        api.post(`/chat/rooms/${selected.id}/read`).catch(() => {});
      }
    },
  });

  const loadRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const data = await api.get<ChatRoom[]>('/chat/rooms');
      setRooms(data);
    } catch {
      toast.error('Não foi possível carregar suas conversas.');
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  // Cria/obtém a sala automática do cliente (contrato: sem body, sala única).
  const openRoom = async () => {
    setOpening(true);
    try {
      const room = await api.post<ChatRoom>('/chat/rooms', {});
      setSelected(room);
      await loadHistory(room.id);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao iniciar o atendimento.');
    } finally {
      setOpening(false);
    }
  };

  const loadHistory = async (roomId: string) => {
    try {
      const data = await api.get<ChatMessagePage>(`/chat/rooms/${roomId}/messages`, {
        page: 1,
        page_size: PAGE_SIZE,
      });
      setMessages(data.items);
    } catch {
      setMessages([]);
    }
  };

  const openExisting = async (room: ChatRoom) => {
    setSelected(room);
    await loadHistory(room.id);
    api.post(`/chat/rooms/${room.id}/read`).catch(() => {});
  };

  // Auto-scroll para a última mensagem.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, selected?.id]);

  const handleSend = async () => {
    const content = newMsg.trim();
    if (!content || !selected || sending) return;
    setSending(true);
    try {
      await api.post<ChatMessage>(`/chat/rooms/${selected.id}/messages`, { content });
      setNewMsg('');
      await loadHistory(selected.id);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  };

  // ✅ 5b: lado cliente — "Você" para as próprias mensagens e "Atendimento"
  // para as da empresa (o cliente não tem acesso à lista de usuários).
  const senderName = (m: ChatMessage) => {
    if (m.sender_type === 'system') return 'Sistema';
    if (m.sender_user_id) return 'Atendimento';
    return 'Você';
  };

  const sectorLabel = (s: string | null) => SECTOR_LABELS[s ?? ''] ?? 'Atendimento';
  const statusLabel = (s: string | null) => ROOM_STATUS_LABEL[s ?? 'open'] ?? (s ?? 'open');
  const isClosed = selected?.status === 'closed';

  // ── Chat aberto
  if (selected) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelected(null)} aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-bold">
              <MessageCircle className="h-5 w-5 text-primary" />
              {sectorLabel(selected.sector)}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="secondary">{sectorLabel(selected.sector)}</Badge>
              <Badge variant="outline">{statusLabel(selected.status)}</Badge>
              <span className="text-xs text-muted-foreground">
                {wsStatus === 'open' ? 'conectado' : wsStatus === 'reconnecting' ? 'reconectando…' : 'sem conexão'}
              </span>
            </div>
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="border-b bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            Conversa com o setor de {sectorLabel(selected.sector)} · início {formatDate(selected.created_at)}
          </div>

          <ScrollArea className="h-[480px] px-4 py-4">
            <div ref={scrollRef} className="space-y-3">
              {messages.map((m) => {
                const own = !m.sender_user_id;
                return (
                  <div key={m.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-lg border px-3 py-2 ${own ? 'bg-primary/10' : 'bg-muted/30'}`}>
                      {/* ✅ 5b: nome do remetente ("Você" / "Atendimento") */}
                      <p className="mb-0.5 text-xs font-medium text-muted-foreground">{senderName(m)}</p>
                      <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                      <p className="mt-1 text-right text-[10px] text-muted-foreground">{formatDateTime(m.created_at)}</p>
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
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                className="flex-1"
                maxLength={4000}
              />
              <Button onClick={handleSend} disabled={!newMsg.trim() || sending} size="icon" aria-label="Enviar">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <p className="border-t p-3 text-center text-sm text-muted-foreground">Conversa encerrada.</p>
          )}
        </Card>
      </div>
    );
  }

  // ── Lista de conversas
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Chat de Atendimento</h1>
          <p className="mt-1 text-muted-foreground">Converse com os setores da empresa.</p>
        </div>
        <Button onClick={openRoom} disabled={opening}>
          <Plus className="mr-2 h-4 w-4" />
          {opening ? 'Abrindo…' : 'Iniciar atendimento'}
        </Button>
      </div>

      {loadingRooms ? (
        <p className="py-16 text-center text-muted-foreground">Carregando…</p>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <MessageSquare className="mb-4 h-16 w-16 text-muted-foreground/30" />
          <h3 className="text-lg font-semibold text-muted-foreground">Nenhuma conversa</h3>
          <p className="mt-1 text-sm text-muted-foreground/70">Inicie um atendimento com um dos nossos setores.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rooms.map((room) => (
            <Card key={room.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => openExisting(room)}>
              <div className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold">{sectorLabel(room.sector)}</h3>
                    <Badge variant="outline" className="text-[10px]">{statusLabel(room.status)}</Badge>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    Conversa iniciada em {formatDate(room.created_at)}
                  </p>
                </div>
                <MessageCircle className="h-5 w-5 shrink-0 text-muted-foreground/50" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}