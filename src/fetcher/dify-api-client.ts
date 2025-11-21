/**
 * Dify APIクライアント
 *
 * Dify Console APIとのHTTP通信を行う。
 * Bearer Token認証、指数バックオフリトライ、Retry-Afterヘッダー対応を実装。
 * ADR 002（リトライポリシー）、ADR 007（HTTPクライアント）に準拠。
 */

import axios, { type AxiosError } from 'axios'
import axiosRetry from 'axios-retry'
import type { Logger } from '../logger/winston-logger.js'
import type { DifyUsageResponse } from '../types/dify-usage.js'
import type { EnvConfig } from '../types/env.js'

/**
 * DifyApiClient作成時の依存関係
 */
export interface DifyApiClientDeps {
  config: EnvConfig
  logger: Logger
}

/**
 * 使用量データ取得パラメータ
 */
export interface FetchUsageParams {
  /** 取得開始日（YYYY-MM-DD形式） */
  startDate: string
  /** 取得終了日（YYYY-MM-DD形式） */
  endDate: string
  /** ページ番号（1から開始） */
  page: number
  /** 1ページあたりの取得件数 */
  limit: number
}

/**
 * DifyApiClientインターフェース
 */
export interface DifyApiClient {
  /**
   * 使用量データを取得する
   * @param params 取得パラメータ
   * @returns 使用量データレスポンス
   */
  fetchUsage(params: FetchUsageParams): Promise<DifyUsageResponse>
}

/**
 * DifyApiClientを作成する
 * @param deps 依存関係（EnvConfig, Logger）
 * @returns DifyApiClientインスタンス
 */
export function createDifyApiClient(deps: DifyApiClientDeps): DifyApiClient {
  const { config, logger } = deps

  // axiosインスタンス作成
  const client = axios.create({
    baseURL: config.DIFY_API_BASE_URL,
    timeout: config.DIFY_FETCH_TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.DIFY_API_TOKEN}`,
      'User-Agent': 'dify-usage-exporter/1.0.0',
    },
  })

  // リトライ設定（ADR 002, ADR 007準拠）
  axiosRetry(client, {
    retries: config.DIFY_FETCH_RETRY_COUNT,
    retryDelay: (retryCount, error) => {
      // 429の場合はRetry-Afterヘッダーを考慮
      const retryAfter = error.response?.headers['retry-after']
      if (retryAfter) {
        const delayMs = Number.parseInt(retryAfter, 10) * 1000
        logger.info('Retry-Afterヘッダー検出', { retryAfter, delayMs })
        return delayMs
      }
      // 指数バックオフ（1秒 → 2秒 → 4秒）
      return axiosRetry.exponentialDelay(retryCount)
    },
    retryCondition: (error: AxiosError) => {
      // リトライ対象: ネットワークエラー、5xx、429
      if (axiosRetry.isNetworkOrIdempotentRequestError(error)) {
        return true
      }
      const status = error.response?.status
      return status === 429 || (status !== undefined && status >= 500)
    },
    onRetry: (retryCount, error) => {
      logger.warn('APIリトライ試行', {
        retryCount,
        error: error.message,
        status: error.response?.status,
      })
    },
  })

  // リクエストインターセプター（ログ出力、トークンマスク）
  client.interceptors.request.use((requestConfig) => {
    logger.debug('APIリクエスト送信', {
      method: requestConfig.method,
      url: requestConfig.url,
      params: requestConfig.params,
    })
    return requestConfig
  })

  // レスポンスインターセプター（ログ出力）
  client.interceptors.response.use(
    (response) => {
      logger.debug('APIレスポンス受信', {
        status: response.status,
        url: response.config.url,
      })
      return response
    },
    (error: AxiosError) => {
      logger.error('APIエラー', {
        status: error.response?.status,
        message: error.message,
        url: error.config?.url,
      })
      throw error
    },
  )

  return {
    async fetchUsage(params: FetchUsageParams): Promise<DifyUsageResponse> {
      const response = await client.get<DifyUsageResponse>('/console/api/usage', {
        params: {
          start_date: params.startDate,
          end_date: params.endDate,
          page: params.page,
          limit: params.limit,
        },
      })
      return response.data
    },
  }
}
