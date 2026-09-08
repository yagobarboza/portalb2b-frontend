import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Bell, BellRing, CheckCheck, Package, TicketIcon, MessageCircle,
  CreditCard, Info, Loader2, type LucideIcon,
} from 'lucide-react';
import {
  fetchNotifications, fetchUnreadCount, markNotificationRead, markAllNotificationsRead,
} from '@/services/notifications';
import type { Notification, NotificationType } from '@/types/api';
import { cn } from '@/lib/utils';

const meta: Record<NotificationType, { icon: LucideIcon; className: string }> = {
  order: { icon: Package, className: 'bg-blue-100 text-blue-600' },
  ticket: { icon: TicketIcon, className: 'bg-amber-100 text-amber-600' },
  chat: { icon: MessageCircle, className: 'bg-emerald-100 text-emerald-600' },
  financial: { icon: CreditCard, className: 'bg-violet-100 text-violet-600' },
  system: { icon: Info, className: 'bg-gray-100 text-gray-600' },
};

const POLL_INTERVAL_MS = 30000;

export default function NotificationsBell() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const isClient = Boolean(user?.customer_id);
  const isSuper = Boolean(user?.is_super_admin);

  const targetRoute = (type: NotificationType): string => {
    if (isSuper) return '/superadmin';
    const base = isClient ? '' : '/empresa';
    switch (type) {
      case 'order': return isClient ? '/pedidos' : `${base}/pedidos`;
      case 'ticket': return isClient ? '/tickets' : `${base}/tickets`;
      case 'chat': return isClient ? '/chat' : `${base}/chat`;
      case 'financial': return isClient ? '/financeiro' : `${base}`;
      default: return isClient ? '/loja' : `${base}`;
    }
  };

  // Polling do contador de não lidas (30s)
  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      try {
        const d = await fetchUnreadCount();
        if (active) setUnread(d.unread);
      } catch { /* 401 é tratado pelo interceptor */ }
    };
    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => { active = false; clearInterval(id); };
  }, [user]);

  const refreshList = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchNotifications({ page_size: 20 });
      setItems(d.items);
      setUnread(d.items.filter((i) => !i.is_read).length);
    } catch { /* tratado pelo interceptor */ }
    finally { setLoading(false); }
  }, []);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) refreshList();
  };

  const handleClick = async (n: Notification) => {
    if (!n.is_read) {
      try {
        await markNotificationRead(n.id);
        setUnread((u) => Math.max(0, u - 1));
        setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, is_read: true } : i)));
      } catch { /* tratado pelo interceptor */ }
    }
    setOpen(false);
    navigate(targetRoute(n.type));
  };

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      setUnread(0);
      setItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
    } catch { /* tratado pelo interceptor */ }
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          {unread > 0 ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] justify-center">
              {unread > 99 ? '99+' : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold">Notificações</p>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleMarkAll}>
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <Separator />
        <ScrollArea className="h-80">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">Nenhuma notificação.</p>
            </div>
          ) : (
            <div className="p-1">
              {items.map((n) => {
                const { icon: Icon, className } = meta[n.type] ?? meta.system;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-accent',
                      !n.is_read && 'bg-muted/50',
                    )}
                  >
                    <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', className)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{n.title}</span>
                        {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      </span>
                      {n.body && (
                        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{n.body}</span>
                      )}
                      <span className="mt-1 block text-[11px] text-muted-foreground/70">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}