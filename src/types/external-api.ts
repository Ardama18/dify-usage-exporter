import { z } from 'zod'

export const externalApiRecordSchema = z.object({
  // 必須フィールド
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  app_id: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  input_tokens: z.number().int().min(0),
  output_tokens: z.number().int().min(0),
  total_tokens: z.number().int().min(0),

  // 冪等キー
  idempotency_key: z.string().min(1),

  // オプションフィールド
  app_name: z.string().optional(),
  user_id: z.string().optional(),

  // メタデータ
  transformed_at: z.string().datetime(),
})

export type ExternalApiRecord = z.infer<typeof externalApiRecordSchema>
