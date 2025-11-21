/**
 * DifyApiClient 単体テスト
 *
 * Dify Console APIとのHTTP通信、Bearer Token認証、指数バックオフリトライの動作を検証する。
 * ADR 002（リトライポリシー）、ADR 007（HTTPクライアント）に準拠。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Logger } from '../../../src/logger/winston-logger.js'
import type { EnvConfig } from '../../../src/types/env.js'

// axiosをモック
vi.mock('axios', async () => {
  const createMock = vi.fn()
  const getMock = vi.fn()

  const axiosInstance = {
    get: getMock,
    interceptors: {
      request: {
        use: vi.fn(),
      },
      response: {
        use: vi.fn(),
      },
    },
    defaults: {
      headers: {
        common: {},
      },
    },
  }

  createMock.mockReturnValue(axiosInstance)

  return {
    default: {
      create: createMock,
    },
  }
})

// axios-retryをモック
vi.mock('axios-retry', async () => {
  const mockFn = vi.fn()
  const isNetworkFn = vi.fn().mockReturnValue(false)
  const exponentialFn = vi.fn().mockImplementation((retryCount: number) => {
    return 2 ** (retryCount - 1) * 1000
  })

  // デフォルトエクスポートにも静的メソッドを追加
  Object.assign(mockFn, {
    isNetworkOrIdempotentRequestError: isNetworkFn,
    exponentialDelay: exponentialFn,
  })

  return {
    default: mockFn,
    isNetworkOrIdempotentRequestError: isNetworkFn,
    exponentialDelay: exponentialFn,
  }
})

describe('DifyApiClient', () => {
  let config: EnvConfig
  let logger: Logger

  beforeEach(() => {
    vi.clearAllMocks()

    config = {
      DIFY_API_BASE_URL: 'https://api.dify.ai',
      DIFY_API_TOKEN: 'test-api-token',
      EXTERNAL_API_URL: 'https://external.api',
      EXTERNAL_API_TOKEN: 'external-token',
      CRON_SCHEDULE: '0 0 * * *',
      LOG_LEVEL: 'info',
      GRACEFUL_SHUTDOWN_TIMEOUT: 30,
      MAX_RETRY: 3,
      NODE_ENV: 'test',
      DIFY_FETCH_PAGE_SIZE: 100,
      DIFY_INITIAL_FETCH_DAYS: 30,
      DIFY_FETCH_TIMEOUT_MS: 30000,
      DIFY_FETCH_RETRY_COUNT: 3,
      DIFY_FETCH_RETRY_DELAY_MS: 1000,
      WATERMARK_FILE_PATH: 'data/watermark.json',
    }

    logger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      child: vi.fn().mockReturnThis(),
    }
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe('axiosインスタンス設定', () => {
    it('baseURLが正しく設定される', async () => {
      const axios = await import('axios')
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      createDifyApiClient({ config, logger })

      expect(axios.default.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.dify.ai',
        }),
      )
    })

    it('タイムアウトが環境変数の値で設定される', async () => {
      const axios = await import('axios')
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      createDifyApiClient({ config, logger })

      expect(axios.default.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 30000,
        }),
      )
    })

    it('Authorization Bearerヘッダーが正しく設定される', async () => {
      const axios = await import('axios')
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      createDifyApiClient({ config, logger })

      expect(axios.default.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-token',
          }),
        }),
      )
    })

    it('Content-Typeがapplication/jsonに設定される', async () => {
      const axios = await import('axios')
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      createDifyApiClient({ config, logger })

      expect(axios.default.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      )
    })

    it('User-Agentが設定される', async () => {
      const axios = await import('axios')
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      createDifyApiClient({ config, logger })

      expect(axios.default.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'dify-usage-exporter/1.0.0',
          }),
        }),
      )
    })
  })

  describe('リトライ設定', () => {
    it('axios-retryが設定される', async () => {
      const axiosRetry = await import('axios-retry')
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      createDifyApiClient({ config, logger })

      expect(axiosRetry.default).toHaveBeenCalled()
    })

    it('リトライ回数が環境変数の値で設定される', async () => {
      const axiosRetry = await import('axios-retry')
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      createDifyApiClient({ config, logger })

      expect(axiosRetry.default).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          retries: 3,
        }),
      )
    })

    it('retryDelayが設定される', async () => {
      const axiosRetry = await import('axios-retry')
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      createDifyApiClient({ config, logger })

      expect(axiosRetry.default).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          retryDelay: expect.any(Function),
        }),
      )
    })

    it('retryConditionが設定される', async () => {
      const axiosRetry = await import('axios-retry')
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      createDifyApiClient({ config, logger })

      expect(axiosRetry.default).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          retryCondition: expect.any(Function),
        }),
      )
    })

    it('onRetryが設定される', async () => {
      const axiosRetry = await import('axios-retry')
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      createDifyApiClient({ config, logger })

      expect(axiosRetry.default).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          onRetry: expect.any(Function),
        }),
      )
    })
  })

  describe('リトライ条件', () => {
    it('ネットワークエラーはリトライ対象', async () => {
      const axiosRetry = await import('axios-retry')
      const axiosRetryMock = axiosRetry.default as ReturnType<typeof vi.fn>
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      // isNetworkOrIdempotentRequestErrorがtrueを返すように設定
      vi.mocked(axiosRetry.isNetworkOrIdempotentRequestError).mockReturnValue(true)

      createDifyApiClient({ config, logger })

      // retryConditionを取得して実行
      const retryConfig = axiosRetryMock.mock.calls[0][1]
      const retryCondition = retryConfig.retryCondition as (error: {
        response?: { status: number }
      }) => boolean

      const networkError = {
        code: 'ECONNREFUSED',
        message: 'Network Error',
      }

      const result = retryCondition(networkError)
      expect(result).toBe(true)
    })

    it('5xxエラーはリトライ対象', async () => {
      const axiosRetry = await import('axios-retry')
      const axiosRetryMock = axiosRetry.default as ReturnType<typeof vi.fn>
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      vi.mocked(axiosRetry.isNetworkOrIdempotentRequestError).mockReturnValue(false)

      createDifyApiClient({ config, logger })

      const retryConfig = axiosRetryMock.mock.calls[0][1]
      const retryCondition = retryConfig.retryCondition as (error: {
        response?: { status: number }
      }) => boolean

      expect(retryCondition({ response: { status: 500 } })).toBe(true)
      expect(retryCondition({ response: { status: 502 } })).toBe(true)
      expect(retryCondition({ response: { status: 503 } })).toBe(true)
      expect(retryCondition({ response: { status: 504 } })).toBe(true)
    })

    it('429エラーはリトライ対象', async () => {
      const axiosRetry = await import('axios-retry')
      const axiosRetryMock = axiosRetry.default as ReturnType<typeof vi.fn>
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      vi.mocked(axiosRetry.isNetworkOrIdempotentRequestError).mockReturnValue(false)

      createDifyApiClient({ config, logger })

      const retryConfig = axiosRetryMock.mock.calls[0][1]
      const retryCondition = retryConfig.retryCondition as (error: {
        response?: { status: number }
      }) => boolean

      expect(retryCondition({ response: { status: 429 } })).toBe(true)
    })

    it('400/401/403/404エラーはリトライ対象外', async () => {
      const axiosRetry = await import('axios-retry')
      const axiosRetryMock = axiosRetry.default as ReturnType<typeof vi.fn>
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      vi.mocked(axiosRetry.isNetworkOrIdempotentRequestError).mockReturnValue(false)

      createDifyApiClient({ config, logger })

      const retryConfig = axiosRetryMock.mock.calls[0][1]
      const retryCondition = retryConfig.retryCondition as (error: {
        response?: { status: number }
      }) => boolean

      expect(retryCondition({ response: { status: 400 } })).toBe(false)
      expect(retryCondition({ response: { status: 401 } })).toBe(false)
      expect(retryCondition({ response: { status: 403 } })).toBe(false)
      expect(retryCondition({ response: { status: 404 } })).toBe(false)
    })
  })

  describe('リトライディレイ', () => {
    it('指数バックオフが適用される（1秒→2秒→4秒）', async () => {
      const axiosRetry = await import('axios-retry')
      const axiosRetryMock = axiosRetry.default as ReturnType<typeof vi.fn>
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      createDifyApiClient({ config, logger })

      const retryConfig = axiosRetryMock.mock.calls[0][1]
      const retryDelay = retryConfig.retryDelay as (
        retryCount: number,
        error: { response?: { headers: Record<string, string> } },
      ) => number

      // Retry-Afterヘッダーがない場合
      const error = { response: { headers: {} } }

      // axiosRetry.exponentialDelayが呼ばれることを確認
      retryDelay(1, error)
      expect(axiosRetry.exponentialDelay).toHaveBeenCalledWith(1)
    })

    it('Retry-Afterヘッダーがある場合はその値を使用する', async () => {
      const axiosRetry = await import('axios-retry')
      const axiosRetryMock = axiosRetry.default as ReturnType<typeof vi.fn>
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      createDifyApiClient({ config, logger })

      const retryConfig = axiosRetryMock.mock.calls[0][1]
      const retryDelay = retryConfig.retryDelay as (
        retryCount: number,
        error: { response?: { headers: Record<string, string> } },
      ) => number

      // Retry-Afterヘッダーが5秒を指定
      const error = {
        response: {
          headers: {
            'retry-after': '5',
          },
        },
      }

      const delay = retryDelay(1, error)
      expect(delay).toBe(5000)
      expect(logger.info).toHaveBeenCalledWith(
        'Retry-Afterヘッダー検出',
        expect.objectContaining({
          retryAfter: '5',
          delayMs: 5000,
        }),
      )
    })
  })

  describe('onRetryコールバック', () => {
    it('リトライ時にログが出力される', async () => {
      const axiosRetry = await import('axios-retry')
      const axiosRetryMock = axiosRetry.default as ReturnType<typeof vi.fn>
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      createDifyApiClient({ config, logger })

      const retryConfig = axiosRetryMock.mock.calls[0][1]
      const onRetry = retryConfig.onRetry as (
        retryCount: number,
        error: { message: string; response?: { status: number } },
      ) => void

      const error = {
        message: 'Request failed',
        response: { status: 503 },
      }

      onRetry(2, error)

      expect(logger.warn).toHaveBeenCalledWith(
        'APIリトライ試行',
        expect.objectContaining({
          retryCount: 2,
          error: 'Request failed',
          status: 503,
        }),
      )
    })
  })

  describe('インターセプター', () => {
    it('リクエストインターセプターが設定される', async () => {
      const axios = await import('axios')
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      const axiosInstance = axios.default.create()
      createDifyApiClient({ config, logger })

      expect(axiosInstance.interceptors.request.use).toHaveBeenCalled()
    })

    it('レスポンスインターセプターが設定される', async () => {
      const axios = await import('axios')
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      const axiosInstance = axios.default.create()
      createDifyApiClient({ config, logger })

      expect(axiosInstance.interceptors.response.use).toHaveBeenCalled()
    })
  })

  describe('fetchUsage', () => {
    it('/console/api/usageを呼び出す', async () => {
      const axios = await import('axios')
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      const getMock = vi.fn().mockResolvedValue({
        data: {
          data: [],
          total: 0,
          page: 1,
          limit: 100,
          has_more: false,
        },
      })

      const axiosInstance = axios.default.create()
      axiosInstance.get = getMock

      const client = createDifyApiClient({ config, logger })

      await client.fetchUsage({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        page: 1,
        limit: 100,
      })

      expect(getMock).toHaveBeenCalledWith(
        '/console/api/usage',
        expect.objectContaining({
          params: {
            start_date: '2024-01-01',
            end_date: '2024-01-31',
            page: 1,
            limit: 100,
          },
        }),
      )
    })

    it('レスポンスデータを返す', async () => {
      const axios = await import('axios')
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      const mockResponse = {
        data: [
          {
            date: '2024-01-15',
            app_id: 'app-123',
            provider: 'openai',
            model: 'gpt-4',
            input_tokens: 100,
            output_tokens: 50,
            total_tokens: 150,
          },
        ],
        total: 1,
        page: 1,
        limit: 100,
        has_more: false,
      }

      const getMock = vi.fn().mockResolvedValue({ data: mockResponse })
      const axiosInstance = axios.default.create()
      axiosInstance.get = getMock

      const client = createDifyApiClient({ config, logger })

      const result = await client.fetchUsage({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        page: 1,
        limit: 100,
      })

      expect(result).toEqual(mockResponse)
    })
  })

  describe('パラメータ構築', () => {
    it('日付パラメータが正しい形式で渡される', async () => {
      const axios = await import('axios')
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      const getMock = vi.fn().mockResolvedValue({
        data: {
          data: [],
          total: 0,
          page: 1,
          limit: 100,
          has_more: false,
        },
      })

      const axiosInstance = axios.default.create()
      axiosInstance.get = getMock

      const client = createDifyApiClient({ config, logger })

      await client.fetchUsage({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        page: 1,
        limit: 100,
      })

      expect(getMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          params: expect.objectContaining({
            start_date: '2024-01-01',
            end_date: '2024-01-31',
          }),
        }),
      )
    })

    it('ページネーションパラメータが正しく渡される', async () => {
      const axios = await import('axios')
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      const getMock = vi.fn().mockResolvedValue({
        data: {
          data: [],
          total: 0,
          page: 5,
          limit: 50,
          has_more: false,
        },
      })

      const axiosInstance = axios.default.create()
      axiosInstance.get = getMock

      const client = createDifyApiClient({ config, logger })

      await client.fetchUsage({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        page: 5,
        limit: 50,
      })

      expect(getMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          params: expect.objectContaining({
            page: 5,
            limit: 50,
          }),
        }),
      )
    })
  })
})
