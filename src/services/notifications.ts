import { api } from '@/lib/api';
import type { Notification, NotificationPage, UnreadCount } from '@/types/api';

export async function fetchNotifications(params?: {
  unread_only?: boolean;
  page?: number;
  page_size?: number;
}): Promise<NotificationPage> {
  const qs = new URLSearchParams();
  if (params?.unread_only) qs.set('unread_only', 'true');
  qs.set('page', String(params?.page ?? 1));
  qs.set('page_size', String(params?.page_size ?? 20));
  return api.get<NotificationPage>(`/notifications?${qs.toString()}`);
}

export function fetchUnreadCount(): Promise<UnreadCount> {
  return api.get<UnreadCount>('/notifications/unread-count');
}

export function markNotificationRead(id: string): Promise<Notification> {
  return api.post<Notification>(`/notifications/${id}/read`);
}

export function markAllNotificationsRead(): Promise<UnreadCount> {
  return api.post<UnreadCount>('/notifications/read-all');
}