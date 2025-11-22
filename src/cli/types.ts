/**
 * CLI固有の型定義
 *
 * 手動再送やウォーターマーク操作CLIで使用される型定義。
 */

/**
 * 再送結果
 *
 * 個別ファイルの再送処理結果を表す。
 */
export interface ResendResult {
  /**
   * 再送対象ファイル名
   */
  filename: string

  /**
   * 再送成功/失敗
   */
  success: boolean

  /**
   * 送信レコード数
   */
  recordCount: number

  /**
   * 失敗時のエラーメッセージ
   */
  error?: string
}

/**
 * 再送サマリー
 *
 * 全体の再送処理結果サマリーを表す。
 */
export interface ResendSummary {
  /**
   * 再送成功したファイル一覧
   */
  successful: ResendResult[]

  /**
   * 再送失敗したファイル一覧
   */
  failed: ResendResult[]

  /**
   * 合計レコード数
   */
  totalRecords: number
}

/**
 * 失敗ファイル情報
 *
 * 失敗ファイル一覧表示時に使用する情報。
 */
export interface FailedFileInfo {
  /**
   * ファイル名
   */
  filename: string

  /**
   * レコード数
   */
  recordCount: number

  /**
   * 初回試行日時（ISO 8601形式）
   */
  firstAttempt: string

  /**
   * 最終エラーメッセージ
   */
  lastError: string
}
