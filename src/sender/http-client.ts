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

    // 2. axios-retry設定
    axiosRetry(this.client, {
      retries: config.MAX_RETRIES,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error: AxiosError) => {
        // リトライ対象: ネットワークエラー、5xx、429
        if (axiosRetry.isNetworkOrIdempotentRequestError(error)) {
          return true
        }
        const status = error.response?.status
        return status === 429 || (status !== undefined && status >= 500)
      },
      onRetry: (retryCount, error, requestConfig) => {
        this.logger.warn('Retrying request', {
          retryCount,
          url: requestConfig.url,
          status: error.response?.status,
          message: error.message,
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
        this.logger.error('HTTP Error', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message,
          retryCount: error.config?.['axios-retry']?.retryCount,
        })
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
