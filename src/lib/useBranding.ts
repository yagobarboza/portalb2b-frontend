import { useEffect, useState } from 'react';
import { loadBranding, safeFaviconUrl, safeLogoUrl } from './branding';
import type { CompanyBranding } from '../types/api';

export function useBranding() {
  const [branding, setBranding] = useState<CompanyBranding | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const data = await loadBranding(); // GET /companies/branding (valida cores/URLs)
      if (active) setBranding(data);
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  // Favicon dinâmico (seguro — URL validada contra esquemas perigosos).
  useEffect(() => {
    const favicon = safeFaviconUrl(branding);
    if (!favicon) return;
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (link) link.href = favicon;
  }, [branding]);

  return { branding, loading, logoUrl: safeLogoUrl(branding) };
}