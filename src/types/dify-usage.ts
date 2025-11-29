import { z } from 'zod'

/**
 * /console/api/statistics/workspace/costs のレスポンス形式
 * ワークスペース全体のコスト統計を取得
 */

// 日別コストデータ
export const difyDailyCostSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  total: z.number().min(0),
  api: z.number().min(0).optional(),
  storage: z.number().min(0).optional(),
  bandwidth: z.number().min(0).optional(),
})

// ワークスペースコストAPIレスポンス
export const difyWorkspaceCostsResponseSchema = z.object({
  total_cost: z.number().min(0),
  currency: z.string().default('USD'),
  costs_by_type: z
    .object({
      api: z.number().min(0).optional(),
      storage: z.number().min(0).optional(),
      bandwidth: z.number().min(0).optional(),
    })
    .optional(),
  costs_by_date: z.array(difyDailyCostSchema).optional(),
})

export type DifyDailyCost = z.infer<typeof difyDailyCostSchema>
export type DifyWorkspaceCostsResponse = z.infer<typeof difyWorkspaceCostsResponseSchema>

/**
 * /console/api/apps/{app_id}/statistics/token-costs のレスポンス形式
 * アプリ毎のトークンコスト統計（将来的に使用する可能性あり）
 */
export const difyAppTokenCostSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  token_count: z.number().int().min(0),
  total_price: z.string(), // "0.0197304" のような文字列
  currency: z.string().default('USD'),
})

export const difyAppTokenCostsResponseSchema = z.object({
  data: z.array(difyAppTokenCostSchema),
})

export type DifyAppTokenCost = z.infer<typeof difyAppTokenCostSchema>
export type DifyAppTokenCostsResponse = z.infer<typeof difyAppTokenCostsResponseSchema>

/**
 * 後方互換性のためのエイリアス（既存コードが使用している場合）
 */
export const difyUsageRecordSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  app_id: z.string().min(1).optional(),
  app_name: z.string().optional(),
  provider: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  input_tokens: z.number().int().min(0).optional(),
  output_tokens: z.number().int().min(0).optional(),
  total_tokens: z.number().int().min(0).optional(),
  total_cost: z.number().min(0).optional(),
  currency: z.string().optional(),
  user_id: z.string().optional(),
})

export const difyUsageResponseSchema = z.object({
  data: z.array(difyUsageRecordSchema),
  total: z.number().int().min(0).optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).optional(),
  has_more: z.boolean().optional(),
})

export type DifyUsageRecord = z.infer<typeof difyUsageRecordSchema>
export type DifyUsageResponse = z.infer<typeof difyUsageResponseSchema>

/**
 * /console/api/apps/{app_id}/chat-conversations のレスポンス形式
 * 会話一覧を取得（ユーザー別集計用）
 */
export const difyConversationSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  status: z.string().optional(),
  from_source: z.string().optional(), // 'api' | 'console' など
  from_end_user_id: z.string().nullable().optional(),
  from_end_user_session_id: z.string().nullable().optional(),
  from_account_id: z.string().nullable().optional(),
  from_account_name: z.string().nullable().optional(),
  read_at: z.string().nullable().optional(),
  created_at: z.number(), // Unix timestamp
  updated_at: z.number().optional(),
  message_count: z.number().optional(),
  annotation_reply_count: z.number().optional(),
})

export const difyConversationsResponseSchema = z.object({
  data: z.array(difyConversationSchema),
  has_more: z.boolean(),
  limit: z.number(),
})

export type DifyConversation = z.infer<typeof difyConversationSchema>
export type DifyConversationsResponse = z.infer<typeof difyConversationsResponseSchema>

/**
 * /console/api/apps/{app_id}/chat-messages のレスポンス形式
 * メッセージ一覧を取得（トークン情報含む）
 */
export const difyMessageSchema = z.object({
  id: z.string(),
  conversation_id: z.string(),
  query: z.string().optional(),
  answer: z.string().optional(),
  message_tokens: z.number().default(0), // 入力トークン数
  answer_tokens: z.number().default(0), // 出力トークン数
  provider_response_latency: z.number().optional(),
  from_source: z.string().optional(),
  from_end_user_id: z.string().nullable().optional(),
  from_account_id: z.string().nullable().optional(),
  created_at: z.number(), // Unix timestamp
  status: z.string().optional(),
  error: z.string().nullable().optional(),
})

export const difyMessagesResponseSchema = z.object({
  data: z.array(difyMessageSchema),
  has_more: z.boolean(),
  limit: z.number(),
})

export type DifyMessage = z.infer<typeof difyMessageSchema>
export type DifyMessagesResponse = z.infer<typeof difyMessagesResponseSchema>
