import type { TicketPriority, TicketStatus } from '@/types/api';

export const TICKET_PRIORITY_META: Record<TicketPriority, { label: string; className: string }> = {
  low: { label: 'Baixa', className: 'bg-gray-100 text-gray-700' },
  medium: { label: 'Média', className: 'bg-blue-100 text-blue-800' },
  high: { label: 'Alta', className: 'bg-amber-100 text-amber-800' },
  urgent: { label: 'Urgente', className: 'bg-red-100 text-red-800' },
};

export const TICKET_STATUS_META: Record<TicketStatus, { label: string; className: string }> = {
  open: { label: 'Aberto', className: 'bg-blue-100 text-blue-800' },
  under_review: { label: 'Em Análise', className: 'bg-blue-100 text-blue-800' },
  awaiting_customer: { label: 'Aguardando Cliente', className: 'bg-amber-100 text-amber-800' },
  awaiting_company: { label: 'Aguardando Empresa', className: 'bg-orange-100 text-orange-800' },
  resolved: { label: 'Resolvido', className: 'bg-emerald-100 text-emerald-800' },
  closed: { label: 'Fechado', className: 'bg-gray-100 text-gray-700' },
};

export function ticketPriorityLabel(p: TicketPriority | string): string {
  return TICKET_PRIORITY_META[p as TicketPriority]?.label ?? p;
}

export function ticketPriorityClass(p: TicketPriority | string): string {
  return TICKET_PRIORITY_META[p as TicketPriority]?.className ?? 'bg-gray-100 text-gray-700';
}

export function ticketStatusLabel(s: TicketStatus | string): string {
  return TICKET_STATUS_META[s as TicketStatus]?.label ?? s;
}

export function ticketStatusClass(s: TicketStatus | string): string {
  return TICKET_STATUS_META[s as TicketStatus]?.className ?? 'bg-gray-100 text-gray-700';
}