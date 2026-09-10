import { useEffect } from 'react';
import { useBranding } from './useBranding';

/**
 * Define o título da aba do navegador como "Portal B2B - {Nome da empresa}".
 * Usa o branding do tenant (nome da empresa); se ainda não carregou,
 * mantém "Portal B2B" como fallback.
 */
export function useDocumentTitle() {
  const { branding } = useBranding();
  useEffect(() => {
    const company = branding?.name?.trim();
    document.title = company ? `Portal B2B - ${company}` : 'Portal B2B';
  }, [branding?.name]);
}