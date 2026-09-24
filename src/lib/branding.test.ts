import { afterEach, describe, expect, it } from 'vitest';
import { applyDocumentBranding } from './branding';
import type { CompanyBranding } from '../types/api';

const tenantBranding: CompanyBranding = {
  id: 'tenant-id',
  name: 'Empresa Teste',
  slug: 'empresa-teste',
  domain: 'portal.empresa.test',
  logo_url: 'https://cdn.example.com/logo.png',
  favicon_url: 'https://cdn.example.com/favicon.ico',
  primary_color: '#112233',
  secondary_color: '#445566',
};

afterEach(() => {
  document.head.innerHTML = '';
  document.title = '';
});

describe('applyDocumentBranding', () => {
  it('aplica favicon e título da empresa', () => {
    applyDocumentBranding(tenantBranding);

    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    expect(favicon?.href).toBe('https://cdn.example.com/favicon.ico');
    expect(document.title).toBe('Empresa Teste | Portal B2B');
  });

  it('restaura os metadados institucionais sem tenant', () => {
    applyDocumentBranding(null);

    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    expect(favicon?.getAttribute('href')).toBe('/fav-icon-nyd.png');
    expect(document.title).toBe('Portal B2B | nydSoftwares');
  });
});
