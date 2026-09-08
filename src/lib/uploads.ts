/**
 * Upload seguro de arquivos (Blocos 3 e 4).
 *
 * SEGURANÇA:
 * - Validação CLIENT-SIDE de tipo MIME e tamanho ANTES do envio (defesa em
 *   profundidade — o backend SEMPRE revalida via validate_upload).
 * - Nunca converte o arquivo em data URL (vaza memória e embute binário no
 *   estado). Prévia usa URL.createObjectURL + revogação imediata.
 * - Erros sanitizados; detalhes técnicos nunca vão para a UI.
 */
import { api } from './api';
import type { CustomerImportResult, FileUploadResponse } from '@/types/api';

// ─────────────────────────────────────────────
// Imagens (Bloco 3 — catálogo)
// ─────────────────────────────────────────────

/** Tipos de imagem aceitos (mesma política do backend). */
const ACCEPTED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

/** Limite de 5 MB — alinhado à política de upload do backend. */
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

/** Valida o arquivo de imagem e retorna mensagem amigável ou null (válido). */
export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_MIME.has(file.type)) {
    return 'Formato não permitido. Use JPG, PNG ou WebP.';
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return 'Imagem muito grande. O limite é 5 MB.';
  }
  if (file.size === 0) {
    return 'O arquivo está vazio.';
  }
  return null;
}

/** Cria URL de prévia efêmera (deve ser revogada depois). */
export function createObjectPreview(file: File): string {
  return URL.createObjectURL(file);
}

/** Revoga URL de prévia — chamar ao trocar de arquivo e ao desmontar. */
export function revokeObjectPreview(url: string | null): void {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

/** Faz upload da imagem de um produto (2ª fase — após criar o produto). */
export async function uploadProductImage(
  productId: string,
  file: File
): Promise<FileUploadResponse> {
  const invalid = validateImageFile(file);
  if (invalid) throw new Error(invalid);
  // POST /files/upload/product?owner_id={productId}  (multipart, credentials: include)
  return api.upload<FileUploadResponse>('/files/upload/product', file, {
    owner_id: productId,
  });
}

/** Valida URL de imagem vinda do backend antes de renderizar em <img>. */
export function isSafeImageUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.trim().length === 0) return false;
  const value = url.trim();
  if (value.startsWith('blob:')) return true; // prévia local efêmera
  if (value.startsWith('/')) return true;     // relativo (proxy)
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// CSV de clientes (Bloco 4 — importação em lote)
// ─────────────────────────────────────────────

/** Tipos de CSV aceitos na importação de clientes. */
const ACCEPTED_CSV_MIME = new Set([
  'text/csv',
  'application/csv',
  'text/plain', // alguns navegadores marcam .csv como text/plain
]);

/** Limite de 2 MB para CSV de clientes. */
export const MAX_CSV_SIZE_BYTES = 2 * 1024 * 1024;

/** Valida o arquivo CSV e retorna mensagem amigável ou null (válido). */
export function validateCsvFile(file: File): string | null {
  const isCsv =
    ACCEPTED_CSV_MIME.has(file.type) ||
    file.name.toLowerCase().endsWith('.csv');
  if (!isCsv) return 'Formato não permitido. Envie um arquivo .csv.';
  if (file.size > MAX_CSV_SIZE_BYTES) return 'Arquivo muito grande. O limite é 2 MB.';
  if (file.size === 0) return 'O arquivo está vazio.';
  return null;
}

/**
 * Faz upload do CSV de importação de clientes.
 * POST /customers/import (multipart, credentials: include).
 * Retorna { created, skipped, errors: [{ row, error }] }.
 */
export async function uploadCustomersCsv(file: File): Promise<CustomerImportResult> {
  const invalid = validateCsvFile(file);
  if (invalid) throw new Error(invalid);
  return api.upload<CustomerImportResult>('/customers/import', file);
}