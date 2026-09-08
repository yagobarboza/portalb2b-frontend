/**
 * Gerenciador de conexão WebSocket do chat (Bloco 9).
 *
 * SEGURANÇA:
 * - Conexão SEMPRE na mesma origem via proxy Vite (ws: true): o handshake
 *   carrega o cookie HttpOnly automaticamente. NUNCA expomos access_token
 *   em query string (evita vazamento em logs/referrer).
 * - 4401 (não autenticado) → dispara SESSION_EXPIRED_EVENT (limpa sessão).
 * - Reconexão exponencial com jitter (1s → 30s máx) — sem flood.
 * - Heartbeat a cada 30s em formato inócuo (backend ignora content vazio).
 * - Mensagens recebidas tratadas como DADOS NÃO CONFIÁVEIS: parse com
 *   try/catch, validação de shape; renderização sempre via React (escapada).
 */
import { useEffect, useRef, useState } from 'react';
import { SESSION_EXPIRED_EVENT } from './api';
import type { ChatMessage } from '@/types/api';

export type ChatConnectionStatus = 'connecting' | 'open' | 'closed' | 'reconnecting';

/** Shape das mensagens publicadas pelo backend via Redis Pub/Sub. */
export interface ChatWsMessage {
  id: string;
  room_id: string;
  sender_type: 'customer' | 'user' | 'system' | string;
  sender_user_id: string | null;
  sender_customer_id: string | null;
  content: string;
  attachment_file_id: string | null;
  read_at: string | null;
  created_at: string | null;
}

interface UseChatWebSocketOptions {
  roomId: string | null;
  enabled?: boolean;
  onMessage: (msg: ChatWsMessage) => void;
  onStatusChange?: (status: ChatConnectionStatus) => void;
}

const MAX_RECONNECT_DELAY = 30_000;
const HEARTBEAT_INTERVAL = 30_000;

function buildWsUrl(roomId: string): string {
  // Mesma origem: o proxy do Vite (ws: true) encaminha /api para o backend
  // e envia os cookies HttpOnly da sessão no handshake.
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/api/v1/chat/ws/${roomId}`;
}

/** Valida o shape mínimo de uma mensagem vinda do WS (dados não confiáveis). */
function isChatMessage(raw: unknown): raw is ChatWsMessage {
  if (typeof raw !== 'object' || raw === null) return false;
  const m = raw as Record<string, unknown>;
  return (
    typeof m.id === 'string' &&
    typeof m.room_id === 'string' &&
    typeof m.content === 'string' &&
    m.content.length <= 4000 &&
    (typeof m.sender_type === 'string' || m.sender_type === undefined)
  );
}

/**
 * Converte uma mensagem bruta do WebSocket (dados não confiáveis) para o
 * tipo ChatMessage do estado. Normaliza campos anuláveis:
 * - created_at: usa fallback ISO local se o payload vier null (nunca quebra
 *   a tipagem do estado, que exige string).
 * - read_at: mantém null (campo anulável no ChatMessage).
 */
export function toChatMessage(msg: ChatWsMessage): ChatMessage {
  return {
    id: msg.id,
    room_id: msg.room_id,
    sender_type: msg.sender_type as ChatMessage['sender_type'],
    sender_user_id: msg.sender_user_id,
    sender_customer_id: msg.sender_customer_id,
    content: msg.content,
    attachment_file_id: msg.attachment_file_id,
    read_at: msg.read_at ?? null,
    created_at: msg.created_at ?? new Date().toISOString(),
  };
}

export function useChatWebSocket({
  roomId,
  enabled = true,
  onMessage,
  onStatusChange,
}: UseChatWebSocketOptions) {
  const socketRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<number | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const attemptsRef = useRef(0);
  const [status, setStatus] = useState<ChatConnectionStatus>('closed');

  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const setStatusSafe = (next: ChatConnectionStatus) => {
    setStatus(next);
    onStatusChangeRef.current?.(next);
  };

  useEffect(() => {
    if (!enabled || !roomId) return;

    let disposed = false;
    let ws: WebSocket | null = null;

    const clearTimers = () => {
      if (timerRef.current !== null) { window.clearTimeout(timerRef.current); timerRef.current = null; }
      if (heartbeatRef.current !== null) { window.clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
    };

    const scheduleReconnect = () => {
      if (disposed) return;
      setStatusSafe('reconnecting');
      const delay = Math.min(MAX_RECONNECT_DELAY, 1000 * 2 ** attemptsRef.current) +
        Math.floor(Math.random() * 400); // jitter
      attemptsRef.current += 1;
      timerRef.current = window.setTimeout(() => connect(), delay);
    };

    const startHeartbeat = () => {
      heartbeatRef.current = window.setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          // Inócuo para o backend (content vazio → "continue").
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, HEARTBEAT_INTERVAL);
    };

    const connect = () => {
      if (disposed) return;
      setStatusSafe('connecting');
      try {
        ws = new WebSocket(buildWsUrl(roomId));
      } catch {
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        attemptsRef.current = 0; // reset do backoff
        setStatusSafe('open');
        startHeartbeat();
      };

      ws.onmessage = (event) => {
        let raw: unknown;
        try {
          raw = JSON.parse(String(event.data));
        } catch {
          return; // payload inválido → ignora silenciosamente
        }
        // ignora heartbeats/respostas de protocolo
        if (raw && typeof raw === 'object' && (raw as { type?: string }).type === 'ping') return;
        if (isChatMessage(raw)) onMessageRef.current(raw);
      };

      ws.onerror = () => {
        // o "close" logo em seguida dispara a reconexão
      };

      ws.onclose = (event) => {
        if (disposed) return;
        clearTimers();
        // 4401 = não autenticado/expirado → sessão inválida
        if (event.code === 4401) {
          setStatusSafe('closed');
          window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
          return;
        }
        scheduleReconnect();
      };
    };

    connect();

    return () => {
      disposed = true;
      clearTimers();
      if (ws) {
        ws.onclose = null; // evita reconexão no unmount
        ws.close(1000, 'unmount');
        ws = null;
      }
      socketRef.current = null;
    };
  }, [enabled, roomId]);

  return { status };
}