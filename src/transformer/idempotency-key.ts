/**
 * レコード単位の冪等キー生成パラメータ
 */
export interface RecordKeyParams {
  date: string
  app_id: string
  provider: string
  model: string
}

/**
 * レコード単位の冪等キーを生成する
 * キー形式: {date}_{app_id}_{provider}_{model}
 *
 * @param params レコードキー生成パラメータ
 * @returns 冪等キー文字列
 */
export function generateRecordIdempotencyKey(params: RecordKeyParams): string {
  return `${params.date}_${params.app_id}_${params.provider}_${params.model}`
}
