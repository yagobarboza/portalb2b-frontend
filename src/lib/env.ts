/**
 * Variáveis de ambiente (Bloco 0).
 * Fonte da verdade: arquivo `.env` (VITE_API_URL).
 *
 * SEGURANÇA:
 * - Nenhum segredo deve existir aqui. Tudo que começa com VITE_ é
 *   público no bundle do navegador.
 * - Em produção, a ausência de VITE_API_URL aborta o build (fail-fast),
 *   evitando fallback silencioso para ambiente errado.
 */

const rawApiUrl = import.meta.env.VITE_API_URL as string | undefined;

function sanitizeBaseUrl(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/+$/, '');
}

/** Base da API. Em produção, VITE_API_URL é obrigatória. */
export const API_BASE_URL: string = (() => {
  const value = sanitizeBaseUrl(rawApiUrl);

  if (import.meta.env.PROD && value.length === 0) {
    // Fail-fast: nunca publicar apontando para ambiente errado.
    throw new Error(
      'VITE_API_URL não definida. Configure o arquivo .env antes do build de produção.'
    );
  }

  return value.length > 0 ? value : 'http://localhost:8000/api/v1';
})();

/** Origem do backend (target do proxy Vite e base do WebSocket). */
export const API_ORIGIN: string = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return 'http://localhost:8000';
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