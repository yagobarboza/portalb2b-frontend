import type {
  Product, Customer, Order, Ticket,
  FinancialAccount, UserRead, ChatRoom, ChatMessage,
} from '../types/api';

// ─────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────
export const mockCategories = [
  { id: 'cat-eletronicos', name: 'Eletrônicos', slug: 'eletronicos', parent_id: null, is_active: true, created_at: '2025-01-01T00:00:00Z' },
  { id: 'cat-informatica', name: 'Informática', slug: 'informatica', parent_id: null, is_active: true, created_at: '2025-01-01T00:00:00Z' },
  { id: 'cat-perifericos', name: 'Periféricos', slug: 'perifericos', parent_id: null, is_active: true, created_at: '2025-01-01T00:00:00Z' },
  { id: 'cat-redes', name: 'Redes', slug: 'redes', parent_id: null, is_active: true, created_at: '2025-01-01T00:00:00Z' },
  { id: 'cat-acessorios', name: 'Acessórios', slug: 'acessorios', parent_id: null, is_active: true, created_at: '2025-01-01T00:00:00Z' },
];

// ─────────────────────────────────────────────
// PRODUCTS (20 produtos em 5 categorias)
// ─────────────────────────────────────────────
export const mockProducts: Product[] = [
  // Eletrônicos
  { id: 'prod-1', sku: 'TM-SG-A54', code: null, name: 'Smartphone Samsung Galaxy A54', description: 'Smartphone Android 13, 6GB RAM, 128GB, câmera 50MP', brand: 'Samsung', category_id: 'cat-eletronicos', unit: 'un', price: 1499.9, stock: 45, status: 'active', created_at: '2025-01-01T00:00:00Z', image_url: null },
  { id: 'prod-2', sku: 'TM-IPAD-9', code: null, name: 'Tablet iPad 9ª Geração', description: 'iPad 10,2", chip A13 Bionic, 64GB, Wi-Fi', brand: 'Apple', category_id: 'cat-eletronicos', unit: 'un', price: 2799.0, stock: 20, status: 'active', created_at: '2025-01-01T00:00:00Z', image_url: null },
  { id: 'prod-3', sku: 'TM-SN-WH1000', code: null, name: 'Fone Bluetooth Sony WH-1000XM5', description: 'Cancelamento ativo de ruído, até 30h de bateria', brand: 'Sony', category_id: 'cat-eletronicos', unit: 'un', price: 1899.9, stock: 30, status: 'active', created_at: '2025-01-01T00:00:00Z', image_url: null },
  { id: 'prod-4', sku: 'TM-XM-MIW', code: null, name: 'Smartwatch Xiaomi Mi Watch', description: 'GPS integrado, monitor cardíaco, 16 dias de bateria', brand: 'Xiaomi', category_id: 'cat-eletronicos', unit: 'un', price: 599.9, stock: 60, status: 'active', created_at: '2025-01-01T00:00:00Z', image_url: null },
  // Informática
  { id: 'prod-5', sku: 'TM-DL-IN15', code: null, name: 'Notebook Dell Inspiron 15', description: 'Intel Core i5-12ª, 8GB RAM, SSD 256GB, Windows 11', brand: 'Dell', category_id: 'cat-informatica', unit: 'un', price: 3299.0, stock: 15, status: 'active', created_at: '2025-01-01T00:00:00Z', image_url: null },
  { id: 'prod-6', sku: 'TM-LG-24FHD', code: null, name: 'Monitor LG 24" Full HD', description: 'IPS 1920x1080, 75Hz, HDR10, DisplayPort + HDMI', brand: 'LG', category_id: 'cat-informatica', unit: 'un', price: 899.0, stock: 35, status: 'active', created_at: '2025-01-01T00:00:00Z', image_url: null },
  { id: 'prod-7', sku: 'TM-KS-480SSD', code: null, name: 'SSD Kingston 480GB SATA', description: 'SSD SATA III 2,5", leitura 500MB/s', brand: 'Kingston', category_id: 'cat-informatica', unit: 'un', price: 269.9, stock: 50, status: 'active', created_at: '2025-01-01T00:00:00Z', image_url: null },
  { id: 'prod-8', sku: 'TM-CR-16DDR4', code: null, name: 'Memória RAM Corsair 16GB DDR4', description: '16GB 3200MHz, heatspreader, baixa latência', brand: 'Corsair', category_id: 'cat-informatica', unit: 'un', price: 319.9, stock: 40, status: 'active', created_at: '2025-01-01T00:00:00Z', image_url: null },
  // Periféricos
  { id: 'prod-9', sku: 'TM-RD-K552', code: null, name: 'Teclado Mecânico Redragon K552', description: 'Switch Red, ABNT2, RGB por tecla, anti-ghosting', brand: 'Redragon', category_id: 'cat-perifericos', unit: 'un', price: 299.9, stock: 40, status: 'active', created_at: '2025-01-01T00:00:00Z', image_url: null },
  { id: 'prod-10', sku: 'TM-LG-MXM3', code: null, name: 'Mouse Logitech MX Master 3', description: 'Sensor 4000DPI, scroll lateral, USB-C', brand: 'Logitech', category_id: 'cat-perifericos', unit: 'un', price: 549.9, stock: 25, status: 'active', created_at: '2025-01-01T00:00:00Z', image_url: null },
  { id: 'prod-11', sku: 'TM-LG-C920', code: null, name: 'Webcam Logitech C920 HD', description: 'Full HD 1080p, 30fps, microfone estéreo embutido', brand: 'Logitech', category_id: 'cat-perifericos', unit: 'un', price: 459.9, stock: 30, status: 'active', created_at: '2025-01-01T00:00:00Z', image_url: null },
  { id: 'prod-12', sku: 'TM-HX-CL2', code: null, name: 'Headset Gamer HyperX Cloud II', description: 'Virtual 7.1 surround, drivers 53mm, memória espuma', brand: 'HyperX', category_id: 'cat-perifericos', unit: 'un', price: 499.9, stock: 20, status: 'active', created_at: '2025-01-01T00:00:00Z', image_url: null },
  // Redes
  { id: 'prod-13', sku: 'TM-TP-AX73', code: null, name: 'Roteador TP-Link Archer AX73', description: 'Wi-Fi 6, AX5400, 6 antenas, 4 portas gigabit', brand: 'TP-Link', category_id: 'cat-redes', unit: 'un', price: 699.0, stock: 22, status: 'active', created_at: '2025-01-01T00:00:00Z', image_url: null },
  { id: 'prod-14', sku: 'TM-TP-SG108E', code: null, name: 'Switch Gerenciável TP-Link TL-SG108E', description: '8 portas gigabit, QoS, VLAN, montável', brand: 'TP-Link', category_id: 'cat-redes', unit: 'un', price: 349.9, stock: 28, status: 'active', created_at: '2025-01-01T00:00:00Z', image_url: null },
  { id: 'prod-15', sku: 'TM-CAT6-305', code: null, name: 'Cabo de Rede Cat6 Caixa 305m', description: 'Cat6 UTP, 305m, 4 pares, 550MHz', brand: 'Furukawa', category_id: 'cat-redes', unit: 'cx', price: 449.0, stock: 12, status: 'active', created_at: '2025-01-01T00:00:00Z', image_url: null },
  { id: 'prod-16', sku: 'TM-UB-U6L', code: null, name: 'Access Point Ubiquiti UniFi U6 Lite', description: 'Wi-Fi 6, 2x2 MIMO, PoE, gerenciável', brand: 'Ubiquiti', category_id: 'cat-redes', unit: 'un', price: 899.0, stock: 16, status: 'active', created_at: '2025-01-01T00:00:00Z', image_url: null },
  // Acessórios
  { id: 'prod-17', sku: 'TM-SUP-NB', code: null, name: 'Suporte Ergonômico para Notebook', description: 'Alumínio, ajuste de altura e ângulo', brand: 'Multilaser', category_id: 'cat-acessorios', unit: 'un', price: 129.9, stock: 55, status: 'active', created_at: '2025-01-01T00:00:00Z', image_url: null },
  { id: 'prod-18', sku: 'TM-BS-HUB7', code: null, name: 'Hub USB-C 7 em 1 Baseus', description: 'HDMI 4K, USB 3.0, PD 100W, SD/TF', brand: 'Baseus', category_id: 'cat-acessorios', unit: 'un', price: 199.9, stock: 38, status: 'active', created_at: '2025-01-01T00:00:00Z', image_url: null },
  { id: 'prod-19', sku: 'TM-RD-MPXL', code: null, name: 'Mousepad Gamer XL Redragon', description: '900x400mm, tecido, base antiderrapante', brand: 'Redragon', category_id: 'cat-acessorios', unit: 'un', price: 89.9, stock: 60, status: 'active', created_at: '2025-01-01T00:00:00Z', image_url: null },
  { id: 'prod-20', sku: 'TM-NHS-1400', code: null, name: 'No-break NHS Laser 1400VA', description: '1400VA/840W, 8 tomadas, autonomia até 30min', brand: 'NHS', category_id: 'cat-acessorios', unit: 'un', price: 799.9, stock: 18, status: 'active', created_at: '2025-01-01T00:00:00Z', image_url: null },
];

// ─────────────────────────────────────────────
// CUSTOMERS (8 clientes compradores)
// ─────────────────────────────────────────────
export const mockCustomers: Customer[] = [
  { id: 'cust-1', name: 'TechnoOffice Ltda', email: 'compras@technooffice.com.br', phone: '(11) 3456-7890', document: '12.345.678/0001-90', status: 'active', created_at: '2025-01-01T00:00:00Z' },
  { id: 'cust-2', name: 'Distribuidora Norte Sul', email: 'pedidos@nortesul.com.br', phone: '(21) 9876-5432', document: '98.765.432/0001-10', status: 'active', created_at: '2025-01-01T00:00:00Z' },
  { id: 'cust-3', name: 'MegaComp Informática', email: 'compras@megacomp.com.br', phone: '(31) 3300-4455', document: '11.222.333/0001-44', status: 'active', created_at: '2025-01-01T00:00:00Z' },
  { id: 'cust-4', name: 'InfoSul Tecnologia', email: 'ti@infosul.com.br', phone: '(51) 3344-5566', document: '55.444.333/0001-22', status: 'active', created_at: '2025-01-01T00:00:00Z' },
  { id: 'cust-5', name: 'Digital Store Curitiba', email: 'contato@digitalstore.com.br', phone: '(41) 3300-2211', document: '77.888.999/0001-33', status: 'active', created_at: '2025-01-01T00:00:00Z' },
  { id: 'cust-6', name: 'Techpoint Salvador', email: 'vendas@techpoint.com.br', phone: '(71) 3311-2233', document: '33.222.111/0001-55', status: 'inactive', created_at: '2025-01-01T00:00:00Z' },
  { id: 'cust-7', name: 'Conecta Tech Recife', email: 'pedidos@conectatech.com.br', phone: '(81) 3233-4455', document: '44.555.666/0001-77', status: 'active', created_at: '2025-01-01T00:00:00Z' },
  { id: 'cust-8', name: 'Prime Networks Fortaleza', email: 'compras@primenetworks.com.br', phone: '(85) 3322-1100', document: '88.999.000/0001-66', status: 'active', created_at: '2025-01-01T00:00:00Z' },
];

// Helper: nome do cliente pelo id (usado em export.ts e CompanyPages.tsx)
export function customerName(id: string): string {
  return mockCustomers.find((c) => c.id === id)?.name ?? id;
}

// ─────────────────────────────────────────────
// ORDERS (12 pedidos com vários status)
// ─────────────────────────────────────────────
export const mockOrders: Order[] = [
  {
    id: 'order-001', number: '0001', customer_id: 'cust-1', status: 'submitted', total: 7398.2, notes: null, created_at: '2025-01-15T08:30:00Z',
    items: [
      { id: 'oi-1', product_id: 'prod-1', quantity: 5, unit_price: 1299.9, subtotal: 6499.5 },
      { id: 'oi-2', product_id: 'prod-9', quantity: 3, unit_price: 299.9, subtotal: 899.7 },
    ],
    status_history: [{ id: 'sh-1', from_status: null, to_status: 'submitted', note: null, created_at: '2025-01-15T08:30:00Z' }],
  },
  {
    id: 'order-002', number: '0002', customer_id: 'cust-2', status: 'approved', total: 7990.0, notes: null, created_at: '2025-01-14T10:00:00Z',
    items: [{ id: 'oi-3', product_id: 'prod-6', quantity: 10, unit_price: 799.0, subtotal: 7990.0 }],
    status_history: [
      { id: 'sh-2', from_status: null, to_status: 'submitted', note: null, created_at: '2025-01-14T10:00:00Z' },
      { id: 'sh-3', from_status: 'submitted', to_status: 'approved', note: 'Crédito aprovado', created_at: '2025-01-14T14:00:00Z' },
    ],
  },
  {
    id: 'order-003', number: '0003', customer_id: 'cust-3', status: 'shipped', total: 7677.6, notes: null, created_at: '2025-01-10T09:00:00Z',
    items: [
      { id: 'oi-4', product_id: 'prod-5', quantity: 2, unit_price: 3299.0, subtotal: 6598.0 },
      { id: 'oi-5', product_id: 'prod-7', quantity: 4, unit_price: 269.9, subtotal: 1079.6 },
    ],
    status_history: [
      { id: 'sh-4', from_status: null, to_status: 'submitted', note: null, created_at: '2025-01-10T09:00:00Z' },
      { id: 'sh-5', from_status: 'submitted', to_status: 'approved', note: null, created_at: '2025-01-11T08:00:00Z' },
      { id: 'sh-6', from_status: 'approved', to_status: 'shipped', note: 'Despachado', created_at: '2025-01-12T11:00:00Z' },
    ],
  },
  {
    id: 'order-004', number: '0004', customer_id: 'cust-4', status: 'cancelled', total: 2097.0, notes: 'Pedido duplicado pelo cliente', created_at: '2025-01-08T13:00:00Z',
    items: [{ id: 'oi-6', product_id: 'prod-13', quantity: 3, unit_price: 699.0, subtotal: 2097.0 }],
    status_history: [
      { id: 'sh-7', from_status: null, to_status: 'submitted', note: null, created_at: '2025-01-08T13:00:00Z' },
      { id: 'sh-8', from_status: 'submitted', to_status: 'cancelled', note: 'Pedido duplicado pelo cliente', created_at: '2025-01-09T08:00:00Z' },
    ],
  },
  {
    id: 'order-005', number: '0005', customer_id: 'cust-5', status: 'submitted', total: 6698.7, notes: null, created_at: '2025-01-16T07:45:00Z',
    items: [
      { id: 'oi-7', product_id: 'prod-10', quantity: 8, unit_price: 549.9, subtotal: 4399.2 },
      { id: 'oi-8', product_id: 'prod-11', quantity: 5, unit_price: 459.9, subtotal: 2299.5 },
    ],
    status_history: [{ id: 'sh-9', from_status: null, to_status: 'submitted', note: null, created_at: '2025-01-16T07:45:00Z' }],
  },
  {
    id: 'order-006', number: '0006', customer_id: 'cust-7', status: 'approved', total: 2996.4, notes: null, created_at: '2025-01-13T11:30:00Z',
    items: [
      { id: 'oi-9', product_id: 'prod-14', quantity: 6, unit_price: 349.9, subtotal: 2099.4 },
      { id: 'oi-10', product_id: 'prod-15', quantity: 2, unit_price: 449.0, subtotal: 898.0 },
    ],
    status_history: [
      { id: 'sh-10', from_status: null, to_status: 'submitted', note: null, created_at: '2025-01-13T11:30:00Z' },
      { id: 'sh-11', from_status: 'submitted', to_status: 'approved', note: 'Aprovado', created_at: '2025-01-13T15:00:00Z' },
    ],
  },
  {
    id: 'order-007', number: '0007', customer_id: 'cust-8', status: 'shipped', total: 3596.0, notes: null, created_at: '2025-01-07T09:00:00Z',
    items: [{ id: 'oi-11', product_id: 'prod-16', quantity: 4, unit_price: 899.0, subtotal: 3596.0 }],
    status_history: [
      { id: 'sh-12', from_status: null, to_status: 'submitted', note: null, created_at: '2025-01-07T09:00:00Z' },
      { id: 'sh-13', from_status: 'submitted', to_status: 'approved', note: null, created_at: '2025-01-08T08:00:00Z' },
      { id: 'sh-14', from_status: 'approved', to_status: 'shipped', note: 'Enviado', created_at: '2025-01-11T14:00:00Z' },
    ],
  },
  {
    id: 'order-008', number: '0008', customer_id: 'cust-1', status: 'completed', total: 2599.0, notes: null, created_at: '2025-01-05T09:00:00Z',
    items: [{ id: 'oi-12', product_id: 'prod-2', quantity: 1, unit_price: 2599.0, subtotal: 2599.0 }],
    status_history: [
      { id: 'sh-15', from_status: null, to_status: 'submitted', note: null, created_at: '2025-01-05T09:00:00Z' },
      { id: 'sh-16', from_status: 'submitted', to_status: 'approved', note: null, created_at: '2025-01-05T11:00:00Z' },
      { id: 'sh-17', from_status: 'approved', to_status: 'shipped', note: null, created_at: '2025-01-06T08:00:00Z' },
      { id: 'sh-18', from_status: 'shipped', to_status: 'completed', note: 'Entregue', created_at: '2025-01-08T10:00:00Z' },
    ],
  },
  {
    id: 'order-009', number: '0009', customer_id: 'cust-6', status: 'submitted', total: 2199.6, notes: null, created_at: '2025-01-16T10:00:00Z',
    items: [{ id: 'oi-13', product_id: 'prod-8', quantity: 6, unit_price: 319.9, subtotal: 1919.4 }],
    status_history: [{ id: 'sh-19', from_status: null, to_status: 'submitted', note: null, created_at: '2025-01-16T10:00:00Z' }],
  },
  {
    id: 'order-010', number: '0010', customer_id: 'cust-3', status: 'cancelled', total: 3799.8, notes: 'Produto fora de estoque', created_at: '2025-01-03T14:00:00Z',
    items: [{ id: 'oi-14', product_id: 'prod-3', quantity: 2, unit_price: 1899.9, subtotal: 3799.8 }],
    status_history: [
      { id: 'sh-20', from_status: null, to_status: 'submitted', note: null, created_at: '2025-01-03T14:00:00Z' },
      { id: 'sh-21', from_status: 'submitted', to_status: 'cancelled', note: 'Produto fora de estoque', created_at: '2025-01-04T09:00:00Z' },
    ],
  },
  {
    id: 'order-011', number: '0011', customer_id: 'cust-2', status: 'processing', total: 4490.0, notes: null, created_at: '2025-01-15T13:00:00Z',
    items: [{ id: 'oi-15', product_id: 'prod-5', quantity: 1, unit_price: 3299.0, subtotal: 3299.0 }],
    status_history: [
      { id: 'sh-22', from_status: null, to_status: 'submitted', note: null, created_at: '2025-01-15T13:00:00Z' },
      { id: 'sh-23', from_status: 'submitted', to_status: 'processing', note: 'Em processamento', created_at: '2025-01-16T09:00:00Z' },
    ],
  },
  {
    id: 'order-012', number: '0012', customer_id: 'cust-8', status: 'invoiced', total: 1799.8, notes: null, created_at: '2025-01-14T08:00:00Z',
    items: [{ id: 'oi-16', product_id: 'prod-20', quantity: 2, unit_price: 799.9, subtotal: 1599.8 }],
    status_history: [
      { id: 'sh-24', from_status: null, to_status: 'submitted', note: null, created_at: '2025-01-14T08:00:00Z' },
      { id: 'sh-25', from_status: 'submitted', to_status: 'approved', note: null, created_at: '2025-01-14T10:00:00Z' },
      { id: 'sh-26', from_status: 'approved', to_status: 'invoiced', note: 'Faturado', created_at: '2025-01-15T09:00:00Z' },
    ],
  },
];

// ─────────────────────────────────────────────
// TICKETS (sem mensagens — vêm do TicketDetail via GET /tickets/{id})
// ─────────────────────────────────────────────
export const mockTickets: Ticket[] = [
  { id: 'ticket-1', number: 'T1001', title: 'Pedido não aprovado', description: 'Aguardo aprovação do pedido #order-001', category: 'comercial', priority: 'high', status: 'under_review', customer_id: 'cust-1', assignee_id: 'user-2', created_at: '2025-01-15T09:00:00Z', updated_at: '2025-01-15T11:00:00Z' },
  { id: 'ticket-2', number: 'T1002', title: 'Produto com embalagem danificada', description: 'Recebemos produto com embalagem danificada e precisamos de troca', category: 'garantia', priority: 'urgent', status: 'open', customer_id: 'cust-1', assignee_id: 'user-2', created_at: '2025-01-12T08:00:00Z', updated_at: '2025-01-12T09:00:00Z' },
  { id: 'ticket-3', number: 'T1003', title: 'Erro na nota fiscal', description: 'CNPJ incorreto na nota fiscal do pedido #order-003', category: 'financeiro', priority: 'medium', status: 'resolved', customer_id: 'cust-3', assignee_id: 'user-4', created_at: '2025-01-11T14:00:00Z', updated_at: '2025-01-11T16:00:00Z' },
  { id: 'ticket-4', number: 'T1004', title: 'Solicitação de tabela de preços atualizada', description: 'Precisamos da tabela de preços atualizada para o trimestre', category: 'comercial', priority: 'low', status: 'closed', customer_id: 'cust-4', assignee_id: 'user-2', created_at: '2025-01-05T10:00:00Z', updated_at: '2025-01-05T14:00:00Z' },
  { id: 'ticket-5', number: 'T1005', title: 'Atraso na entrega', description: 'Pedido #order-007 com 3 dias de atraso', category: 'suporte', priority: 'high', status: 'under_review', customer_id: 'cust-8', assignee_id: 'user-3', created_at: '2025-01-14T08:00:00Z', updated_at: '2025-01-14T09:00:00Z' },
  { id: 'ticket-6', number: 'T1006', title: 'Novo cadastro de produto', description: 'Solicito cadastro de novo produto para próxima compra', category: 'comercial', priority: 'low', status: 'open', customer_id: 'cust-7', assignee_id: null, created_at: '2025-01-16T10:00:00Z', updated_at: '2025-01-16T10:00:00Z' },
];

// ─────────────────────────────────────────────
// FINANCIAL (contas)
// ─────────────────────────────────────────────
export const mockFinancialAccounts: FinancialAccount[] = [
  { id: 'fin-1', customer_id: 'cust-3', document: 'NF-0003', value: 7677.6, due_date: '2025-01-25T00:00:00Z', status: 'paid', paid_at: '2025-01-24T00:00:00Z', order_id: 'order-003', external_id: null },
  { id: 'fin-2', customer_id: 'cust-1', document: 'NF-0001', value: 7398.2, due_date: '2025-02-05T00:00:00Z', status: 'open', paid_at: null, order_id: 'order-001', external_id: null },
  { id: 'fin-3', customer_id: 'cust-8', document: 'NF-0007', value: 3596.0, due_date: '2025-01-20T00:00:00Z', status: 'overdue', paid_at: null, order_id: 'order-007', external_id: null },
  { id: 'fin-4', customer_id: 'cust-2', document: 'NF-0002', value: 7990.0, due_date: '2025-02-01T00:00:00Z', status: 'open', paid_at: null, order_id: 'order-002', external_id: null },
  { id: 'fin-5', customer_id: 'cust-4', document: 'NF-0004', value: 2097.0, due_date: '2025-01-15T00:00:00Z', status: 'overdue', paid_at: null, order_id: 'order-004', external_id: null },
  { id: 'fin-6', customer_id: 'cust-1', document: 'NF-0008', value: 2599.0, due_date: '2025-01-20T00:00:00Z', status: 'paid', paid_at: '2025-01-18T00:00:00Z', order_id: 'order-008', external_id: null },
];

// ─────────────────────────────────────────────
// TEAM (usuários da empresa — UserRead)
// ─────────────────────────────────────────────
export const mockTeamMembers: UserRead[] = [
  { id: 'user-1', email: 'cliente@techmax.com.br', full_name: 'João Silva', phone: null, status: 'active', roles: ['cliente'] },
  { id: 'user-2', email: 'admin@techmax.com.br', full_name: 'Maria Santos', phone: '(11) 90000-0001', status: 'active', roles: ['admin'] },
  { id: 'user-3', email: 'vendas@techmax.com.br', full_name: 'Carlos Oliveira', phone: '(11) 90000-0002', status: 'active', roles: ['vendedor'] },
  { id: 'user-4', email: 'financeiro@techmax.com.br', full_name: 'Ana Lima', phone: '(11) 90000-0003', status: 'active', roles: ['financeiro'] },
  { id: 'user-5', email: 'suporte@techmax.com.br', full_name: 'Pedro Costa', phone: '(11) 90000-0004', status: 'active', roles: ['suporte'] },
];

// ─────────────────────────────────────────────
// CHAT (salas e mensagens)
// ─────────────────────────────────────────────
export const mockChatRooms: ChatRoom[] = [
  { id: 'conv-1', customer_id: 'cust-1', sector: 'support', status: 'open', created_at: '2025-01-17T08:00:00Z' },
  { id: 'conv-2', customer_id: 'cust-1', sector: 'financial', status: 'open', created_at: '2025-01-16T14:00:00Z' },
  { id: 'conv-3', customer_id: 'cust-3', sector: 'commercial', status: 'open', created_at: '2025-01-18T09:00:00Z' },
  { id: 'conv-4', customer_id: 'cust-3', sector: 'support', status: 'closed', created_at: '2025-01-10T09:00:00Z' },
];

export const mockChatMessages: ChatMessage[] = [
  { id: 'cm-1', room_id: 'conv-1', sender_type: 'customer', sender_user_id: null, sender_customer_id: 'cust-1', content: 'Olá! Gostaria de saber o prazo de entrega para São Paulo.', read_at: null, attachment_file_id: null, created_at: '2025-01-17T08:00:00Z' },
  { id: 'cm-2', room_id: 'conv-1', sender_type: 'user', sender_user_id: 'user-3', sender_customer_id: null, content: 'Olá João! Para São Paulo capital, o prazo é de 2 a 3 dias úteis após aprovação.', read_at: null, attachment_file_id: null, created_at: '2025-01-17T08:02:00Z' },
  { id: 'cm-3', room_id: 'conv-2', sender_type: 'customer', sender_user_id: null, sender_customer_id: 'cust-1', content: 'Boa tarde! Preciso negociar o prazo de pagamento da fatura #fin-5.', read_at: null, attachment_file_id: null, created_at: '2025-01-16T14:00:00Z' },
  { id: 'cm-4', room_id: 'conv-3', sender_type: 'customer', sender_user_id: null, sender_customer_id: 'cust-3', content: 'Olá! Vou preparar a cotação com desconto de volume e enviar ainda hoje.', read_at: null, attachment_file_id: null, created_at: '2025-01-18T09:15:00Z' },
];