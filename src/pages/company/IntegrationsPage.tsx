import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Check, Copy, FileUp, History, KeyRound, Link2, Loader2, PlugZap, Plus,
  RefreshCw, Save, Trash2, Upload,
} from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';

/** Integração ERP do tenant (GET /integrations). */
interface ERPIntegration {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  created_at: string;
}

/** Resposta da emissão da chave do agente (a chave aparece UMA única vez). */
interface AgentApiKeyCreated {
  prefix: string;
  api_key: string;
}

/** Status da chave do agente (prefixo + ativa; a chave nunca é devolvida). */
interface AgentApiKeyRead {
  prefix: string | null;
  is_active: boolean;
}

/** Execução de sincronização (GET /integrations/{id}/syncs). */
interface SyncExecution {
  id: string;
  integration_id: string;
  entity: string;
  status: string;
  processed: number;
  errors: number;
  started_at: string | null;
  finished_at: string | null;
  message: string | null;
  created_at: string;
}

/** Resultado da ingestão de estoque (arquivo / pull). */
interface StockSyncResult {
  sync_id: string;
  status: string; // ok | partial | failed | duplicate
  processed: number;
  unchanged: number;
  errors: number;
  message: string | null;
  details: { sku?: string; row?: number; index?: number; error: string }[];
}

/** Config do pull (PUT/GET /{id}/api-config) — segredos mascarados. */
interface ApiPullConfigRead {
  base_url: string;
  path: string;
  auth_type: string;
  data_path: string;
  sku_field: string;
  stock_field: string;
  external_id_field: string;
  interval_minutes: number;
  token_set: boolean;
  username_set: boolean;
  password_set: boolean;
  header_keys: string[];
}

/** Resultado do teste de conexão (POST /{id}/api-config/test). */
interface ApiPullTestResult {
  ok: boolean;
  status_code: number | null;
  items_found: number;
  message: string;
}

/** Tipos de integração disponíveis + descrição curta (helper text). */
const INTEGRATION_TYPES: { value: string; label: string; description: string }[] = [
  {
    value: 'agent',
    label: 'Agente (ERP local)',
    description: 'Agente na infra do cliente envia o estoque via chave de API. Ideal para ERP local (ex.: Nexus/MySQL on-premise).',
  },
  {
    value: 'api',
    label: 'API (ERP com REST)',
    description: 'Nosso worker consulta a API pública do ERP do cliente em intervalos (pull periódico).',
  },
  {
    value: 'webhook',
    label: 'Webhook (eventos)',
    description: 'O ERP do cliente chama nosso endpoint quando o estoque muda (tempo real).',
  },
  {
    value: 'file',
    label: 'Arquivo (CSV/Excel)',
    description: 'Importação de estoque a partir de arquivo exportado pelo ERP do cliente.',
  },
];

/** ISO 8601 UTC → data/hora local (pt-BR). */
function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
}

/** Badge de status da execução (legível em Light e Dark). */
function SyncStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-muted text-muted-foreground',
    running: 'bg-blue-500/15 text-blue-600',
    success: 'bg-green-500/15 text-green-600',
    failed: 'bg-red-500/15 text-red-600',
  };
  const labels: Record<string, string> = {
    pending: 'Pendente', running: 'Em execução', success: 'Sucesso', failed: 'Falha',
  };
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-muted text-muted-foreground'}`}>
      {labels[status] ?? status}
    </span>
  );
}

/** Formulário do pull (tipo `api`). */
interface ApiConfigForm {
  base_url: string;
  path: string;
  auth_type: 'none' | 'bearer' | 'basic';
  token: string;
  username: string;
  password: string;
  data_path: string;
  sku_field: string;
  stock_field: string;
  external_id_field: string;
  interval_minutes: string;
  headers: string; // "Chave: Valor" por linha
}

const emptyApiForm = (): ApiConfigForm => ({
  base_url: '',
  path: '/',
  auth_type: 'none',
  token: '',
  username: '',
  password: '',
  data_path: '',
  sku_field: 'sku',
  stock_field: 'stock',
  external_id_field: 'external_id',
  interval_minutes: '15',
  headers: '',
});

/** Converte o form em payload da API (headers de "Chave: Valor" para objeto). */
function buildApiPayload(form: ApiConfigForm) {
  const headers: Record<string, string> = {};
  for (const line of form.headers.split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      if (k) headers[k] = v;
    }
  }
  return {
    base_url: form.base_url.trim(),
    path: form.path.trim() || '/',
    auth_type: form.auth_type,
    token: form.auth_type === 'bearer' ? form.token.trim() || undefined : undefined,
    username: form.auth_type === 'basic' ? form.username.trim() || undefined : undefined,
    password: form.auth_type === 'basic' ? form.password.trim() || undefined : undefined,
    data_path: form.data_path.trim(),
    sku_field: form.sku_field.trim() || 'sku',
    stock_field: form.stock_field.trim() || 'stock',
    external_id_field: form.external_id_field.trim() || 'external_id',
    interval_minutes: Number(form.interval_minutes) || 15,
    headers,
  };
}

export default function IntegrationsPage() {
  // ── Listagem ──
  const [integrations, setIntegrations] = useState<ERPIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyPrefixes, setKeyPrefixes] = useState<Record<string, string | null>>({});

  // ── Criação ──
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('agent');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Chave do agente ──
  const [keyFor, setKeyFor] = useState<ERPIntegration | null>(null);
  const [generatedKey, setGeneratedKey] = useState<AgentApiKeyCreated | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Histórico de syncs ──
  const [syncsFor, setSyncsFor] = useState<ERPIntegration | null>(null);
  const [syncs, setSyncs] = useState<SyncExecution[]>([]);
  const [syncsLoading, setSyncsLoading] = useState(false);

  // ── Upload de arquivo (tipo `file`) ──
  const [uploadingFor, setUploadingFor] = useState<ERPIntegration | null>(null);
  const [importResult, setImportResult] = useState<StockSyncResult | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Config do pull (tipo `api`) ──
  const [configFor, setConfigFor] = useState<ERPIntegration | null>(null);
  const [apiForm, setApiForm] = useState<ApiConfigForm>(emptyApiForm());
  const [configLoaded, setConfigLoaded] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ApiPullTestResult | null>(null);
  const [pulling, setPulling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<ERPIntegration[]>('/integrations');
      setIntegrations(data);
      const prefixes: Record<string, string | null> = {};
      await Promise.all(
        data.map(async (it) => {
          try {
            const k = await api.get<AgentApiKeyRead>(`/integrations/${it.id}/agent-key`);
            prefixes[it.id] = k.prefix;
          } catch {
            prefixes[it.id] = null;
          }
        }),
      );
      setKeyPrefixes(prefixes);
    } catch {
      toast.error('Não foi possível carregar as integrações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Criar integração ──
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!name.trim()) { setFormError('Informe o nome da integração.'); return; }
    setSaving(true);
    setFormError(null);
    try {
      await api.post('/integrations', { name: name.trim(), type });
      toast.success('Integração criada.');
      setCreateOpen(false);
      setName('');
      setType('agent');
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Erro ao criar a integração.');
    } finally {
      setSaving(false);
    }
  };

  // ── Chave do agente ──
  const handleGenerateKey = async (it: ERPIntegration) => {
    setKeyFor(it);
    setGeneratedKey(null);
    setCopied(false);
    setGenerating(true);
    try {
      const key = await api.post<AgentApiKeyCreated>(`/integrations/${it.id}/agent-key`);
      setGeneratedKey(key);
      setKeyPrefixes((prev) => ({ ...prev, [it.id]: key.prefix }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao gerar a chave.');
      setKeyFor(null);
    } finally {
      setGenerating(false);
    }
  };

  const handleRevokeKey = async (it: ERPIntegration) => {
    if (!window.confirm(`Revogar a chave de API da integração "${it.name}"? O agente deixará de conseguir enviar dados.`)) return;
    try {
      await api.delete(`/integrations/${it.id}/agent-key`);
      setKeyPrefixes((prev) => ({ ...prev, [it.id]: null }));
      toast.success('Chave revogada.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao revogar a chave.');
    }
  };

  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar a chave.');
    }
  };

  // ── Histórico de syncs ──
  const openSyncs = async (it: ERPIntegration) => {
    setSyncsFor(it);
    setSyncs([]);
    setSyncsLoading(true);
    try {
      const data = await api.get<SyncExecution[]>(`/integrations/${it.id}/syncs`);
      setSyncs(data);
    } catch {
      toast.error('Não foi possível carregar as execuções.');
    } finally {
      setSyncsLoading(false);
    }
  };

  // ── Upload de arquivo (tipo `file`) ──
  const pickImportFile = (it: ERPIntegration, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!file) return;
    void runImport(it, file);
  };

  const runImport = async (it: ERPIntegration, file: File) => {
    setUploadingFor(it);
    setImportResult(null);
    setImporting(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const result = await api.upload<StockSyncResult>(`/integrations/${it.id}/stock/import`, form);
      setImportResult(result);
      toast.success('Importação concluída.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao importar o arquivo.');
    } finally {
      setImporting(false);
    }
  };

  // ── Config do pull (tipo `api`) ──
  const openConfig = async (it: ERPIntegration) => {
    setConfigFor(it);
    setApiForm(emptyApiForm());
    setConfigLoaded(false);
    setTestResult(null);
    try {
      const cfg = await api.get<ApiPullConfigRead>(`/integrations/${it.id}/api-config`);
      setApiForm({
        base_url: cfg.base_url,
        path: cfg.path,
        auth_type: cfg.auth_type as ApiConfigForm['auth_type'],
        token: '',
        username: '',
        password: '',
        data_path: cfg.data_path,
        sku_field: cfg.sku_field,
        stock_field: cfg.stock_field,
        external_id_field: cfg.external_id_field,
        interval_minutes: String(cfg.interval_minutes),
        headers: cfg.header_keys.map((k) => `${k}: `).join('\n'),
      });
      setConfigLoaded(true);
    } catch {
      // Sem config ainda → form vazio (criação).
      setConfigLoaded(true);
    }
  };

  const saveConfig = async (): Promise<boolean> => {
    if (!configFor || configSaving) return false;
    if (!apiForm.base_url.trim()) {
      toast.error('Informe a URL base da API.');
      return false;
    }
    if (apiForm.auth_type === 'bearer' && !apiForm.token.trim()) {
      toast.error('Informe o token para autenticação Bearer.');
      return false;
    }
    if (apiForm.auth_type === 'basic' && (!apiForm.username.trim() || !apiForm.password.trim())) {
      toast.error('Informe usuário e senha para autenticação Basic.');
      return false;
    }
    setConfigSaving(true);
    try {
      await api.put(`/integrations/${configFor.id}/api-config`, buildApiPayload(apiForm));
      toast.success('Configuração salva.');
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao salvar a configuração.');
      return false;
    } finally {
      setConfigSaving(false);
    }
  };

  const handleTest = async () => {
    if (!configFor) return;
    const saved = await saveConfig();
    if (!saved) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.post<ApiPullTestResult>(`/integrations/${configFor.id}/api-config/test`);
      setTestResult(result);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao testar a conexão.');
    } finally {
      setTesting(false);
    }
  };

  const handlePull = async () => {
    if (!configFor) return;
    const saved = await saveConfig();
    if (!saved) return;
    setPulling(true);
    try {
      const result = await api.post<StockSyncResult>(`/integrations/${configFor.id}/api-config/pull`);
      setImportResult(result);
      toast.success('Pull executado.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao executar o pull.');
    } finally {
      setPulling(false);
    }
  };

  const setApiField = <K extends keyof ApiConfigForm>(key: K, value: ApiConfigForm[K]) =>
    setApiForm((prev) => ({ ...prev, [key]: value }));

  const selectedType = INTEGRATION_TYPES.find((t) => t.value === type);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Integrações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Conecte o ERP do cliente ao portal. Cada integração tem um tipo de conexão
            (agente, API, webhook ou arquivo) para sincronizar o estoque.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nova integração
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando integrações…
        </div>
      ) : integrations.length === 0 ? (
        <div className="py-20 text-center">
          <PlugZap className="mx-auto mb-4 h-16 w-16 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold text-muted-foreground">Nenhuma integração</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie uma integração para sincronizar o estoque do cliente.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {integrations.map((it) => (
            <Card key={it.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{it.name}</CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Tipo: <span className="font-mono">{it.type}</span> · Criada em {formatDate(it.created_at)}
                    </p>
                  </div>
                  <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${it.is_active ? 'bg-green-500/15 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                    {it.is_active ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* ── Ações por tipo ── */}
                {it.type === 'agent' && (
                  <div className="flex flex-wrap items-center gap-2">
                    {keyPrefixes[it.id] ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-mono text-xs">
                          <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                          {keyPrefixes[it.id]}…
                        </span>
                        <Button variant="outline" size="sm" onClick={() => handleRevokeKey(it)} aria-label={`Revogar chave de ${it.name}`}>
                          <Trash2 className="mr-1 h-3.5 w-3.5" /> Revogar
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" onClick={() => handleGenerateKey(it)} disabled={generating && keyFor?.id === it.id} aria-label={`Gerar chave de ${it.name}`}>
                        <KeyRound className="mr-1 h-3.5 w-3.5" />
                        {generating && keyFor?.id === it.id ? 'Gerando…' : 'Gerar chave de API'}
                      </Button>
                    )}
                  </div>
                )}

                {it.type === 'file' && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={fileRef}
                        type="file"
                        accept=".csv,.xlsx,.xlsm"
                        className="hidden"
                        disabled={importing}
                        onChange={(e) => pickImportFile(it, e)}
                      />
                      <Button size="sm" onClick={() => fileRef.current?.click()} disabled={importing} aria-label={`Importar arquivo de ${it.name}`}>
                        <FileUp className="mr-1 h-3.5 w-3.5" />
                        {importing && uploadingFor?.id === it.id ? 'Importando…' : 'Importar CSV/Excel'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openSyncs(it)} aria-label={`Ver execuções de ${it.name}`}>
                        <History className="mr-1 h-3.5 w-3.5" /> Execuções
                      </Button>
                    </div>
                    {importResult && uploadingFor?.id === it.id && (
                      <div className="rounded-md border bg-muted/40 p-2 text-xs">
                        <p className="font-medium">
                          {importResult.processed} atualizado(s) · {importResult.unchanged} inalterado(s) · {importResult.errors} erro(s)
                        </p>
                        {importResult.details.length > 0 && (
                          <ul className="mt-1 max-h-24 space-y-0.5 overflow-y-auto text-muted-foreground">
                            {importResult.details.slice(0, 10).map((d, i) => (
                              <li key={i}>
                                {d.row ? `Linha ${d.row}: ` : ''}{d.sku ? `[${d.sku}] ` : ''}{d.error}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Colunas: <span className="font-mono">sku</span> e <span className="font-mono">stock</span> (opcional <span className="font-mono">external_id</span>).
                    </p>
                  </div>
                )}

                {it.type === 'webhook' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
                      <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <code className="min-w-0 flex-1 truncate font-mono text-xs">
                        POST /webhooks/{it.id}
                      </code>
                      <Button variant="outline" size="sm" onClick={() => copyKey(`/webhooks/${it.id}`)} aria-label="Copiar URL do webhook">
                        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Configure o ERP para chamar esta URL com o evento{' '}
                      <span className="font-mono">stock.sync</span> e o header{' '}
                      <span className="font-mono">X-Webhook-Signature</span> (HMAC-SHA256).
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => openSyncs(it)} aria-label={`Ver execuções de ${it.name}`}>
                      <History className="mr-1 h-3.5 w-3.5" /> Execuções
                    </Button>
                  </div>
                )}

                {it.type === 'api' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={() => openConfig(it)} aria-label={`Configurar API de ${it.name}`}>
                      <PlugZap className="mr-1 h-3.5 w-3.5" /> Configurar API
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openSyncs(it)} aria-label={`Ver execuções de ${it.name}`}>
                      <History className="mr-1 h-3.5 w-3.5" /> Execuções
                    </Button>
                  </div>
                )}

                {/* Ações comuns (agente também tem Execuções) */}
                {it.type === 'agent' && (
                  <Button variant="ghost" size="sm" onClick={() => openSyncs(it)} aria-label={`Ver execuções de ${it.name}`}>
                    <History className="mr-1 h-3.5 w-3.5" /> Execuções
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Diálogo: nova integração ── */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!saving) setCreateOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova integração</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="int-name">Nome *</Label>
              <Input
                id="int-name"
                value={name}
                maxLength={150}
                placeholder="Ex.: ERP Nexus — Cliente X"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="int-type">Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="int-type" className="w-full">
                  <SelectValue placeholder="Selecione o tipo…" />
                </SelectTrigger>
                <SelectContent>
                  {INTEGRATION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedType && (
                <p className="text-xs text-muted-foreground">{selectedType.description}</p>
              )}
            </div>
            {formError && (
              <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{formError}</p>
            )}
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Criando…' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo: chave gerada (aparece UMA vez) ── */}
      <Dialog open={!!keyFor} onOpenChange={(o) => { if (!generating && !o) { setKeyFor(null); setGeneratedKey(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Chave de API do agente</DialogTitle>
          </DialogHeader>
          {generatedKey ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Copie a chave agora. <strong className="text-foreground">Ela é exibida apenas uma vez</strong> — depois disso,
                apenas o prefixo fica visível. Configure o agente do cliente com esta chave.
              </p>
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
                <code className="min-w-0 flex-1 truncate font-mono text-sm">{generatedKey.api_key}</code>
                <Button variant="outline" size="sm" onClick={() => copyKey(generatedKey.api_key)} aria-label="Copiar chave">
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Prefixo: <span className="font-mono">{generatedKey.prefix}</span> · Envie via header <span className="font-mono">X-API-Key</span> para <span className="font-mono">POST /integrations/agent/stock</span>.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando chave…
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => { setKeyFor(null); setGeneratedKey(null); }} disabled={generating}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo: config da API (tipo `api`) ── */}
      <Dialog open={!!configFor} onOpenChange={(o) => { if (!configSaving && !testing && !pulling && !o) setConfigFor(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configurar API — {configFor?.name}</DialogTitle>
          </DialogHeader>
          {configLoaded ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-base-url">URL base *</Label>
                <Input
                  id="api-base-url"
                  value={apiForm.base_url}
                  placeholder="https://api.erp-cliente.com.br"
                  onChange={(e) => setApiField('base_url', e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="api-path">Caminho (endpoint)</Label>
                  <Input id="api-path" value={apiForm.path} placeholder="/estoque" onChange={(e) => setApiField('path', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api-interval">Intervalo (min)</Label>
                  <Input id="api-interval" type="number" min={1} max={1440} value={apiForm.interval_minutes} onChange={(e) => setApiField('interval_minutes', e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-auth">Autenticação</Label>
                <Select value={apiForm.auth_type} onValueChange={(v) => setApiField('auth_type', v as ApiConfigForm['auth_type'])}>
                  <SelectTrigger id="api-auth" className="w-full sm:max-w-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    <SelectItem value="bearer">Bearer token</SelectItem>
                    <SelectItem value="basic">Basic (usuário/senha)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {apiForm.auth_type === 'bearer' && (
                <div className="space-y-2">
                  <Label htmlFor="api-token">Token</Label>
                  <Input id="api-token" type="password" value={apiForm.token} placeholder="Bearer token" onChange={(e) => setApiField('token', e.target.value)} />
                  <p className="text-xs text-muted-foreground">Deixe em branco para manter o token atual.</p>
                </div>
              )}
              {apiForm.auth_type === 'basic' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="api-user">Usuário</Label>
                    <Input id="api-user" value={apiForm.username} onChange={(e) => setApiField('username', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="api-pass">Senha</Label>
                    <Input id="api-pass" type="password" value={apiForm.password} onChange={(e) => setApiField('password', e.target.value)} />
                  </div>
                  <p className="text-xs text-muted-foreground sm:col-span-2">Deixe em branco para manter os valores atuais.</p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="api-data-path">Caminho dos itens (opcional)</Label>
                <Input id="api-data-path" value={apiForm.data_path} placeholder="data.items (vazio = corpo da resposta)" onChange={(e) => setApiField('data_path', e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="api-sku">Campo SKU</Label>
                  <Input id="api-sku" value={apiForm.sku_field} onChange={(e) => setApiField('sku_field', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api-stock">Campo estoque</Label>
                  <Input id="api-stock" value={apiForm.stock_field} onChange={(e) => setApiField('stock_field', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api-ext">Campo ID externo</Label>
                  <Input id="api-ext" value={apiForm.external_id_field} onChange={(e) => setApiField('external_id_field', e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-headers">Cabeçalhos adicionais (uma por linha)</Label>
                <textarea
                  id="api-headers"
                  className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder={'Chave: Valor\nX-API-Key: abc123'}
                  value={apiForm.headers}
                  onChange={(e) => setApiField('headers', e.target.value)}
                />
              </div>

              {testResult && (
                <div className={`rounded-md border p-3 text-sm ${testResult.ok ? 'border-green-500/30 bg-green-500/5 text-green-700' : 'border-red-500/30 bg-red-500/5 text-red-700'}`}>
                  <p className="font-medium">{testResult.ok ? 'Conexão OK' : 'Falha na conexão'}</p>
                  <p className="text-xs opacity-90">{testResult.message}</p>
                  {testResult.status_code != null && (
                    <p className="text-xs opacity-90">HTTP {testResult.status_code} · {testResult.items_found} item(ns)</p>
                  )}
                </div>
              )}

              {importResult && (
                <div className="rounded-md border bg-muted/40 p-2 text-xs">
                  <p className="font-medium">
                    Pull: {importResult.processed} atualizado(s) · {importResult.unchanged} inalterado(s) · {importResult.errors} erro(s)
                  </p>
                </div>
              )}

              <DialogFooter className="gap-2 sm:justify-end">
                <Button variant="outline" onClick={() => setConfigFor(null)} disabled={configSaving || testing || pulling}>
                  Fechar
                </Button>
                <Button variant="outline" onClick={handleTest} disabled={configSaving || testing || pulling}>
                  {testing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
                  Testar conexão
                </Button>
                <Button variant="outline" onClick={handlePull} disabled={configSaving || testing || pulling}>
                  {pulling ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
                  Buscar agora
                </Button>
                <Button onClick={saveConfig} disabled={configSaving || testing || pulling}>
                  <Save className="mr-1 h-4 w-4" />
                  {configSaving ? 'Salvando…' : 'Salvar'}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando configuração…
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Diálogo: histórico de execuções ── */}
      <Dialog open={!!syncsFor} onOpenChange={(o) => { if (!o) setSyncsFor(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Execuções — {syncsFor?.name}</DialogTitle>
          </DialogHeader>
          {syncsLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…
            </div>
          ) : syncs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma execução registrada ainda.
            </p>
          ) : (
            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {syncs.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {s.entity} · {formatDate(s.created_at)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.message ?? '—'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {s.processed} ok · {s.errors} erros
                    </span>
                    <SyncStatusBadge status={s.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setSyncsFor(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}