import { z } from 'zod'

/**
 * 外部APIに送信するレコード形式
 * Difyのtoken-costsエンドポイントから取得したデータを変換したもの
 */
export const externalApiRecordSchema = z.object({
  // 必須フィールド
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  app_id: z.string().min(1),
  app_name: z.string().min(1),
  token_count: z.number().int().min(0),
  total_price: z.string(), // "0.0197304" のような文字列形式
  currency: z.string().default('USD'),

  // 冪等キー
  idempotency_key: z.string().min(1),

  // メタデータ
  transformed_at: z.string().datetime(),
})

export type ExternalApiRecord = z.infer<typeof externalApiRecordSchema>
