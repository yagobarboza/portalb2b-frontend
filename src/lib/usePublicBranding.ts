import { useEffect, useState } from 'react';
import type { CompanyBranding } from '../types/api';
import {
  applyDocumentBranding,
  loadBrandingByDomain,
  safeLogoUrl,
} from './branding';

export function usePublicBranding() {
  const [branding, setBranding] = useState<CompanyBranding | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const host = window.location.hostname;

    if (!host || host === 'localhost' || host === '127.0.0.1') {
      setLoading(false);
      return () => { active = false; };
    }

    void loadBrandingByDomain(host).then((data) => {
      if (!active) return;
      setBranding(data);
      setLoading(false);
    });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!loading) applyDocumentBranding(branding);
  }, [branding, loading]);

  return { branding, loading, logoUrl: safeLogoUrl(branding) };
}
