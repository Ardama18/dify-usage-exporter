import { z } from 'zod'

/**
 * API_Meter使用量レコードのスキーマ（個別レコード）
 * API_Meter新仕様（2025-12-04版）に準拠
 */
export const apiMeterUsageRecordSchema = z
  .object({
    usage_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    provider: z.string().min(1),
    model: z.string().min(1),
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
    total_tokens: z.number().int().nonnegative(),
    request_count: z.number().int().nonnegative(),
    cost_actual: z.number().nonnegative(),
    currency: z.string().default('USD'),
    metadata: z.object({
      source_system: z.literal('dify'),
      source_event_id: z.string().min(1),
      source_app_id: z.string().optional(),
      source_app_name: z.string().optional(),
      aggregation_method: z.string().default('daily_sum'),
      time_range: z
        .object({
          start: z.string().datetime(),
          end: z.string().datetime(),
        })
        .optional(),
    }),
  })
  .refine((data) => data.total_tokens === data.input_tokens + data.output_tokens, {
    message: 'total_tokens must equal input_tokens + output_tokens',
    path: ['total_tokens'],
  })

export type ApiMeterUsageRecord = z.infer<typeof apiMeterUsageRecordSchema>

/**
 * API_Meterリクエストのスキーマ（トップレベル）
 * tenant_id + export_metadata + recordsの階層構造
 */
export const apiMeterRequestSchema = z.object({
  tenant_id: z.string().uuid(),
  export_metadata: z.object({
    exporter_version: z.string().default('1.1.0'),
    export_timestamp: z.string().datetime(),
    aggregation_period: z.enum(['daily', 'weekly', 'monthly']),
    source_system: z.literal('dify'),
    date_range: z.object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    }),
  }),
  records: z.array(apiMeterUsageRecordSchema).min(1),
})

export type ApiMeterRequest = z.infer<typeof apiMeterRequestSchema>
