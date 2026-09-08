/**
 * Camada de injeção de identidade visual (Bloco 2 — white-label).
 *
 * SEGURANÇA:
 * - Cores vindas do backend são validadas contra ^#[0-9a-fA-F]{6}$ ANTES de
 *   serem aplicadas em variáveis CSS (proteção contra injeção de estilo).
 * - URLs de logo/favicon são validadas (apenas http/https ou caminho relativo)
 *   para bloquear javascript: e outros esquemas perigosos.
 * - Apenas um whitelist de variáveis CSS conhecidas é tocada — nunca chaves
 *   arbitrárias vindas do servidor.
 */
import { api } from './api';
import type { CompanyBranding } from '../types/api';

/** Whitelist de variáveis CSS que o branding pode alterar. */
const BRANDING_CSS_VARS: Record<string, string> = {
  '--primary': 'primary_color',
  '--ring': 'primary_color',
  '--brand-header': 'primary_color',
  '--secondary': 'secondary_color',
} as const;

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/** Valida cor hex (evita injeção de CSS via valor arbitrário). */
export function isValidHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR_RE.test(value.trim());
}

/** Valida URL de logo/favicon (bloqueia javascript:, data: e afins). */
export function isSafeAssetUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim().length === 0) return false;
  const trimmed = value.trim();
  if (trimmed.startsWith('/')) return true; // caminho relativo (proxy)
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Aplica as cores do branding apenas nas variáveis CSS do whitelist. */
export function applyBrandingColors(branding: CompanyBranding): void {
  const root = document.documentElement;
  for (const [cssVar, sourceKey] of Object.entries(BRANDING_CSS_VARS)) {
    const raw = branding[sourceKey as keyof CompanyBranding];
    const color = typeof raw === 'string' ? raw : undefined;
    // Só aplica se for cor hex válida — ignora valores suspeitos.
    if (color && isValidHexColor(color)) {
      root.style.setProperty(cssVar, color.trim());
    }
  }
}

/** Busca o branding do tenant autenticado e aplica as cores. */
export async function loadBranding(): Promise<CompanyBranding | null> {
  try {
    const branding = await api.get<CompanyBranding>('/companies/branding');
    applyBrandingColors(branding);
    return branding;
  } catch {
    // Sem branding → mantém o tema institucional nydB2B (fallback elegante).
    return null;
  }
}

/** Resolve o branding público por domínio (tela de login, pré-autenticação). */
export async function loadBrandingByDomain(domain: string): Promise<CompanyBranding | null> {
  try {
    const branding = await api.get<CompanyBranding>(`/companies/by-domain/${encodeURIComponent(domain)}`);
    applyBrandingColors(branding);
    return branding;
  } catch {
    return null;
  }
}

/** Helper seguro para renderizar logo com fallback tipográfico nydB2B. */
export function safeLogoUrl(branding: CompanyBranding | null): string | null {
  if (!branding) return null;
  return isSafeAssetUrl(branding.logo_url) ? branding.logo_url : null;
}

export function safeFaviconUrl(branding: CompanyBranding | null): string | null {
  if (!branding) return null;
  return isSafeAssetUrl(branding.favicon_url) ? branding.favicon_url : null;
}