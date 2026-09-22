import { api } from '../../lib/api';
import type {
  ApiPullConfigInput, ERPIntegrationUpdate, IntegrationDryRunRequest, SyncEntity,
} from './contracts';
import {
  agentKeyCreatedSchema, agentKeyReadSchema, configSchema, dashboardSchema, dryRunSchema,
  integrationListSchema, integrationSchema, runListSchema, runPageSchema, runSchema,
  testResultSchema, webhookCreatedSchema, webhookStatusSchema,
} from './schemas';

export const integrationsApi = {
  async list() { return integrationListSchema.parse(await api.get('/integrations')); },
  async create(name: string, type: string) {
    return integrationSchema.parse(await api.post('/integrations', { name, type }));
  },
  async dashboard() { return dashboardSchema.parse(await api.get('/integrations/dashboard')); },
  async get(id: string) { return integrationSchema.parse(await api.get(`/integrations/${id}`)); },
  async update(id: string, body: ERPIntegrationUpdate) {
    return integrationSchema.parse(await api.patch(`/integrations/${id}`, body));
  },
  async getConfig(id: string) { return configSchema.parse(await api.get(`/integrations/${id}/api-config`)); },
  async saveConfig(id: string, body: ApiPullConfigInput) {
    return configSchema.parse(await api.put(`/integrations/${id}/api-config`, body));
  },
  async testConnection(id: string, body?: ApiPullConfigInput) {
    return testResultSchema.parse(await api.post(`/integrations/${id}/api-config/test`, body));
  },
  async dryRun(id: string, body: IntegrationDryRunRequest) {
    return dryRunSchema.parse(await api.post(`/integrations/${id}/api-config/dry-run`, body));
  },
  async trigger(id: string, entity: SyncEntity) {
    return runSchema.parse(await api.post(`/integrations/${id}/sync`, { entity }));
  },
  async triggerAll(id: string) { return runListSchema.parse(await api.post(`/integrations/${id}/sync-all`)); },
  async pull(id: string) { return runSchema.parse(await api.post(`/integrations/${id}/api-config/pull`)); },
  async importStock(id: string, form: FormData) {
    return runSchema.parse(await api.upload(`/integrations/${id}/stock/import`, form));
  },
  async runs(id: string, page = 1, pageSize = 20) {
    return runPageSchema.parse(await api.get(`/integrations/${id}/runs`, { page, page_size: pageSize }));
  },
  async run(id: string, runId: string) {
    return runSchema.parse(await api.get(`/integrations/${id}/runs/${runId}`));
  },
  async replay(id: string, runId: string, reason?: string) {
    return runSchema.parse(await api.post(`/integrations/${id}/syncs/${runId}/replay`, { reason }));
  },
  async webhookStatus(id: string) {
    return webhookStatusSchema.parse(await api.get(`/integrations/${id}/webhook-secret`));
  },
  async rotateWebhookSecret(id: string) {
    return webhookCreatedSchema.parse(await api.post(`/integrations/${id}/webhook-secret`));
  },
  async agentKey(id: string) { return agentKeyReadSchema.parse(await api.get(`/integrations/${id}/agent-key`)); },
  async issueAgentKey(id: string) { return agentKeyCreatedSchema.parse(await api.post(`/integrations/${id}/agent-key`)); },
  async revokeAgentKey(id: string) { await api.delete(`/integrations/${id}/agent-key`); },
};
