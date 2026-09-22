export const INTEGRATION_DATA_INVALIDATED = 'nydb2b:integration-data-invalidated';

export function notifyIntegrationDataInvalidated(runId: string): void {
  window.dispatchEvent(new CustomEvent(INTEGRATION_DATA_INVALIDATED, { detail: { runId } }));
  try {
    localStorage.setItem(INTEGRATION_DATA_INVALIDATED, JSON.stringify({ runId, at: Date.now() }));
    localStorage.removeItem(INTEGRATION_DATA_INVALIDATED);
  } catch {
    // A invalidação local continua funcionando quando storage está bloqueado.
  }
}

export function subscribeIntegrationInvalidation(callback: () => void): () => void {
  const local = () => callback();
  const storage = (event: StorageEvent) => {
    if (event.key === INTEGRATION_DATA_INVALIDATED && event.newValue) callback();
  };
  window.addEventListener(INTEGRATION_DATA_INVALIDATED, local);
  window.addEventListener('storage', storage);
  return () => {
    window.removeEventListener(INTEGRATION_DATA_INVALIDATED, local);
    window.removeEventListener('storage', storage);
  };
}
