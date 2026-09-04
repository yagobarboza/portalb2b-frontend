export type Role = 'cliente' | 'admin' | 'superadmin';

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: Role;
  tenantId?: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  primaryColor: string;
  logo?: string;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  description: string;
  price: number;
  stock: number;
  imageUrl?: string;
  tenantId: string;
  active: boolean;
}

export interface CustomerPricing {
  productId: string;
  price: number;
}

export interface Customer {
  id: string;
  name: string;
  fantasyName?: string;
  email: string;
  cnpj: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  cep?: string;
  status: 'ativo' | 'inativo';
  tenantId: string;
  negotiatedPrices: CustomerPricing[];
  userId?: string;
}

export type OrderStatus = 'submitted' | 'approved' | 'shipped' | 'cancelled';

export interface OrderItem {
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  createdAt: string;
  updatedAt: string;
  note?: string;
  tenantId: string;
}

export type TicketPriority = 'baixa' | 'média' | 'alta' | 'urgente';
export type TicketStatus = 'aberto' | 'em_andamento' | 'aguardando_cliente' | 'resolvido' | 'fechado';

export interface TicketAttachment {
  id: string;
  name: string;
  type: string;
  url: string;
}

export interface TicketMessage {
  id: string;
  author: string;
  authorRole: 'cliente' | 'suporte';
  content: string;
  createdAt: string;
  attachments?: TicketAttachment[];
}

export type Sector = 'comercial' | 'financeiro' | 'suporte' | 'garantia';

export const SECTORS: Sector[] = ['comercial', 'financeiro', 'suporte', 'garantia'];

export const SECTOR_LABELS: Record<Sector, string> = {
  comercial: 'Comercial',
  financeiro: 'Financeiro',
  suporte: 'Suporte',
  garantia: 'Garantia',
};

export interface Ticket {
  id: string;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  sector: Sector;
  assignedTo?: string;
  customerId: string;
  customerName: string;
  tenantId: string;
  messages: TicketMessage[];
  createdAt: string;
  updatedAt: string;
}

export type FinancialStatus = 'aberto' | 'pago' | 'vencido';

export interface FinancialRecord {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: FinancialStatus;
  orderId?: string;
  customerId: string;
  customerName: string;
  tenantId: string;
}

export type TeamRole = 'admin' | 'vendedor' | 'suporte' | 'financeiro';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  cpf?: string;
  role: TeamRole;
  tenantId: string;
  active: boolean;
  joinedAt: string;
}

export interface CartItem {
  product: Product;
  qty: number;
}

export interface ChatMessage {
  id: string;
  author: string;
  authorRole: 'cliente' | 'suporte';
  content: string;
  createdAt: string;
}

export type ConversationStatus = 'aberta' | 'pendente' | 'encerrada';

export interface ChatConversation {
  id: string;
  customerId: string;
  customerName: string;
  sector: Sector;
  status: ConversationStatus;
  subject: string;
  messages: ChatMessage[];
  tenantId: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}
