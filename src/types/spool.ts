import { z } from 'zod'
import { apiMeterRequestSchema } from './api-meter-schema.js'
import { externalApiRecordSchema } from './external-api.js'

/**
 * 新形式スプールファイルのZodスキーマ (v2.0.0)
 * ApiMeterRequest形式でデータを保存
 */
export const spoolFileSchema = z.object({
  /** スプールファイルバージョン */
  version: z.literal('2.0.0'),
  /** API_Meterリクエストデータ */
  data: apiMeterRequestSchema,
  /** スプールファイル作成日時（ISO 8601形式） */
  createdAt: z.string().datetime(),
  /** リトライ回数（0から開始） */
  retryCount: z.number().int().nonnegative().default(0),
})

/**
 * 新形式スプールファイルの型定義 (v2.0.0)
 */
export type SpoolFile = z.infer<typeof spoolFileSchema>

/**
 * 旧形式スプールファイルのZodスキーマ (v1.0.0)
 * ExternalApiRecord形式でデータを保存（後方互換性のため）
 *
 * @deprecated Use SpoolFile (v2.0.0) instead. This schema is for backward compatibility only.
 */
export const legacySpoolFileSchema = z.object({
  /** スプールファイルバージョン（オプション: v1.0.0以前は未定義） */
  version: z.literal('1.0.0').optional(),
  /** バッチ全体の冪等キー（SHA256ハッシュ） */
  batchIdempotencyKey: z.string().optional(),
  /** 送信対象レコード（ExternalApiRecord形式） */
  records: z.array(externalApiRecordSchema).optional(),
  /** 旧形式データ（配列形式） */
  data: z.array(externalApiRecordSchema).optional(),
  /** 最初の送信試行日時（ISO 8601形式） */
  firstAttempt: z.string().datetime().optional(),
  /** スプールファイル作成日時（ISO 8601形式） */
  createdAt: z.string().datetime(),
  /** リトライ回数（0から開始） */
  retryCount: z.number().int().nonnegative().default(0),
  /** 最後のエラーメッセージ */
  lastError: z.string().optional(),
})

/**
 * 旧形式スプールファイルの型定義 (v1.0.0)
 *
 * @deprecated Use SpoolFile (v2.0.0) instead. This type is for backward compatibility only.
 */
export type LegacySpoolFile = z.infer<typeof legacySpoolFileSchema>
