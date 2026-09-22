import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Check, Copy, KeyRound, Loader2, Play, RefreshCw, RotateCcw, Save, TestTube2 } from 'lucide-react';
import { ApiError } from '../../../lib/api';
import { API_BASE_URL } from '../../../lib/env';
import { PERMISSIONS } from '../../../lib/constants';
import { useAuth } from '../../../context/AuthContext';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { integrationsApi } from '../api';
import type { ApiPullConfigInput, SecretMode, SyncEntity } from '../contracts';
import { formatDuration, formatIntegrationDate, terminalStatuses } from '../format';
import { notifyIntegrationDataInvalidated } from '../invalidation';
import { RunStatusBadge } from '../components/RunStatusBadge';

type Integration = Awaited<ReturnType<typeof integrationsApi.get>>;
type Run = Awaited<ReturnType<typeof integrationsApi.run>>;
type RunPage = Awaited<ReturnType<typeof integrationsApi.runs>>;
type DryRun = Awaited<ReturnType<typeof integrationsApi.dryRun>>;

interface ConfigDraft {
  base_url: string; path: string; auth_type: 'none' | 'bearer' | 'basic'; data_path: string;
  sku_field: string; stock_field: string; external_id_field: string; occurred_at_field: string;
  source_version_field: string; cursor_param: string; next_cursor_path: string; interval_minutes: string;
  product_fields: string; headers: string; token: string; username: string; password: string;
  token_mode: SecretMode; username_mode: SecretMode; password_mode: SecretMode; headers_mode: SecretMode;
}

const emptyDraft = (): ConfigDraft => ({
  base_url: '', path: '/', auth_type: 'none', data_path: '', sku_field: 'sku', stock_field: 'stock',
  external_id_field: 'external_id', occurred_at_field: '', source_version_field: '', cursor_param: '',
  next_cursor_path: '', interval_minutes: '15', product_fields: JSON.stringify({ sku: 'sku', name: 'name', stock: 'stock', price: 'price' }, null, 2),
  headers: '{}', token: '', username: '', password: '', token_mode: 'keep', username_mode: 'keep',
  password_mode: 'keep', headers_mode: 'keep',
});

function message(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export default function IntegrationDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.INTEGRATION_MANAGE);
  const canRun = hasPermission(PERMISSIONS.INTEGRATION_RUN);
  const canSecrets = hasPermission(PERMISSIONS.INTEGRATION_SECRETS);
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ConfigDraft>(emptyDraft());
  const [configLoaded, setConfigLoaded] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<Awaited<ReturnType<typeof integrationsApi.testConnection>> | null>(null);
  const [dryEntity, setDryEntity] = useState<SyncEntity>('stock');
  const [dryRun, setDryRun] = useState<DryRun | null>(null);
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState<RunPage | null>(null);
  const [runPage, setRunPage] = useState(1);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const knownStatuses = useRef<Record<string, string>>({});
  const [webhookStatus, setWebhookStatus] = useState<Awaited<ReturnType<typeof integrationsApi.webhookStatus>> | null>(null);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);
  const [agentKey, setAgentKey] = useState<Awaited<ReturnType<typeof integrationsApi.agentKey>> | null>(null);
  const [newAgentKey, setNewAgentKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadRuns = useCallback(async (page = runPage) => {
    const next = await integrationsApi.runs(id, page, 10);
    const previous = knownStatuses.current;
    for (const run of next.items) {
      if (previous[run.id] && !terminalStatuses.has(previous[run.id]) && terminalStatuses.has(run.status)) {
        notifyIntegrationDataInvalidated(run.id);
        toast.success(`Sincronização ${run.entity} concluída.`);
      }
      previous[run.id] = run.status;
    }
    setRuns(next);
  }, [id, runPage]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const item = await integrationsApi.get(id);
      setIntegration(item); setName(item.name);
      if (item.type === 'api' && canSecrets) {
        try {
          const config = await integrationsApi.getConfig(id);
          setDraft({
            base_url: config.base_url, path: config.path, auth_type: config.auth_type as ConfigDraft['auth_type'],
            data_path: config.data_path, sku_field: config.sku_field, stock_field: config.stock_field,
            external_id_field: config.external_id_field, occurred_at_field: config.occurred_at_field,
            source_version_field: config.source_version_field, cursor_param: config.cursor_param,
            next_cursor_path: config.next_cursor_path, interval_minutes: String(config.interval_minutes),
            product_fields: JSON.stringify(config.product_fields ?? {}, null, 2),
            headers: JSON.stringify(Object.fromEntries(config.header_keys.map((key) => [key, ''])), null, 2),
            token: '', username: '', password: '', token_mode: 'keep', username_mode: 'keep',
            password_mode: 'keep', headers_mode: 'keep',
          });
        } catch (error) {
          if (!(error instanceof ApiError && error.status === 404)) throw error;
        }
        setConfigLoaded(true);
      }
      if (item.type === 'webhook' && canSecrets) setWebhookStatus(await integrationsApi.webhookStatus(id));
      if (item.type === 'agent' && canSecrets) setAgentKey(await integrationsApi.agentKey(id));
      await loadRuns(1);
    } catch (error) {
      toast.error(message(error, 'Não foi possível carregar a integração.'));
    } finally { setLoading(false); }
  }, [id, canSecrets, loadRuns]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!runs?.items.some((run) => !terminalStatuses.has(run.status))) return;
    const timer = window.setInterval(() => { void loadRuns(); }, 3000);
    return () => window.clearInterval(timer);
  }, [runs, loadRuns]);

  const configPayload = (): ApiPullConfigInput => {
    let product_fields: Record<string, string>; let headers: Record<string, string>;
    try { product_fields = JSON.parse(draft.product_fields || '{}') as Record<string, string>; }
    catch { throw new Error('O mapeamento de produtos não é um JSON válido.'); }
    try { headers = JSON.parse(draft.headers || '{}') as Record<string, string>; }
    catch { throw new Error('Os cabeçalhos não são um JSON válido.'); }
    return {
      base_url: draft.base_url.trim(), path: draft.path.trim() || '/', auth_type: draft.auth_type,
      data_path: draft.data_path.trim(), sku_field: draft.sku_field.trim(), stock_field: draft.stock_field.trim(),
      external_id_field: draft.external_id_field.trim(), occurred_at_field: draft.occurred_at_field.trim(),
      source_version_field: draft.source_version_field.trim(), cursor_param: draft.cursor_param.trim(),
      next_cursor_path: draft.next_cursor_path.trim(), interval_minutes: Number(draft.interval_minutes) || 15,
      product_fields, headers, token: draft.token || null, username: draft.username || null, password: draft.password || null,
      token_mode: draft.token_mode, username_mode: draft.username_mode, password_mode: draft.password_mode,
      headers_mode: draft.headers_mode,
    };
  };

  const updateDraft = <K extends keyof ConfigDraft>(key: K, value: ConfigDraft[K]) => setDraft((old) => ({ ...old, [key]: value }));

  const saveIdentity = async (active = integration?.is_active) => {
    if (!integration) return;
    setSaving(true);
    try {
      const updated = await integrationsApi.update(id, { name: name.trim(), is_active: active });
      setIntegration(updated); setName(updated.name); toast.success('Integração atualizada.');
    } catch (error) { toast.error(message(error, 'Não foi possível atualizar a integração.')); }
    finally { setSaving(false); }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const saved = await integrationsApi.saveConfig(id, configPayload());
      setDraft((old) => ({ ...old, token: '', username: '', password: '', token_mode: 'keep', username_mode: 'keep', password_mode: 'keep', headers_mode: 'keep', headers: JSON.stringify(Object.fromEntries(saved.header_keys.map((key) => [key, ''])), null, 2) }));
      toast.success('Configuração e mapeamento salvos.');
    } catch (error) { toast.error(message(error, error instanceof Error ? error.message : 'Erro ao salvar.')); }
    finally { setSaving(false); }
  };

  const testUnsaved = async () => {
    setTesting(true); setTestResult(null);
    try { setTestResult(await integrationsApi.testConnection(id, configPayload())); }
    catch (error) { toast.error(message(error, error instanceof Error ? error.message : 'Erro no teste.')); }
    finally { setTesting(false); }
  };

  const executeDryRun = async () => {
    setTesting(true); setDryRun(null);
    try { setDryRun(await integrationsApi.dryRun(id, { entity: dryEntity, config: configPayload(), sample_size: 10 })); }
    catch (error) { toast.error(message(error, error instanceof Error ? error.message : 'Erro no dry-run.')); }
    finally { setTesting(false); }
  };

  const trigger = async (entity?: SyncEntity) => {
    setRunning(true);
    try {
      if (entity) await integrationsApi.trigger(id, entity); else await integrationsApi.triggerAll(id);
      toast.success(entity ? 'Sincronização agendada.' : 'Sincronização completa agendada.');
      setRunPage(1); await loadRuns(1);
    } catch (error) { toast.error(message(error, 'Não foi possível agendar a sincronização.')); }
    finally { setRunning(false); }
  };

  const replay = async (run: Run) => {
    const reason = window.prompt('Motivo do replay (opcional):') ?? undefined;
    try { await integrationsApi.replay(id, run.id, reason); toast.success('Replay agendado.'); await loadRuns(1); }
    catch (error) { toast.error(message(error, 'Não foi possível repetir a execução.')); }
  };

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1500);
  };

  if (loading) return <div className="flex justify-center py-20 text-muted-foreground"><Loader2 className="mr-2 animate-spin" /> Carregando integração…</div>;
  if (!integration) return <div className="p-8">Integração não encontrada.</div>;
  const webhookUrl = `${API_BASE_URL}/webhooks/${integration.id}`;

  return <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><Button variant="ghost" size="icon" onClick={() => navigate('/empresa/integracoes')}><ArrowLeft /></Button><div><h1 className="text-2xl font-bold">{integration.name}</h1><p className="text-sm text-muted-foreground">{integration.type} · criada em {formatIntegrationDate(integration.created_at)}</p></div></div>
      <div className="flex gap-2">{canRun && integration.type === 'api' && <><Button variant="outline" onClick={() => void trigger('stock')} disabled={running}>Sync estoque</Button><Button onClick={() => void trigger()} disabled={running}><Play className="mr-2 h-4 w-4" />Sync completa</Button></>}</div>
    </div>

    <Tabs defaultValue="overview">
      <TabsList><TabsTrigger value="overview">Visão geral</TabsTrigger>{integration.type === 'api' && <TabsTrigger value="connector">Connector e mapeamento</TabsTrigger>}<TabsTrigger value="runs">Execuções</TabsTrigger>{integration.type === 'webhook' && <TabsTrigger value="webhook">Webhook</TabsTrigger>}{integration.type === 'agent' && <TabsTrigger value="agent">Agente</TabsTrigger>}</TabsList>
      <TabsContent value="overview" className="mt-4">
        <Card><CardHeader><CardTitle>Identificação e status</CardTitle></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} /></div><div className="flex items-center justify-between rounded-md border p-3"><div><p className="font-medium">{integration.is_active ? 'Integração ativa' : 'Integração desativada'}</p><p className="text-xs text-muted-foreground">Integrações desativadas não recebem processamento automático.</p></div>{canManage && <Button variant={integration.is_active ? 'destructive' : 'default'} onClick={() => void saveIdentity(!integration.is_active)} disabled={saving}>{integration.is_active ? 'Desativar' : 'Ativar'}</Button>}</div>{canManage && <Button onClick={() => void saveIdentity()} disabled={saving || name.trim().length < 3}><Save className="mr-2 h-4 w-4" />Salvar nome</Button>}</CardContent></Card>
      </TabsContent>

      {integration.type === 'api' && <TabsContent value="connector" className="mt-4 space-y-4">
        {!canSecrets ? <Card><CardContent className="p-6 text-sm text-muted-foreground">A permissão integrations:secrets é necessária para editar o connector.</CardContent></Card> : !configLoaded ? <Loader2 className="animate-spin" /> : <>
          <Card><CardHeader><CardTitle>Endpoint e autenticação</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><Field label="URL base"><Input value={draft.base_url} onChange={(e) => updateDraft('base_url', e.target.value)} placeholder="https://api.erp.com" /></Field><Field label="Caminho"><Input value={draft.path} onChange={(e) => updateDraft('path', e.target.value)} /></Field><Field label="Autenticação"><Select value={draft.auth_type} onValueChange={(v) => updateDraft('auth_type', v as ConfigDraft['auth_type'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem autenticação</SelectItem><SelectItem value="bearer">Bearer token</SelectItem><SelectItem value="basic">Usuário e senha</SelectItem></SelectContent></Select></Field><Field label="Data path"><Input value={draft.data_path} onChange={(e) => updateDraft('data_path', e.target.value)} placeholder="data.items" /></Field>{draft.auth_type === 'bearer' && <SecretField label="Token" mode={draft.token_mode} value={draft.token} onMode={(v) => updateDraft('token_mode', v)} onValue={(v) => updateDraft('token', v)} />}{draft.auth_type === 'basic' && <><SecretField label="Usuário" mode={draft.username_mode} value={draft.username} onMode={(v) => updateDraft('username_mode', v)} onValue={(v) => updateDraft('username', v)} /><SecretField label="Senha" mode={draft.password_mode} value={draft.password} onMode={(v) => updateDraft('password_mode', v)} onValue={(v) => updateDraft('password', v)} /></>}</CardContent></Card>
          <Card><CardHeader><CardTitle>Mapeamento</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 md:grid-cols-3"><Field label="SKU"><Input value={draft.sku_field} onChange={(e) => updateDraft('sku_field', e.target.value)} /></Field><Field label="Estoque"><Input value={draft.stock_field} onChange={(e) => updateDraft('stock_field', e.target.value)} /></Field><Field label="ID externo"><Input value={draft.external_id_field} onChange={(e) => updateDraft('external_id_field', e.target.value)} /></Field></div><Field label="Campos de produto (JSON canônico → caminho externo)"><Textarea rows={10} value={draft.product_fields} onChange={(e) => updateDraft('product_fields', e.target.value)} className="font-mono text-xs" /></Field><div className="grid gap-3 md:grid-cols-2"><SecretField label="Cabeçalhos adicionais (JSON)" mode={draft.headers_mode} value={draft.headers} onMode={(v) => updateDraft('headers_mode', v)} onValue={(v) => updateDraft('headers', v)} textarea /><Field label="Intervalo (minutos)"><Input type="number" value={draft.interval_minutes} onChange={(e) => updateDraft('interval_minutes', e.target.value)} /></Field></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void testUnsaved()} disabled={testing || !canRun}><TestTube2 className="mr-2 h-4 w-4" />Testar sem salvar</Button><Select value={dryEntity} onValueChange={(v) => setDryEntity(v as SyncEntity)}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="stock">Estoque</SelectItem><SelectItem value="products">Produtos</SelectItem></SelectContent></Select><Button variant="outline" onClick={() => void executeDryRun()} disabled={testing || !canRun}>Dry-run</Button><Button onClick={() => void saveConfig()} disabled={saving}><Save className="mr-2 h-4 w-4" />Salvar configuração</Button></div>{testResult && <ResultBox ok={testResult.ok} text={`${testResult.message} HTTP ${testResult.status_code ?? '—'}`} />}</CardContent></Card>
          {dryRun && <Card><CardHeader><CardTitle>Resultado do dry-run</CardTitle></CardHeader><CardContent><ResultBox ok={dryRun.ok} text={dryRun.message} /><div className="mt-3 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">#</th><th className="p-2">Registro canônico</th></tr></thead><tbody>{dryRun.sample.map((row, index) => <tr key={index} className="border-t"><td className="p-2">{index + 1}</td><td className="p-2 font-mono">{JSON.stringify(row)}</td></tr>)}</tbody></table></div>{dryRun.details.map((item, index) => <p key={index} className="mt-1 text-xs text-red-600">{String(item.error ?? item.code ?? 'Erro')}</p>)}</CardContent></Card>}
        </>}
      </TabsContent>}

      <TabsContent value="runs" className="mt-4 space-y-3"><div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => void loadRuns()}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button></div>{runs?.items.map((run) => <Card key={run.id}><CardContent className="p-4"><div className="flex flex-wrap items-center justify-between gap-2"><button className="text-left" onClick={() => setSelectedRun(selectedRun?.id === run.id ? null : run)}><p className="font-medium">{run.entity} · {run.trigger}</p><p className="text-xs text-muted-foreground">{formatIntegrationDate(run.created_at)} · {formatDuration(run.duration_ms)}</p></button><div className="flex items-center gap-2"><span className="text-xs">{run.processed} processados · {run.errors} erros</span><RunStatusBadge status={run.status} />{canRun && terminalStatuses.has(run.status) && <Button variant="ghost" size="sm" onClick={() => void replay(run)}><RotateCcw className="mr-1 h-3 w-3" />Replay</Button>}</div></div>{selectedRun?.id === run.id && <div className="mt-3 border-t pt-3 text-xs"><p>{run.message ?? 'Sem mensagem.'}</p><p className="mt-1 text-muted-foreground">Recebidos {run.items_received} · criados {run.created_count} · atualizados {run.updated_count} · inalterados {run.unchanged_count} · obsoletos {run.stale_count}</p>{run.item_errors?.map((item, index) => <p key={index} className="mt-1 text-red-600">{String(item.sku ?? '')} {String(item.error ?? item.code ?? 'Erro')}</p>)}</div>}</CardContent></Card>)}{runs && <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Página {runs.page} de {runs.pages} · {runs.total} execução(ões)</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={runs.page <= 1} onClick={() => { const p = runs.page - 1; setRunPage(p); void loadRuns(p); }}>Anterior</Button><Button variant="outline" size="sm" disabled={runs.page >= runs.pages} onClick={() => { const p = runs.page + 1; setRunPage(p); void loadRuns(p); }}>Próxima</Button></div></div>}</TabsContent>

      {integration.type === 'webhook' && <TabsContent value="webhook" className="mt-4"><Card><CardHeader><CardTitle>Setup do webhook</CardTitle></CardHeader><CardContent className="space-y-4"><Field label="URL"><div className="flex gap-2"><Input readOnly value={webhookUrl} className="font-mono text-xs" /><Button variant="outline" onClick={() => void copy(webhookUrl)}>{copied ? <Check /> : <Copy />}</Button></div></Field><div className="rounded-md border p-3 text-sm"><p>Headers obrigatórios:</p><code className="mt-2 block text-xs">X-Webhook-Timestamp: unix_timestamp<br />X-Webhook-Signature: sha256=HMAC_SHA256(timestamp.integration_id.corpo_bruto)<br />X-Idempotency-Key: identificador-unico</code><p className="mt-2 text-muted-foreground">Eventos: stock.sync, product.sync e financial.sync.</p></div>{webhookStatus && <p className="text-sm">Segredo: {webhookStatus.configured ? 'configurado' : 'não configurado'} · rotação {formatIntegrationDate(webhookStatus.rotated_at)}</p>}{canSecrets && <Button onClick={async () => { const created = await integrationsApi.rotateWebhookSecret(id); setNewWebhookSecret(created.secret); setWebhookStatus(await integrationsApi.webhookStatus(id)); }}><KeyRound className="mr-2 h-4 w-4" />Gerar/rotacionar segredo</Button>}{newWebhookSecret && <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3"><p className="text-sm font-medium">Copie agora; o segredo não será mostrado novamente.</p><div className="mt-2 flex gap-2"><Input readOnly value={newWebhookSecret} className="font-mono" /><Button variant="outline" onClick={() => void copy(newWebhookSecret)}><Copy /></Button></div></div>}</CardContent></Card></TabsContent>}

      {integration.type === 'agent' && <TabsContent value="agent" className="mt-4"><Card><CardHeader><CardTitle>Chave do agente</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm">Status: {agentKey?.is_active ? `ativa (${agentKey.prefix}…)` : 'não configurada'}</p>{canSecrets && <div className="flex gap-2"><Button onClick={async () => { const key = await integrationsApi.issueAgentKey(id); setNewAgentKey(key.api_key); setAgentKey(await integrationsApi.agentKey(id)); }}><KeyRound className="mr-2 h-4 w-4" />Gerar/rotacionar</Button>{agentKey?.is_active && <Button variant="destructive" onClick={async () => { await integrationsApi.revokeAgentKey(id); setAgentKey(await integrationsApi.agentKey(id)); setNewAgentKey(null); }}>Revogar</Button>}</div>}{newAgentKey && <div className="rounded-md border border-amber-500/30 p-3"><p className="text-sm font-medium">Copie agora; esta chave aparece uma única vez.</p><div className="mt-2 flex gap-2"><Input readOnly value={newAgentKey} className="font-mono" /><Button variant="outline" onClick={() => void copy(newAgentKey)}><Copy /></Button></div></div>}</CardContent></Card></TabsContent>}
    </Tabs>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function ResultBox({ ok, text }: { ok: boolean; text: string }) { return <div className={`rounded-md p-3 text-sm ${ok ? 'bg-green-500/10 text-green-700' : 'bg-red-500/10 text-red-700'}`}>{text}</div>; }
function SecretField({ label, mode, value, onMode, onValue, textarea = false }: { label: string; mode: SecretMode; value: string; onMode: (v: SecretMode) => void; onValue: (v: string) => void; textarea?: boolean }) { return <Field label={label}><div className="flex gap-2"><Select value={mode} onValueChange={(v) => onMode(v as SecretMode)}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="keep">Manter</SelectItem><SelectItem value="replace">Substituir</SelectItem><SelectItem value="clear">Limpar</SelectItem></SelectContent></Select>{mode === 'replace' && (textarea ? <Textarea value={value} onChange={(e) => onValue(e.target.value)} className="font-mono text-xs" /> : <Input type="password" value={value} onChange={(e) => onValue(e.target.value)} autoComplete="new-password" />)}</div></Field>; }
