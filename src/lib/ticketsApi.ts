/**
 * Camada de API de Tickets (Bloco 8).
 * SEGURANÇA (espelha o backend):
 * - Cliente NUNCA envia is_internal=true (backend rejeita com 403).
 * - Mensagens internas só são buscadas para perfis de empresa (include_internal).
 * - Erros sanitizados via ApiError; nada de detalhes internos na UI.
 * - Envio de anexos via multipart/form-data (POST /tickets/{id}/attachments).
 */
import { api } from './api';
import type {
  Ticket, TicketDetail, TicketMessage, TicketPage,
  TicketPriority, TicketStatus,
} from '@/types/api';

/** Abertura de ticket (apenas cliente). */
export function createTicket(payload: {
  title: string;
  description?: string | null;
  category?: string | null;
  priority?: TicketPriority;
}) {
  return api.post<Ticket>('/tickets', payload);
}

/** Lista tickets — o backend decide o escopo (cliente: próprios; empresa: tenant). */
export function listTickets(params: { page?: number; page_size?: number } = {}) {
  return api.get<TicketPage>('/tickets', params);
}

/** Detalhe com mensagens + histórico. */
export function getTicket(ticketId: string) {
  return api.get<TicketDetail>(`/tickets/${ticketId}`);
}

/**
 * Envia mensagem. Parâmetro isInternal:
 * - empresa: true → nota interna (visível apenas para a equipe);
 * - cliente: NUNCA passar true (backend responde 403).
 */
export function sendTicketMessage(ticketId: string, content: string, isInternal = false) {
  return api.post<TicketMessage>(`/tickets/${ticketId}/messages`, {
    content,
    is_internal: isInternal,
  });
}

/** Envia anexo do ticket (multipart) — cria uma mensagem com o arquivo. */
export function uploadTicketAttachment(ticketId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return api.upload<TicketMessage>(`/tickets/${ticketId}/attachments`, formData);
}

/** URL de download do anexo (GET /files/{id}/download → {url, expires_in}). */
export function getAttachmentUrl(fileId: string): string {
  // URL relativa via proxy Vite; em produção usa a base configurada pelo api.ts.
  return `/api/v1/files/${fileId}/download`;
}

/** Atualiza status (apenas empresa). */
export function updateTicketStatus(ticketId: string, status: TicketStatus, note?: string | null) {
  return api.patch<Ticket>(`/tickets/${ticketId}/status`, { status, note: note || null });
}

/** Atribui responsável (apenas empresa). */
export function assignTicket(ticketId: string, assigneeId: string) {
  return api.post<Ticket>(`/tickets/${ticketId}/assign`, { assignee_id: assigneeId });
}