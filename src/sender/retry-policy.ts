/**
 * リトライポリシーユーティリティ
 *
 * リトライ条件判定関数を提供します。
 * - isRetryableError: リトライ対象エラーの判定
 * - isNonRetryableError: リトライ非対象エラーの判定
 * - is409Conflict: 409 Conflictレスポンスの判定
 */

import { AxiosError } from 'axios'

/**
 * リトライ対象のネットワークエラーコード
 */
const NETWORK_ERROR_CODES = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET'] as const

/**
 * リトライ非対象のHTTPステータスコード
 */
const NON_RETRYABLE_STATUS_CODES = [400, 401, 403, 404] as const

/**
 * リトライ対象エラーの判定
 * @param error - エラーオブジェクト
 * @returns リトライすべき場合true
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof AxiosError)) {
    return false
  }

  // ネットワークエラーコードの判定
  if (error.code && NETWORK_ERROR_CODES.includes(error.code as never)) {
    return true
  }

  // レスポンスなし（ネットワーク障害）
  const status = error.response?.status
  if (!status) {
    return true
  }

  // 5xx（サーバーエラー）
  if (status >= 500 && status < 600) {
    return true
  }

  // 429（Too Many Requests）
  if (status === 429) {
    return true
  }

  return false
}

/**
 * リトライ非対象エラーの判定
 * @param error - エラーオブジェクト
 * @returns リトライすべきでない場合true
 */
export function isNonRetryableError(error: unknown): boolean {
  if (!(error instanceof AxiosError)) {
    return false
  }

  const status = error.response?.status
  if (!status) {
    return false
  }

  // 400, 401, 403, 404: クライアントエラー（リトライしても解決しない）
  return NON_RETRYABLE_STATUS_CODES.includes(status as never)
}

/**
 * 409 Conflictレスポンスの判定
 * @param error - エラーオブジェクト
 * @returns 409レスポンスの場合true
 */
export function is409Conflict(error: unknown): boolean {
  if (!(error instanceof AxiosError)) {
    return false
  }
  return error.response?.status === 409
}
