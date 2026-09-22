import type { components } from './generated/openapi';

type Schemas = components['schemas'];

export type ERPIntegration = Schemas['ERPIntegrationRead'];
export type ERPIntegrationUpdate = Schemas['ERPIntegrationUpdate'];
export type IntegrationDashboard = Schemas['IntegrationDashboardRead'];
export type IntegrationDashboardItem = Schemas['IntegrationDashboardItem'];
export type IntegrationAlert = Schemas['IntegrationAlertRead'];
export type SyncExecution = Schemas['SyncExecutionRead'];
export type SyncExecutionPage = Schemas['SyncExecutionPage'];
export type ApiPullConfigInput = Schemas['ApiPullConfigIn'];
export type ApiPullConfig = Schemas['ApiPullConfigRead'];
export type ApiPullTestResult = Schemas['ApiPullTestResult'];
export type IntegrationDryRunRequest = Schemas['IntegrationDryRunRequest'];
export type IntegrationDryRunResult = Schemas['IntegrationDryRunResult'];
export type WebhookSecretStatus = Schemas['WebhookSecretRead'];
export type WebhookSecretCreated = Schemas['WebhookSecretCreated'];
export type AgentApiKeyRead = Schemas['AgentApiKeyRead'];
export type AgentApiKeyCreated = Schemas['AgentApiKeyCreated'];

export type SecretMode = 'keep' | 'replace' | 'clear';
export type SyncEntity = 'products' | 'stock';
