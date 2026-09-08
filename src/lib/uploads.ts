/**
 * Upload seguro de arquivos (Blocos 3 e 4).
 *
 * SEGURANÇA:
 * - Validação CLIENT-SIDE de tipo MIME e tamanho ANTES do envio (defesa em
 *   profundidade — o backend SEMPRE revalida via validate_upload).
 * - Nunca converte o arquivo em data URL (vaza memória e embute binário no
 *   estado). Prévia usa URL.createObjectURL + revogação imediata.
 * - O api.upload aceita FormData PRONTO; cada função monta o FormData com
 *   o campo 'file' antes de enviar (contrato do backend: multipart "file").
 *
 * ✅ isSafeImageUrl é um TYPE GUARD (url is string): ao retornar true, o
 * TypeScript estreita o tipo para `string`, eliminando o TS2322 (null não
 * é atribuível a string) em <img src> de StorePage/CatalogPage/CartPage.
 */
import { api } from './api';
import type { CustomerImportResult, FileUploadResponse } from '@/types/api';

// ─────────────────────────────────────────────
// Imagens de produto / catálogo (Bloco 3)
// ─────────────────────────────────────────────
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB (espelha ALLOWED_BY_OWNER)
const ACCEPTED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Valida arquivo de imagem ANTES do envio (tipo MIME + tamanho). */
export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_MIME.has(file.type)) {
    return 'Formato de imagem não permitido (use JPG, PNG ou WebP).';
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return 'Imagem muito grande (máx. 5 MB).';
  }
  return null;
}

/** Cria URL de prévia (object URL) — deve ser revogada com revokeObjectPreview. */
export function createObjectPreview(file: File): string {
  return URL.createObjectURL(file);
}

/** Revoga a URL de prévia para liberar memória. */
export function revokeObjectPreview(url: string | null | undefined): void {
  if (url) URL.revokeObjectURL(url);
}

const UNSAFE_PROTOCOLS = ['javascript:', 'data:', 'file:', 'vbscript:'];

/**
 * ✅ TYPE GUARD: filtra URLs perigosas E estreita o tipo para `string`.
 * Uso: isSafeImageUrl(p.image_url) ? <img src={p.image_url} /> : <Fallback />
 * → dentro do if, p.image_url é `string` (TS2322 resolvido em todo lugar).
 */
export function isSafeImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  const value = url.trim();
  if (!value) return false;
  const lower = value.toLowerCase();
  if (UNSAFE_PROTOCOLS.some((p) => lower.startsWith(p))) return false;
  return true;
}

/**
 * Upload da imagem de produto.
 * POST /files/upload/product?owner_id={productId} (multipart com campo "file").
 */
export async function uploadProductImage(productId: string, file: File): Promise<FileUploadResponse> {
  const invalid = validateImageFile(file);
  if (invalid) throw new Error(invalid);

  const form = new FormData();
  form.append('file', file);
  return api.upload<FileUploadResponse>('/files/upload/product', form, {
    owner_id: productId,
  });
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

/** Valida arquivo CSV ANTES do envio. */
export function validateCsvFile(file: File): string | null {
  if (!ACCEPTED_CSV_MIME.has(file.type)) {
    return 'Formato de arquivo não permitido (use CSV).';
  }
  if (file.size > MAX_CSV_SIZE_BYTES) {
    return 'Arquivo muito grande (máx. 2 MB).';
  }
  return null;
}

/**
 * Upload do CSV de importação de clientes.
 * POST /customers/import (multipart, credentials: include).
 * Retorna { created, skipped, errors: [{ row, error }] }.
 */
export async function uploadCustomersCsv(file: File): Promise<CustomerImportResult> {
  const invalid = validateCsvFile(file);
  if (invalid) throw new Error(invalid);

  const form = new FormData();
  form.append('file', file);
  return api.upload<CustomerImportResult>('/customers/import', form);
}