/**
 * HTTPクライアント（External API送信用）
 *
 * axios + axios-retryによるHTTPクライアント実装。
 * リトライポリシー、指数バックオフ、トークンマスクを実装。
 */

import axios, { type AxiosError, type AxiosInstance, type AxiosResponse } from 'axios'
import axiosRetry from 'axios-retry'
import type { Logger } from '../logger/winston-logger.js'
import type { EnvConfig } from '../types/env.js'

/**
 * HTTPクライアントクラス
 * External API送信用のaxiosラッパー
 */
export class HttpClient {
  private readonly client: AxiosInstance

  constructor(
    private readonly logger: Logger,
    config: EnvConfig,
  ) {
    // 1. axiosインスタンス作成
    this.client = axios.create({
      baseURL: config.EXTERNAL_API_URL,
      timeout: config.EXTERNAL_API_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.EXTERNAL_API_TOKEN}`,
        'User-Agent': 'dify-usage-exporter/1.0.0',
      },
    })

    // 2. axios-retry設定（API_Meter新仕様対応: ADR 017準拠）
    axiosRetry(this.client, {
      retries: config.MAX_RETRIES,
      retryDelay: (retryCount, error) => {
        // Retry-Afterヘッダーがある場合は尊重（ADR 017: Retry-Afterヘッダーの尊重）
        const retryAfter = error.response?.headers['retry-after']
        if (retryAfter) {
          const delay = Number.parseInt(retryAfter, 10) * 1000 // 秒→ミリ秒
          if (!Number.isNaN(delay) && delay > 0) {
            this.logger.info('Respecting Retry-After header', { delayMs: delay })
            return delay
          }
        }

        // 指数バックオフ（デフォルト: 1s → 2s → 4s）
        return axiosRetry.exponentialDelay(retryCount, error)
      },
      retryCondition: (error: AxiosError) => {
        const status = error.response?.status

        // 成功扱い（リトライしない）: 200, 201, 204
        if (status && [200, 201, 204].includes(status)) {
          return false
        }

        // リトライ対象: 429（Rate Limit）, 5xx（Server Error）
        if (status === 429 || (status && status >= 500)) {
          return true
        }

        // ネットワークエラー（ECONNREFUSED, ETIMEDOUT等）: リトライ
        if (axiosRetry.isNetworkError(error)) {
          return true
        }

        // その他（400, 401, 403, 404, 422等）: リトライしない
        return false
      },
      onRetry: (retryCount, error, requestConfig) => {
        const delay = 2 ** retryCount // 1s, 2s, 4s
        this.logger.warn('Retrying request', {
          retryCount,
          url: requestConfig.url,
          status: error.response?.status,
          message: error.message,
          nextDelaySeconds: delay,
        })
      },
    })

    // 3. リクエストインターセプター
    this.client.interceptors.request.use((requestConfig) => {
      this.logger.debug('HTTP Request', {
        method: requestConfig.method,
        url: requestConfig.url,
        headers: this.maskToken(requestConfig.headers),
      })

      // デバッグ用: リクエストボディの詳細をログ出力
      if (requestConfig.data) {
        const payload = requestConfig.data as Record<string, unknown>
        this.logger.debug('HTTP Request Body (debug)', {
          tenant_id: payload.tenant_id,
          export_metadata: payload.export_metadata,
          recordCount: Array.isArray(payload.records) ? payload.records.length : 0,
          // 最初のレコードをサンプルとして出力
          sampleRecord:
            Array.isArray(payload.records) && payload.records.length > 0
              ? payload.records[0]
              : null,
        })
      }

      return requestConfig
    })

    // 4. レスポンスインターセプター
    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug('HTTP Response', {
          status: response.status,
          statusText: response.statusText,
        })
        return response
      },
      (error: AxiosError) => {
        const status = error.response?.status
        const retryCount = error.config?.['axios-retry']?.retryCount

        // ステータスコード別のエラーメッセージ詳細化（ADR 017準拠）
        if (status) {
          this.logHttpError(status, error, retryCount)
        } else {
          // ネットワークエラー
          this.logger.error('Network Error', {
            message: error.message,
            code: error.code,
            retryCount,
          })
        }

        throw error
      },
    )
  }

  /**
   * POST送信
   * @param path リクエストパス
   * @param data 送信データ
   * @returns レスポンス
   */
  async post(path: string, data: unknown): Promise<AxiosResponse> {
    return this.client.post(path, data)
  }

  /**
   * HTTPエラーのログ出力（ステータスコード別）
   * ADR 017: エラーハンドリング戦略に準拠
   * @param status HTTPステータスコード
   * @param error Axiosエラー
   * @param retryCount リトライ回数
   */
  private logHttpError(status: number, error: AxiosError, retryCount?: number): void {
    const data = error.response?.data

    switch (status) {
      case 400:
        this.logger.error('Bad Request (400)', {
          message: 'Invalid request format',
          details: data,
          // デバッグ用: エラーレスポンスの全体をJSON文字列で出力
          fullResponse: JSON.stringify(data, null, 2),
          retryCount,
        })
        break
      case 401:
        this.logger.error('Unauthorized (401)', {
          message: 'Invalid API token',
          hint: 'Check API_METER_TOKEN or EXTERNAL_API_TOKEN environment variable',
          retryCount,
        })
        break
      case 403:
        this.logger.error('Forbidden (403)', {
          message: 'Insufficient permissions',
          details: data,
          retryCount,
        })
        break
      case 404:
        this.logger.error('Not Found (404)', {
          message: 'Endpoint not found',
          url: error.config?.url,
          retryCount,
        })
        break
      case 422:
        this.logger.error('Unprocessable Entity (422)', {
          message: 'Validation error',
          details: data,
          retryCount,
        })
        break
      case 429:
        this.logger.warn('Rate Limit Exceeded (429)', {
          message: 'Too many requests, will retry with exponential backoff',
          retryAfter: error.response?.headers['retry-after'],
          retryCount,
        })
        break
      default:
        // 5xx or その他
        this.logger.error('HTTP Error', {
          status,
          statusText: error.response?.statusText,
          message: error.message,
          details: data,
          retryCount,
        })
    }
  }

  /**
   * トークンマスク
   * ログ出力時に認証トークンをマスクする
   * @param headers HTTPヘッダー
   * @returns マスク済みヘッダー
   */
  private maskToken(headers: Record<string, unknown>): Record<string, unknown> {
    const masked = { ...headers }
    if (masked.Authorization && typeof masked.Authorization === 'string') {
      masked.Authorization = 'Bearer ***MASKED***'
    }
    return masked
  }
}
