/**
 * Constantes de permissão e rotas (Bloco 0).
 * Espelha o catálogo central de permissões do backend (app/core/permissions.py).
 * Apenas códigos públicos de RBAC — nenhum dado sensível aqui.
 */

export const PERMISSIONS = {
  COMPANY_READ: 'companies:read',
  COMPANY_MANAGE: 'companies:manage',
  USER_READ: 'users:read',
  USER_CREATE: 'users:create',
  USER_UPDATE: 'users:update',
  USER_DELETE: 'users:delete',
  CUSTOMER_READ: 'customers:read',
  CUSTOMER_CREATE: 'customers:create',
  CUSTOMER_UPDATE: 'customers:update',
  PRODUCT_READ: 'products:read',
  PRODUCT_CREATE: 'products:create',
  PRODUCT_UPDATE: 'products:update',
  PRODUCT_DELETE: 'products:delete',
  CATALOG_READ: 'catalogs:read',
  CATALOG_MANAGE: 'catalogs:manage',
  CART_MANAGE: 'cart:manage',
  ORDER_READ: 'orders:read',
  ORDER_CREATE: 'orders:create',
  ORDER_UPDATE: 'orders:update',
  ORDER_MANAGE: 'orders:manage',
  TICKET_READ: 'tickets:read',
  TICKET_CREATE: 'tickets:create',
  TICKET_UPDATE: 'tickets:update',
  CHAT_READ: 'chat:read',
  CHAT_SEND: 'chat:send',
  FINANCIAL_READ: 'financial:read',
  FILE_UPLOAD: 'files:upload',
  FILE_READ: 'files:read',
  NOTIFICATION_READ: 'notifications:read',
  ADMIN_MANAGE: 'admin:manage',
  // ✅ Billing (cobranças/assinaturas Asaas)
  BILLING_READ: 'billing:read',      // admin da empresa vê as cobranças dela
  BILLING_MANAGE: 'billing:manage',  // superadmin cria/gerencia cobranças
  INTEGRATION_READ: 'integrations:read',
  INTEGRATION_MANAGE: 'integrations:manage',
  INTEGRATION_RUN: 'integrations:run',
  INTEGRATION_SECRETS: 'integrations:secrets',
  SUPER_ADMIN: 'super_admin:all',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export const PERMISSION_GROUPS: Record<string, PermissionCode[]> = {
  products: [
    PERMISSIONS.PRODUCT_READ, PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_UPDATE, PERMISSIONS.PRODUCT_DELETE,
    PERMISSIONS.CATALOG_READ, PERMISSIONS.CATALOG_MANAGE,
  ],
  orders: [
    PERMISSIONS.ORDER_READ, PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.ORDER_UPDATE, PERMISSIONS.ORDER_MANAGE,
  ],
  tickets: [PERMISSIONS.TICKET_READ, PERMISSIONS.TICKET_CREATE, PERMISSIONS.TICKET_UPDATE],
  financial: [PERMISSIONS.FINANCIAL_READ],
  billing: [PERMISSIONS.BILLING_READ, PERMISSIONS.BILLING_MANAGE],
  integrations: [
    PERMISSIONS.INTEGRATION_READ, PERMISSIONS.INTEGRATION_MANAGE,
    PERMISSIONS.INTEGRATION_RUN, PERMISSIONS.INTEGRATION_SECRETS,
  ],
  admin: [PERMISSIONS.ADMIN_MANAGE],
};

/** Rota padrão pós-login conforme o perfil do usuário (UserInfo). */
export function defaultPathForUser(user: {
  is_super_admin?: boolean;
  customer_id?: string | null;
  tenant_id?: string | null;
}): string {
  if (user.is_super_admin) return '/superadmin';
  if (user.customer_id !== null && user.customer_id !== undefined) return '/loja';
  if (user.tenant_id !== null && user.tenant_id !== undefined) return '/empresa';
  return '/login';
}

export const CLIENT_ROUTES = ['/loja', '/carrinho', '/pedidos', '/tickets', '/chat', '/financeiro'] as const;
export const COMPANY_ROUTES = [
  '/empresa', '/empresa/catalogo', '/empresa/clientes', '/empresa/pedidos',
  '/empresa/equipe', '/empresa/tickets', '/empresa/chat', '/empresa/pagamentos',
] as const;
export const SUPER_ADMIN_ROUTES = ['/superadmin', '/superadmin/pagamentos'] as const;
export const PUBLIC_ROUTES = ['/login'] as const;
