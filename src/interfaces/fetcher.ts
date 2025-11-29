import type { FetchedTokenCostRecord } from '../fetcher/dify-usage-fetcher.js'

/**
 * Fetcherインターフェース
 * Dify APIから使用量データを取得するための統一契約
 */
export interface IFetcher {
  /**
   * 使用量データを取得し、コールバックで処理する
   * @param onRecords 取得したレコードを処理するコールバック
   * @returns 取得結果のサマリー
   */
  fetch(onRecords: (records: FetchedTokenCostRecord[]) => Promise<void>): Promise<FetchResult>
}

/**
 * 取得結果のサマリー
 */
export interface FetchResult {
  /** 取得が成功したかどうか */
  success: boolean
  /** 取得したレコードの総数 */
  totalRecords: number
  /** 取得したページの総数 */
  totalPages: number
  /** 取得期間の開始日（ISO 8601形式） */
  startDate: string
  /** 取得期間の終了日（ISO 8601形式） */
  endDate: string
  /** 取得にかかった時間（ミリ秒） */
  durationMs: number
  /** 発生したエラーのリスト */
  errors: FetchError[]
}

/**
 * 取得エラー
 */
export interface FetchError {
  /** エラーの種別 */
  type: 'validation' | 'api' | 'watermark'
  /** エラーメッセージ */
  message: string
  /** エラーの詳細情報（オプション） */
  details?: Record<string, unknown>
}
