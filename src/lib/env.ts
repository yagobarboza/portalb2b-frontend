/**
 * Variáveis de ambiente (Bloco 0).
 * Fonte da verdade: arquivo `.env` (VITE_API_URL).
 *
 * SEGURANÇA:
 * - Nenhum segredo deve existir aqui. Tudo que começa com VITE_ é
 *   público no bundle do navegador.
 * - Em produção, o padrão `/api/v1` preserva cookies HttpOnly, WebSocket e
 *   domínios white-label na mesma origem do navegador.
 */

const rawApiUrl = import.meta.env.VITE_API_URL as string | undefined;

function sanitizeBaseUrl(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/+$/, '');
}

/** Base da API. Prefira caminho relativo em produção. */
export const API_BASE_URL: string = (() => {
  const value = sanitizeBaseUrl(rawApiUrl);
  return value.length > 0 ? value : '/api/v1';
})();

function browserOrigin(): string {
  return typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
}

/** Converte a base relativa em URL pública absoluta para copiar webhooks. */
export function absoluteApiUrl(path = ''): string {
  const base = new URL(
    API_BASE_URL.startsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`,
    browserOrigin(),
  ).toString().replace(/\/+$/, '');
  const suffix = path ? `/${path.replace(/^\/+/, '')}` : '';
  return `${base}${suffix}`;
}

/** Origem do backend (target do proxy Vite e base do WebSocket). */
export const API_ORIGIN: string = (() => {
  try {
    return new URL(API_BASE_URL, browserOrigin()).origin;
  } catch {
    return browserOrigin();
  }
})();

/** URL base do WebSocket (derivada da origem da API). */
export const WS_BASE_URL: string = API_ORIGIN.replace(/^http/, 'ws');

/** Intervalo (ms) de polling do contador de notificações (Bloco 10). */
export const NOTIFICATION_POLL_INTERVAL_MS: number = 30000;

/** Tempo (ms) de bloqueio de interface em caso de 429 Too Many Requests. */
export const RATE_LIMIT_LOCK_MS: number = 60000;

/** Chave usada para persistir a sessão local (fallback não-HttpOnly). */
export const SESSION_STORAGE_KEY: string = 'nydb2b_session';
