// ===== Re-exporta os tipos de contrato da API (schemas do backend) =====
export * from './api';

// ===== Constantes e mapas de DOMÍNIO (específicos do frontend) =====

export type Sector = 'comercial' | 'financeiro' | 'suporte' | 'garantia';

export const SECTORS: Sector[] = ['comercial', 'financeiro', 'suporte', 'garantia'];

export const SECTOR_LABELS: Record<Sector, string> = {
  comercial: 'Comercial',
  financeiro: 'Financeiro',
  suporte: 'Suporte',
  garantia: 'Garantia',
};

// ===== Mapas de status (enum da API -> rótulo PT-BR) =====

export const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  submitted: 'Enviado',
  received: 'Recebido',
  under_review: 'Em Análise',
  awaiting_customer: 'Aguardando Cliente',
  approved: 'Aprovado',
  processing: 'Em Processamento',
  invoiced: 'Faturado',
  shipped: 'Enviado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

export const TICKET_STATUS_LABELS: Record<string, string> = {
  open: 'Aberto',
  under_review: 'Em Análise',
  awaiting_customer: 'Aguardando Cliente',
  awaiting_company: 'Aguardando Empresa',
  resolved: 'Resolvido',
  closed: 'Fechado',
};

export const TICKET_PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

export const FINANCIAL_STATUS_LABELS: Record<string, string> = {
  open: 'Em Aberto',
  paid: 'Pago',
  overdue: 'Vencido',
};

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  order: 'Pedido',
  ticket: 'Ticket',
  chat: 'Chat',
  financial: 'Financeiro',
  system: 'Sistema',
};

export const CUSTOMER_STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  blocked: 'Bloqueado',
};

export const USER_STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  blocked: 'Bloqueado',
};