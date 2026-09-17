import { api } from '@/lib/api';
import type {
  BillingCharge,
  BillingChargeCreateInput,
  BillingChargePage,
  BillingStatus,
  BillingSubscriptionCreateInput,
} from '@/types/api';

/** Lista as cobranças do SEU tenant (admin da empresa) com filtros. */
export async function fetchMyBillingCharges(params?: {
  status?: BillingStatus;
  type?: string;
  page?: number;
  page_size?: number;
}): Promise<BillingChargePage> {
  const qs = new URLSearchParams();
  qs.set('page', String(params?.page ?? 1));
  qs.set('page_size', String(params?.page_size ?? 20));
  if (params?.status) qs.set('status', params.status);
  if (params?.type) qs.set('type', params.type);
  return api.get<BillingChargePage>(`/billing/charges?${qs.toString()}`);
}

/** Obtém a URL de pagamento hospedada do Asaas (Fatura) para a cobrança. */
export async function fetchBillingPaymentUrl(chargeId: string): Promise<{ checkout_url: string }> {
  return api.get<{ checkout_url: string }>(`/billing/charges/${chargeId}/pay`);
}

// ────────────────────────── Super Admin ────────────────────────────────────
/** Lista as cobranças de TODAS as empresas (situação financeira global). */
export async function fetchAllBillingCharges(params?: {
  status?: BillingStatus;
  type?: string;
  search?: string;
  page?: number;
  page_size?: number;
}): Promise<BillingChargePage> {
  const qs = new URLSearchParams();
  qs.set('page', String(params?.page ?? 1));
  qs.set('page_size', String(params?.page_size ?? 20));
  if (params?.status) qs.set('status', params.status);
  if (params?.type) qs.set('type', params.type);
  if (params?.search) qs.set('search', params.search);
  return api.get<BillingChargePage>(`/billing/charges/all?${qs.toString()}`);
}

/** Cria cobrança AVULSA identificando a empresa pelo CNPJ. */
export function createBillingCharge(
  companyCnpj: string,
  body: BillingChargeCreateInput,
): Promise<BillingCharge> {
  const cnpj = companyCnpj.replace(/\D/g, '');
  return api.post<BillingCharge>('/billing/charges', body, { params: { company_cnpj: cnpj } });
}

/** Cria ASSINATURA MENSAL identificando a empresa pelo CNPJ. */
export function createBillingSubscription(
  companyCnpj: string,
  body: BillingSubscriptionCreateInput,
): Promise<BillingCharge> {
  const cnpj = companyCnpj.replace(/\D/g, '');
  return api.post<BillingCharge>('/billing/subscriptions', body, { params: { company_cnpj: cnpj } });
}