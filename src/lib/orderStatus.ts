import type { OrderStatus } from '@/types/api';

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; className: string }> = {
  draft: { label: 'Rascunho', className: 'bg-gray-100 text-gray-700' },
  submitted: { label: 'Enviado', className: 'bg-amber-100 text-amber-800' },
  received: { label: 'Recebido', className: 'bg-blue-100 text-blue-800' },
  under_review: { label: 'Em Análise', className: 'bg-blue-100 text-blue-800' },
  awaiting_customer: { label: 'Aguardando Cliente', className: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Aprovado', className: 'bg-emerald-100 text-emerald-800' },
  processing: { label: 'Em Processamento', className: 'bg-emerald-100 text-emerald-800' },
  invoiced: { label: 'Faturado', className: 'bg-violet-100 text-violet-800' },
  shipped: { label: 'Enviado / Trânsito', className: 'bg-purple-100 text-purple-800' },
  completed: { label: 'Concluído', className: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelado', className: 'bg-red-100 text-red-800' },
};

/**
 * Aceita OrderStatus | string com fallback seguro:
 * - status conhecido → rótulo/classe mapeados
 * - status desconhecido → exibe o próprio valor cru (nunca quebra a UI)
 * Isso cobre campos do backend tipados como string (ex.: to_status do
 * histórico) sem recorrer a `as any` (que esconderia erros reais).
 */
export function orderStatusLabel(status: OrderStatus | string): string {
  return ORDER_STATUS_META[status as OrderStatus]?.label ?? status;
}

export function orderStatusClass(status: OrderStatus | string): string {
  return ORDER_STATUS_META[status as OrderStatus]?.className ?? 'bg-gray-100 text-gray-700';
}

/** Transições que a empresa pode disparar no painel (mapeadas do backend). */
export const COMPANY_ORDER_TRANSITIONS: Array<{ from: OrderStatus[]; to: OrderStatus; label: string }> = [
  { from: ['submitted', 'received'], to: 'under_review', label: 'Iniciar análise' },
  { from: ['under_review'], to: 'approved', label: 'Aprovar' },
  { from: ['under_review'], to: 'cancelled', label: 'Recusar' },
  { from: ['approved'], to: 'processing', label: 'Iniciar processamento' },
  { from: ['processing'], to: 'invoiced', label: 'Faturar' },
  { from: ['invoiced'], to: 'shipped', label: 'Enviar' },
  { from: ['shipped'], to: 'completed', label: 'Concluir' },
];