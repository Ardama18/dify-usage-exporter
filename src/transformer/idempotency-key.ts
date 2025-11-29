import crypto from 'node:crypto'

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
