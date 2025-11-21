/**
 * Dify API関連のカスタムエラークラス
 *
 * Dify Console APIとの通信で発生するエラーを構造化して処理するためのクラス。
 * エラーコード、HTTPステータス、詳細情報を保持し、適切なログ出力とリトライ判断を可能にする。
 */
export class DifyApiError extends Error {
  /**
   * DifyApiErrorインスタンスを作成する
   * @param message - エラーメッセージ
   * @param code - エラーコード（DIFY_API_ERROR_CODESから選択）
   * @param statusCode - HTTPステータスコード（オプション）
   * @param details - 追加の詳細情報（オプション）
   */
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'DifyApiError'
  }
}

/**
 * Dify APIエラーコード定義
 *
 * 各エラーコードは特定のエラー状況に対応し、リトライ制御やログ出力に使用される。
 */
export const DIFY_API_ERROR_CODES = {
  /** ネットワーク接続エラー（リトライ対象） */
  NETWORK_ERROR: 'DIFY_NETWORK_ERROR',
  /** 認証エラー - 401（リトライ対象外） */
  AUTHENTICATION_ERROR: 'DIFY_AUTH_ERROR',
  /** 権限エラー - 403（リトライ対象外） */
  PERMISSION_ERROR: 'DIFY_PERMISSION_ERROR',
  /** バリデーションエラー - 400（リトライ対象外） */
  VALIDATION_ERROR: 'DIFY_VALIDATION_ERROR',
  /** Rate Limitエラー - 429（リトライ対象、Retry-After考慮） */
  RATE_LIMIT_ERROR: 'DIFY_RATE_LIMIT_ERROR',
  /** サーバーエラー - 5xx（リトライ対象） */
  SERVER_ERROR: 'DIFY_SERVER_ERROR',
  /** Not Foundエラー - 404（リトライ対象外） */
  NOT_FOUND_ERROR: 'DIFY_NOT_FOUND_ERROR',
  /** Bad Requestエラー - 400（リトライ対象外） */
  BAD_REQUEST_ERROR: 'DIFY_BAD_REQUEST_ERROR',
} as const

/**
 * Dify APIエラーコードの型
 * DIFY_API_ERROR_CODESオブジェクトの値のユニオン型
 */
export type DifyApiErrorCode = (typeof DIFY_API_ERROR_CODES)[keyof typeof DIFY_API_ERROR_CODES]
