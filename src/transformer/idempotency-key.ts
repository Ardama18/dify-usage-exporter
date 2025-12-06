import crypto from 'node:crypto'
import type { NormalizedModelRecord } from '../normalizer/normalizer.js'

/**
 * レコード単位の冪等キー生成パラメータ
 * token-costsエンドポイントのレスポンスに対応
 */
export interface RecordKeyParams {
  date: string
  app_id: string
}

/**
 * レコード単位の冪等キーを生成する
 * キー形式: {date}_{app_id}
 *
 * @param params レコードキー生成パラメータ
 * @returns 冪等キー文字列
 */
export function generateRecordIdempotencyKey(params: RecordKeyParams): string {
  return `${params.date}_${params.app_id}`
}

/**
 * バッチ単位の冪等キーを生成する
 * ソートして順序に依存しない決定的なキー生成
 *
 * @param recordKeys レコードキーの配列
 * @returns SHA256ハッシュ（64文字16進数）、空配列の場合は空文字列
 */
export function generateBatchIdempotencyKey(recordKeys: string[]): string {
  if (recordKeys.length === 0) {
    return ''
  }

  // ソートして順序に依存しない決定的なキー生成
  const sorted = [...recordKeys].sort()
  const concatenated = sorted.join(',')

  return crypto.createHash('sha256').update(concatenated).digest('hex')
}

/**
 * source_event_idを生成する
 * フォーマット: dify-{usage_date}-{provider}-{model}-{hash12}
 *
 * ハッシュ対象データ:
 * - usage_date: 使用日（YYYY-MM-DD）
 * - provider: プロバイダー名（正規化済み）
 * - model: モデル名（正規化済み）
 * - app_id: DifyアプリケーションID（undefinedの場合は空文字列）
 * - user_id: ユーザーID（undefinedの場合は空文字列）
 *
 * @param record - 正規化されたモデルレコード
 * @returns source_event_id（例: dify-2025-11-29-anthropic-claude-3-5-sonnet-20241022-a3f2e1b9c4d5）
 */
export const generateSourceEventId = (record: NormalizedModelRecord): string => {
  // ハッシュ計算用のデータを結合
  // app_id/user_idがundefinedの場合は空文字列を使用
  const hashInput = [
    record.usageDate,
    record.provider,
    record.model,
    record.appId ?? '',
    record.userId ?? '',
  ].join('|')

  // SHA256ハッシュを生成
  const hash = crypto.createHash('sha256').update(hashInput, 'utf8').digest('hex').substring(0, 12) // 最初の12文字を使用

  // フォーマット: dify-{usage_date}-{provider}-{model}-{hash12}
  return `dify-${record.usageDate}-${record.provider}-${record.model}-${hash}`
}
