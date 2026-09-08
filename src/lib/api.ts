/**
 * Cliente API (Bloco 0).
 * Todas as chamadas trafegam com credentials: 'include' (cookies HttpOnly).
 *
 * SEGURANÇA:
 * - Nunca loga tokens, cookies ou payloads sensíveis.
 * - Erros são sanitizados: a UI recebe mensagem amigável; detalhes
 *   técnicos só no console em ambiente de desenvolvimento.
 * - 401 dispara evento global de expiração de sessão (nunca expõe o token).
 */
import { API_BASE_URL } from './env';

/** Evento global disparado quando a sessão expira (status 401). */
export const SESSION_EXPIRED_EVENT = 'nydb2b:session-expired';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    // `details` só deve ser usado para mapeamento de validação (422),
    // nunca renderizado cru na UI.
    this.details = details;
  }
}

interface ErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

/** Normaliza o payload de erro sem confiar em estrutura desconhecida. */
function normalizeErrorPayload(payload: unknown): ErrorPayload {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const err = (payload as { error?: { code?: string; message?: string; details?: unknown } }).error;
    return {
      code: typeof err?.code === 'string' ? err.code : 'unknown_error',
      message: typeof err?.message === 'string' ? err.message : 'Ocorreu um erro inesperado.',
      details: err?.details,
    };
  }
  return { code: 'unknown_error', message: 'Ocorreu um erro inesperado.', details: undefined };
}

/** Mensagens amigáveis por status — sem vazar detalhes internos. */
const STATUS_MESSAGES: Record<number, string> = {
  400: 'Requisição inválida. Verifique os dados informados.',
  401: 'Sua sessão expirou. Faça login novamente.',
  403: 'Acesso negado. Você não tem permissão para esta ação.',
  404: 'Recurso não encontrado.',
  422: 'Alguns campos estão inválidos. Revise o formulário.',
  429: 'Muitas tentativas. Aguarde um instante e tente novamente.',
  500: 'Instabilidade nos serviços internos. Tente novamente em instantes.',
};

function buildUrl(path: string, params?: Record<string, unknown>): string {
  const base = path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (!params) return base;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base;
}

interface RequestOptions {
  body?: unknown;
  params?: Record<string, unknown>;
  isFormData?: boolean;
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const url = buildUrl(path, options.params);
  const headers: Record<string, string> = {};

  if (options.body !== undefined && !options.isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      credentials: 'include', // cookies HttpOnly
      body:
        options.isFormData
          ? (options.body as FormData)
          : options.body !== undefined
            ? JSON.stringify(options.body)
            : undefined,
    });
  } catch {
    // Nunca logar a URL completa (pode conter query com dados).
    throw new ApiError(0, 'network_error', 'Falha de conexão com o servidor. Tente novamente.');
  }

  if (!res.ok) {
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      /* corpo não-JSON */
    }
    const { code, message, details } = normalizeErrorPayload(payload);

    // 401 → expiração de sessão. Nunca expõe token/cookie.
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }

    // Log técnico apenas em desenvolvimento, sem dados sensíveis.
    if (import.meta.env.DEV) {
      console.error(`[api] ${method} ${path} → ${res.status} (${code})`);
    }

    const friendly = STATUS_MESSAGES[res.status] ?? 'Ocorreu um erro inesperado.';
    throw new ApiError(res.status, code, message || friendly, details);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, params?: Record<string, unknown>) =>
    request<T>('GET', path, { params }),

  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('POST', path, { ...options, body }),

  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('PATCH', path, { ...options, body }),

  delete: <T>(path: string, params?: Record<string, unknown>) =>
    request<T>('DELETE', path, { params }),

  /**
   * Upload multipart/form-data (ex.: anexos de ticket/chat, upload de produto).
   *
   * ✅ Aceita um `FormData` PRONTO (o chamador controla o nome do campo).
   * Não define Content-Type manualmente — o navegador insere o boundary.
   *
   * Uso:
   *   const form = new FormData();
   *   form.append('file', file);
   *   await api.upload('/tickets/{id}/attachments', form);
   */
  upload: <T>(path: string, formData: FormData, params?: Record<string, unknown>) =>
    request<T>('POST', path, { body: formData, isFormData: true, params }),
};