import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Check, Copy, History, KeyRound, Loader2, PlugZap, Plus, Trash2,
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<ERPIntegration[]>('/integrations');
      setIntegrations(data);
      // Resolve o prefixo da chave de cada integração (a chave nunca é devolvida).
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

  // ── Gerar chave do agente (aparece UMA vez) ──
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

  // ── Revogar chave ──
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

  // ── Copiar chave ──
  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar a chave.');
    }
  };

  // ── Abrir histórico de syncs ──
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

  // Descrição do tipo atualmente selecionado (helper text dinâmico).
  const selectedType = INTEGRATION_TYPES.find((t) => t.value === type);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Integrações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Conecte o ERP do cliente ao portal. Cada integração tem uma chave de API
            que o agente usa para enviar o estoque.
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
            Crie uma integração para gerar a chave do agente do cliente.
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
                {/* Chave do agente */}
                <div className="flex flex-wrap items-center gap-2">
                  {keyPrefixes[it.id] ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-mono text-xs">
                        <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                        {keyPrefixes[it.id]}…
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevokeKey(it)}
                        aria-label={`Revogar chave de ${it.name}`}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Revogar
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleGenerateKey(it)}
                      disabled={generating && keyFor?.id === it.id}
                      aria-label={`Gerar chave de ${it.name}`}
                    >
                      <KeyRound className="mr-1 h-3.5 w-3.5" />
                      {generating && keyFor?.id === it.id ? 'Gerando…' : 'Gerar chave de API'}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openSyncs(it)}
                    aria-label={`Ver execuções de ${it.name}`}
                  >
                    <History className="mr-1 h-3.5 w-3.5" /> Execuções
                  </Button>
                </div>
                {!keyPrefixes[it.id] && (
                  <p className="text-xs text-muted-foreground">
                    Sem chave gerada. Gere a chave e configure o agente do cliente para enviar o estoque.
                  </p>
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
              {/* ✅ Dropdown de tipos + texto explicativo dinâmico */}
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