import { z } from 'zod';

const nullableDate = z.string().nullable();
const itemErrorSchema = z.record(z.string(), z.unknown());

export const integrationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
});

export const runSchema = z.object({
  id: z.string().uuid(), integration_id: z.string().uuid(), entity: z.string(), status: z.enum(['pending', 'running', 'success', 'partial', 'failed', 'dead_letter']),
  processed: z.number(), errors: z.number(), started_at: nullableDate, finished_at: nullableDate,
  message: z.string().nullable(), attempt_count: z.number(), max_attempts: z.number(),
  next_retry_at: nullableDate, terminal_at: nullableDate, replay_of_id: z.string().uuid().nullable(),
  trigger: z.string(), correlation_id: z.string().nullable().optional(), items_received: z.number(),
  created_count: z.number(), updated_count: z.number(), unchanged_count: z.number(),
  stale_count: z.number(), skipped_count: z.number(), item_errors: z.array(itemErrorSchema).nullable(),
  item_errors_truncated: z.number(), duration_ms: z.number().nullable(), error_code: z.string().nullable(),
  error_class: z.string().nullable().optional(), retryable: z.boolean().nullable(),
  last_attempt_at: nullableDate.optional(), request_size_bytes: z.number().nullable().optional(), created_at: z.string(),
});

const alertSchema = z.object({
  id: z.string().uuid(), integration_id: z.string().uuid(), kind: z.string(), status: z.string(),
  severity: z.string(), message: z.string(), consecutive_failures: z.number(), opened_at: z.string(),
  last_seen_at: z.string(), resolved_at: nullableDate, last_run_id: z.string().uuid().nullable(),
});

const dashboardItemSchema = z.object({
  integration_id: z.string().uuid(), name: z.string(), type: z.string(), is_active: z.boolean(),
  health: z.enum(['healthy', 'warning', 'failing', 'never_run']), last_status: z.string().nullable(),
  last_run_at: nullableDate, last_success_at: nullableDate, last_failure_at: nullableDate,
  consecutive_failures: z.number(), average_duration_ms: z.number().nullable(), pending_runs: z.number(), open_alerts: z.number(),
});

export const dashboardSchema = z.object({
  generated_at: z.string(), integrations: z.array(dashboardItemSchema), alerts: z.array(alertSchema),
});

export const configSchema = z.object({
  base_url: z.string(), path: z.string(), auth_type: z.string(), data_path: z.string(),
  sku_field: z.string(), stock_field: z.string(), external_id_field: z.string(),
  occurred_at_field: z.string(), source_version_field: z.string(), cursor_param: z.string(),
  next_cursor_path: z.string(), product_fields: z.record(z.string(), z.string()), interval_minutes: z.number(),
  token_set: z.boolean(), username_set: z.boolean(), password_set: z.boolean(), header_keys: z.array(z.string()),
});

export const testResultSchema = z.object({
  ok: z.boolean(), status_code: z.number().nullable(), items_found: z.number(), message: z.string(),
});

export const dryRunSchema = z.object({
  ok: z.boolean(), entity: z.string(), received: z.number(), valid: z.number(), errors: z.number(),
  message: z.string(), sample: z.array(z.record(z.string(), z.unknown())), details: z.array(itemErrorSchema),
});

export const webhookStatusSchema = z.object({
  configured: z.boolean(), rotated_at: nullableDate, previous_valid_until: nullableDate,
});

export const webhookCreatedSchema = z.object({
  secret: z.string(), rotated_at: z.string(), previous_valid_until: nullableDate,
});

export const agentKeyReadSchema = z.object({ prefix: z.string().nullable(), is_active: z.boolean() });
export const agentKeyCreatedSchema = z.object({ prefix: z.string(), api_key: z.string() });

export const integrationListSchema = z.array(integrationSchema);
export const runListSchema = z.array(runSchema);
export const runPageSchema = z.object({
  items: runListSchema, total: z.number(), page: z.number(), page_size: z.number(), pages: z.number(),
});
