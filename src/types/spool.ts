import { z } from 'zod'
import { externalApiRecordSchema } from './external-api.js'

/**
 * スプールファイルのZodスキーマ
 */
export const spoolFileSchema = z.object({
  /** バッチ全体の冪等キー（SHA256ハッシュ） */
  batchIdempotencyKey: z.string(),
  /** 送信対象レコード */
  records: z.array(externalApiRecordSchema),
  /** 最初の送信試行日時（ISO 8601形式） */
  firstAttempt: z.string().datetime(),
  /** リトライ回数（0から開始） */
  retryCount: z.number().int().min(0),
  /** 最後のエラーメッセージ */
  lastError: z.string(),
})

/**
 * スプールファイルの型定義
 *
 * 外部APIへの送信に失敗したレコードをローカルファイルシステムへ
 * 一時保存するためのデータ構造。
 */
export type SpoolFile = z.infer<typeof spoolFileSchema>
