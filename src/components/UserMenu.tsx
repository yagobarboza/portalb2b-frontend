import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Settings } from 'lucide-react';
import { useAuth, resolveProfile } from '../context/AuthContext';
import { cn } from '../lib/utils';

/** Caminho das configurações por perfil — cada um dentro do seu próprio layout. */
const SETTINGS_PATH: Record<string, string> = {
  cliente: '/perfil',
  empresa: '/empresa/perfil',
  superadmin: '/superadmin/perfil',
};

interface UserMenuProps {
  /**
   * 'compact' → header (avatar; dropdown abre para BAIXO).
   * 'full'    → rodapé de sidebar (avatar + nome; dropdown abre para CIMA).
   */
  variant?: 'compact' | 'full';
  /** Variante compact: exibe o nome ao lado do avatar (em telas lg+). */
  showName?: boolean;
  /** Callback antes de navegar (ex.: fechar o drawer mobile). */
  onNavigate?: () => void;
  className?: string;
}

/**
 * Menu do usuário logado (avatar → dropdown).
 *
 * Acesso às configurações do perfil e logout. O destino das configurações é
 * resolvido pelo PERFIL do usuário (cliente/empresa/superadmin), mantendo a
 * rota dentro do layout correspondente (sidebar preservada).
 */
export default function UserMenu({
  variant = 'compact',
  showName = false,
  onNavigate,
  className,
}: UserMenuProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const displayName = user?.full_name?.trim() || 'Usuário';
  const email = user?.email ?? '';
  const initial = displayName.charAt(0).toUpperCase();
  const isFull = variant === 'full';

  // ✅ Destino das configurações conforme o perfil logado.
  const settingsPath = SETTINGS_PATH[resolveProfile(user) ?? 'cliente'] ?? '/perfil';

  // Fecha ao clicar fora / pressionar ESC.
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const go = (path: string) => {
    setOpen(false);
    onNavigate?.();
    navigate(path);
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setOpen(false);
    try {
      // Revoga a sessão no backend e limpa os cookies (idempotente).
      await logout();
    } finally {
      onNavigate?.();
      navigate('/login');
    }
  };

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu do usuário"
        className={cn(
          'flex items-center gap-2 rounded-md transition-colors hover:bg-muted',
          isFull ? 'w-full px-3 py-2' : 'p-1',
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {initial}
        </span>

        {isFull ? (
          <>
            <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">
              {displayName}
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                open && 'rotate-180',
              )}
            />
          </>
        ) : showName ? (
          <>
            <span className="hidden max-w-[12rem] truncate text-sm font-medium lg:block">
              {displayName}
            </span>
            <ChevronDown className="hidden h-4 w-4 shrink-0 text-muted-foreground lg:block" />
          </>
        ) : null}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-50 w-56 overflow-hidden rounded-lg border bg-background p-1 shadow-md',
            isFull ? 'bottom-full left-0 mb-1' : 'right-0 top-full mt-1',
          )}
        >
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-medium">{displayName}</p>
            {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
          </div>

          <div className="my-1 border-t" />

          <button
            type="button"
            role="menuitem"
            onClick={() => go(settingsPath)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
          >
            <Settings className="h-4 w-4" />
            Configurações do perfil
          </button>

          <div className="my-1 border-t" />

          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {loggingOut ? 'Saindo…' : 'Sair'}
          </button>
        </div>
      )}
    </div>
  );
}