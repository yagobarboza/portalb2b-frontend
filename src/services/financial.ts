import { api } from '@/lib/api';
import type { FinancialAccountDetail, FinancialAccountPage, FinancialAccountStatus } from '@/types/api';

const STATUS_PATHS: Record<FinancialAccountStatus, string> = {
  open: 'open',
  paid: 'paid',
  overdue: 'overdue',
};

export async function fetchFinancialAccounts(
  status: FinancialAccountStatus,
  params?: { page?: number; page_size?: number },
): Promise<FinancialAccountPage> {
  const qs = new URLSearchParams();
  qs.set('page', String(params?.page ?? 1));
  qs.set('page_size', String(params?.page_size ?? 20));
  return api.get<FinancialAccountPage>(`/financial/accounts/${STATUS_PATHS[status]}?${qs.toString()}`);
}

export function fetchFinancialAccountDetail(id: string): Promise<FinancialAccountDetail> {
  return api.get<FinancialAccountDetail>(`/financial/accounts/${id}`);
}