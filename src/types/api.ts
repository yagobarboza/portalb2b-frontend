/**
 * Tipos da API (Bloco 0 — alinhamento com os schemas Pydantic do backend portal-b2b).
 * Fonte: app/schemas/*.py + app/models/enums.py + app/core/permissions.py
 *
 * SEGURANÇA:
 * - Apenas dados públicos de contrato. Nenhum segredo, token ou credencial.
 * - Campos opcionais espelham `| None = None` do Pydantic.
 * - Valores monetários trafegam como number (o backend envia Decimal/string
 *   numérica) e devem ser formatados com Intl.NumberFormat('pt-BR', ...).
 */
// ─────────────────────────── Enums (espelho de app/models/enums.py) ─────────
export type UserStatus = 'active' | 'inactive' | 'blocked';
export type CustomerStatus = 'active' | 'inactive' | 'blocked';
export type CompanyStatus = 'active' | 'inactive';
export type ProductStatus = 'active' | 'inactive';
export type CartStatus = 'open' | 'checked_out' | 'abandoned';
export type OrderStatus =
  | 'draft'
  | 'submitted'
  | 'received'
  | 'under_review'
  | 'awaiting_customer'
  | 'approved'
  | 'processing'
  | 'invoiced'
  | 'shipped'
  | 'completed'
  | 'cancelled';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus =
  | 'open'
  | 'under_review'
  | 'awaiting_customer'
  | 'awaiting_company'
  | 'resolved'
  | 'closed';
export type ChatSector = 'sales' | 'commercial' | 'financial' | 'support' | 'service';
export type ChatRoomStatus = 'open' | 'closed';
export type FinancialAccountStatus = 'open' | 'paid' | 'overdue';
export type FileOwnerType = 'product' | 'catalog' | 'ticket' | 'chat' | 'document' | 'user';
export type NotificationType = 'order' | 'ticket' | 'chat' | 'financial' | 'system';

// ─────────────────────────── Auth (schemas/auth.py) ─────────────────────────
export interface LoginRequest {
  email: string;
  password: string;
}
export interface RefreshRequest {
  refresh_token?: string | null;
}
export interface TokenResponse {
  access_token: string;
  token_type: string; // "bearer"
  expires_in: number;
}
export interface UserInfo {
  id: string;
  email: string;
  full_name: string;
  tenant_id: string | null;
  is_super_admin: boolean;
  mfa_enabled: boolean;
  customer_id: string | null;
  roles: string[];       // slugs das roles do usuário
  permissions: string[]; // códigos de permissão efetivos (RBAC)
}
export interface MfaSetupResponse {
  secret: string;
  qr_code: string;
  recovery_codes: string[];
}
export interface MfaVerifyRequest {
  secret: string;
  code: string;
}
export interface PasswordResetRequest {
  email: string;
}
export interface PasswordResetConfirmRequest {
  token: string;
  new_password: string;
}

// ─────────────────────── Company/Branding (schemas/company.py) ──────────────
export interface CompanyBranding {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
}
export interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  slug: string;
  domain: string | null;
  status: CompanyStatus;
  primary_color: string | null;
  secondary_color: string | null;
  created_at: string;
}
export interface CompanyPage {
  items: Company[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}
export interface CompanyStatusUpdate {
  status: 'active' | 'inactive';
}
export interface CompanyCreateRequest {
  name: string;
  cnpj: string;
  slug: string;
  domain?: string | null;
  primary_color?: string | null; // ^#[0-9a-fA-F]{6}$
  secondary_color?: string | null;
  admin_email: string;
  admin_full_name: string;
}

// ─────────────────────────── Catalog (schemas/catalog.py) ───────────────────
export interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  is_active: boolean;
  created_at: string;
}
export interface CategoryCreate {
  name: string;
  slug: string;
  parent_id?: string | null;
}
export interface CategoryUpdate {
  name?: string | null;
  slug?: string | null;
  parent_id?: string | null;
  is_active?: boolean | null;
}
export interface Product {
  id: string;
  sku: string;
  code: string | null;
  name: string;
  description: string | null;
  brand: string | null;
  category_id: string | null;
  unit: string | null;
  price: number;
  stock: number | null;
  status: ProductStatus;
  created_at: string;
  image_url: string | null;
}
export interface ProductCreate {
  sku: string;
  code?: string | null;
  name: string;
  description?: string | null;
  brand?: string | null;
  category_id?: string | null;
  unit?: string | null;
  price: number;
  stock?: number | null;
}
export interface ProductUpdate {
  sku?: string | null;
  code?: string | null;
  name?: string | null;
  description?: string | null;
  brand?: string | null;
  category_id?: string | null;
  unit?: string | null;
  price?: number | null;
  stock?: number | null;
}
export interface ProductListParams {
  search?: string | null;
  category_id?: string | null;
  status?: ProductStatus | null;
  min_price?: number | null;
  max_price?: number | null;
  sort_by?: string | null;
  sort_dir?: 'asc' | 'desc' | null;
  page?: number;
  page_size?: number;
}
export interface ProductPage {
  items: Product[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}
export interface PriceListCreate {
  name: string;
  description?: string | null;
}
export interface PriceList {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}
export interface CustomerPriceCreate {
  customer_id: string;
  product_id: string;
  price: number;
}
export interface CustomerPrice {
  id: string;
  customer_id: string;
  product_id: string;
  price: number;
}
export interface PriceQuote {
  product_id: string;
  sku: string;
  name: string;
  base_price: number;
  customer_price: number | null;
  final_price: number;
  price_source: 'customer' | 'price_list' | 'default';
}

// ─────────────────────────── Cart (schemas/cart.py) ─────────────────────────
export interface CartItemAdd {
  product_id: string;
  quantity: number;
}
export interface CartItemUpdate {
  quantity: number;
}
export interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}
export interface Cart {
  id: string;
  customer_id: string;
  status: CartStatus;
  items: CartItem[];
  total: number;
}

// ─────────────────────────── Orders (schemas/order.py) ──────────────────────
export interface OrderStatusUpdate {
  status: string;
  note?: string | null; // max 500
}
export interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}
export interface OrderStatusHistory {
  id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  created_at: string;
}
export interface Order {
  id: string;
  number: string;
  customer_id: string;
  status: OrderStatus;
  total: number;
  notes: string | null;
  created_at: string;
  items: OrderItem[];
  status_history: OrderStatusHistory[];
}
export interface OrderCreate {
  notes?: string | null;
}
export interface OrderPage {
  items: Order[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// ─────────────────────────── Customers (schemas/customer.py) ────────────────
export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null; // CPF ou CNPJ (máx. 18)
  status: CustomerStatus;
  created_at: string;
}
export interface CustomerCreate {
  name: string;
  email?: string | null;
  phone?: string | null;
  document?: string | null;
}
export interface CustomerUpdate {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  document?: string | null;
}
export interface CustomerPage {
  items: Customer[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}
export interface CustomerImportResult {
  created: number;
  skipped: number;
  errors: Array<{ row: Record<string, unknown>; error: string }>;
}
export interface CustomerImportRow {
  name: string;
  email?: string | null;
  phone?: string | null;
  document?: string | null;
}

// ─────────────────────────── Users/Team (schemas/user.py) ───────────────────
export interface UserRead {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  status: UserStatus;
  roles: string[]; // slugs
  // ✅ NOVO: setor de atendimento do chat (NULL = vê todos os setores)
  chat_sector: ChatSector | null;
}
export interface UserCreate {
  email: string;
  full_name: string;
  phone?: string | null;
  role_slug: string;
}
export interface UserUpdate {
  full_name?: string | null;
  phone?: string | null;
  role_slugs?: string[] | null;
  status?: UserStatus | null;
  // ✅ NOVO: setor de atendimento do chat (NULL = vê todos os setores)
  chat_sector?: ChatSector | null;
}
export interface UserPage {
  items: UserRead[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// ─────────────────────────── Roles (schemas/role.py) ────────────────────────
export interface Role {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
  permissions: string[]; // códigos de permissão
}
export interface RoleCreate {
  name: string;
  slug: string; // ^[a-z0-9-_]+$
  description?: string | null;
  permission_codes?: string[];
}
export interface RoleUpdate {
  name?: string | null;
  description?: string | null;
  permission_codes?: string[] | null;
}
export interface RoleList {
  items: Role[];
}

// ─────────────────────────── Invitations (schemas/invitation.py) ────────────
export interface InviteCreate {
  email: string;
  full_name?: string | null;
  role_slug: string;
}
export interface InviteResponse {
  id: string;
  email: string;
  full_name: string | null;
  role_slug: string;
  status: string;
  expires_at: string;
  created_at: string;
}
export interface InviteAccept {
  token: string;
  full_name: string;
  password: string; // min 8
}
export interface Invitation {
  id: string;
  email: string;
  full_name: string | null;
  role_slug: string;
  status: string;
  expires_at: string;
  created_at: string;
}

// ─────────────────────────── Tickets (schemas/ticket.py) ────────────────────
export interface TicketCreate {
  title: string;
  description?: string | null;
  category?: string | null;
  priority?: TicketPriority; // default 'medium'
}
export interface TicketMessageCreate {
  content: string;
  is_internal?: boolean; // default false — notas internas só p/ operadores
}
export interface TicketStatusUpdate {
  status: TicketStatus;
  note?: string | null;
}
export interface TicketAssignRequest {
  assignee_id: string;
}
export interface TicketMessage {
  id: string;
  ticket_id: string;
  author_user_id: string | null;
  author_customer_id: string | null;
  content: string;
  is_internal: boolean;
  attachment_file_id: string | null;
  created_at: string;
}
export interface TicketStatusHistory {
  id: string;
  from_status: TicketStatus | null;
  to_status: TicketStatus;
  note: string | null;
  created_at: string;
}
export interface Ticket {
  id: string;
  number: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  customer_id: string | null;
  assignee_id: string | null;
  created_at: string;
  updated_at: string;
}
export interface TicketDetail extends Ticket {
  messages: TicketMessage[];
  history: TicketStatusHistory[];
}
export interface TicketPage {
  items: Ticket[];
  total: number;
  page: number;
  page_size: number;
}

// ─────────────────────────── Chat (schemas/chat.py) ─────────────────────────
export interface ChatMessageCreate {
  content: string; // 1..4000
}
export interface ChatMessage {
  id: string;
  room_id: string;
  sender_type: string; // "user" | "customer" | ...
  sender_user_id: string | null;
  sender_customer_id: string | null;
  content: string;
  read_at: string | null;
  attachment_file_id: string | null;
  created_at: string;
}
export interface ChatMessagePage {
  items: ChatMessage[];
  total: number;
  page: number;
  page_size: number;
}
export interface ChatRoom {
  id: string;
  customer_id: string;
  sector: string;
  status: ChatRoomStatus;
  created_at: string;
}
export interface ChatTransferRequest {
  sector: ChatSector;
}

// ─────────────────────────── Financial (schemas/financial.py) ───────────────
export interface FinancialPayment {
  id: string;
  value: number;
  paid_at: string;
  method: string | null;
}
export interface FinancialAccount {
  id: string;
  customer_id: string;
  document: string;
  value: number;
  due_date: string;
  status: FinancialAccountStatus;
  paid_at: string | null;
  order_id: string | null;
  external_id: string | null;
}
export interface FinancialAccountDetail extends FinancialAccount {
  days_overdue: number;
  payments: FinancialPayment[];
}
export interface FinancialAccountPage {
  items: FinancialAccount[];
  total: number;
  page: number;
  page_size: number;
}

// ─────────────────────────── Notifications (schemas/notification.py) ────────
export interface Notification {
  id: string;
  user_id: string | null;
  customer_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}
export interface NotificationPage {
  items: Notification[];
  total: number;
  page: number;
  page_size: number;
}
export interface UnreadCount {
  unread: number;
}

// ─────────────────────────── Paginação genérica ─────────────────────────────
export interface PageMeta {
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// ─────────────────────────── Files (schemas/file.py — Bloco 3) ─────────────
export interface FileRead {
  id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  owner_type: string;
  owner_id: string;
  is_private: boolean;
  created_at: string;
}
export interface FileUploadResponse {
  file: FileRead;
  url: string;
}
export interface FileDownloadResponse {
  url: string;
  expires_in: number;
}