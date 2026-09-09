/**
 * Renderização segura de conteúdo rico (HTML) — Bloco Vitrine.
 * NUNCA use dangerouslySetInnerHTML diretamente com dados do backend.
 * Todo HTML passa por DOMPurify (remove scripts, handlers, iframes, forms).
 */
import DOMPurify from 'dompurify';

/** Detecta se a string contém marcação HTML (tags). */
export function hasHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value || '');
}

/** Sanitiza HTML: remove scripts, eventos inline e tags perigosas. */
export function sanitizeHtml(value: string): string {
  return DOMPurify.sanitize(value || '', {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onmouseout', 'onchange', 'style'],
  });
}