import type { DifyUsageRecord } from '../types/dify-usage.js'
import type { ExternalApiRecord } from '../types/external-api.js'

/**
 * Transformerインターフェース
 * DifyUsageRecordをExternalApiRecordに変換するための統一契約
 */
export interface ITransformer {
  /**
   * DifyUsageRecordの配列をExternalApiRecordの配列に変換する
   * @param records 変換対象のDifyUsageRecord配列
   * @returns 変換結果（成功レコード、エラー、統計情報を含む）
   */
  transform(records: DifyUsageRecord[]): TransformResult
}

/**
 * 変換結果
 */
export interface TransformResult {
  /** 変換成功したレコード */
  records: ExternalApiRecord[]
  /** バッチ全体の冪等キー（SHA256） */
  batchIdempotencyKey: string
  /** 変換成功レコード数 */
  successCount: number
  /** 変換失敗レコード数 */
  errorCount: number
  /** 変換エラーの詳細 */
  errors: TransformError[]
}

/**
 * 変換エラー
 */
export interface TransformError {
  /** エラーが発生したレコードの識別情報 */
  recordIdentifier: {
    date: string
    app_id: string
  }
  /** エラーメッセージ */
  message: string
  /** エラーの詳細 */
  details?: Record<string, unknown>
}
