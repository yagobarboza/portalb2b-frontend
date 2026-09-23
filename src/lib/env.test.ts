import { describe, expect, it } from 'vitest';

import { absoluteApiUrl } from './env';
import { buildWsUrl } from './websocket';

describe('URLs públicas de produção', () => {
  it('gera webhook absoluto mesmo quando a API usa caminho relativo', () => {
    const url = absoluteApiUrl('/webhooks/integration-123');
    expect(url).toMatch(/^https?:\/\//);
    expect(url).toContain('/api/v1/webhooks/integration-123');
  });

  it('mantém o websocket no caminho público da API', () => {
    const url = buildWsUrl('room with spaces');
    expect(url).toMatch(/^wss?:\/\//);
    expect(url).toContain('/api/v1/chat/ws/room%20with%20spaces');
  });
});
