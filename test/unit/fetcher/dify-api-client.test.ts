/**
 * DifyApiClient 単体テスト
 *
 * Dify Console APIとのHTTP通信、メール/パスワードログイン認証、指数バックオフリトライの動作を検証する。
 * ADR 002（リトライポリシー）、ADR 007（HTTPクライアント）に準拠。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Logger } from '../../../src/logger/winston-logger.js'
import type { EnvConfig } from '../../../src/types/env.js'

// axiosをモック
vi.mock('axios', async () => {
  const createMock = vi.fn()
  const getMock = vi.fn()
  const postMock = vi.fn()

  const axiosInstance = {
    get: getMock,
    post: postMock,
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

  // ログイン用のSet-Cookieヘッダーを含むレスポンス
  postMock.mockResolvedValue({
    data: { result: 'success' },
    headers: {
      'set-cookie': [
        '__Host-access_token=mock-access-token; Path=/; Secure; HttpOnly',
        '__Host-csrf_token=mock-csrf-token; Path=/; Secure; HttpOnly',
        '__Host-refresh_token=mock-refresh-token; Path=/; Secure; HttpOnly',
      ],
    },
  })

  return {
    default: {
      create: createMock,
      post: postMock,
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
      DIFY_EMAIL: 'test@example.com',
      DIFY_PASSWORD: 'test-password',
      EXTERNAL_API_URL: 'https://external.api',
      EXTERNAL_API_TOKEN: 'external-token',
      CRON_SCHEDULE: '0 0 * * *',
      LOG_LEVEL: 'info',
      GRACEFUL_SHUTDOWN_TIMEOUT: 30,
      MAX_RETRY: 3,
      NODE_ENV: 'test',
      DIFY_FETCH_PAGE_SIZE: 100,
      DIFY_FETCH_DAYS: 30,
      DIFY_FETCH_TIMEOUT_MS: 30000,
      DIFY_FETCH_RETRY_COUNT: 3,
      DIFY_FETCH_RETRY_DELAY_MS: 1000,
      WATERMARK_FILE_PATH: 'data/watermark.json',
      WATERMARK_ENABLED: true,
    } as EnvConfig

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

  describe('ログイン機能', () => {
    it('初回fetchApps時にログインが実行される', async () => {
      const axios = await import('axios')
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      const getMock = vi.fn().mockResolvedValue({
        data: {
          data: [],
          has_more: false,
        },
      })

      const axiosInstance = axios.default.create()
      axiosInstance.get = getMock

      const client = createDifyApiClient({ config, logger })

      await client.fetchApps()

      // ログインAPIが呼ばれることを確認（axios.postが呼ばれる）
      expect(axios.default.post).toHaveBeenCalled()
    })

    it('ログイン成功後にSet-Cookieヘッダーからトークンが抽出される', async () => {
      const axios = await import('axios')
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      const getMock = vi.fn().mockResolvedValue({
        data: {
          data: [],
          has_more: false,
        },
      })

      const axiosInstance = axios.default.create()
      axiosInstance.get = getMock

      const client = createDifyApiClient({ config, logger })
      await client.fetchApps()

      // ログインAPIが呼ばれることを確認
      expect(axios.default.post).toHaveBeenCalledWith(
        'https://api.dify.ai/console/api/login',
        expect.objectContaining({
          email: 'test@example.com',
          password: 'test-password',
        }),
        expect.any(Object),
      )

      // ログイン成功のログが出力されることを確認
      expect(logger.info).toHaveBeenCalledWith('Difyログイン成功')
    })
  })

  describe('axiosインスタンス設定', () => {
    it('baseURLが正しく設定される', async () => {
      const axios = await import('axios')
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      const getMock = vi.fn().mockResolvedValue({
        data: { data: [], has_more: false },
      })
      const axiosInstance = axios.default.create()
      axiosInstance.get = getMock

      const client = createDifyApiClient({ config, logger })
      await client.fetchApps()

      expect(axios.default.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.dify.ai',
        }),
      )
    })

    it('タイムアウトが環境変数の値で設定される', async () => {
      const axios = await import('axios')
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      const getMock = vi.fn().mockResolvedValue({
        data: { data: [], has_more: false },
      })
      const axiosInstance = axios.default.create()
      axiosInstance.get = getMock

      const client = createDifyApiClient({ config, logger })
      await client.fetchApps()

      expect(axios.default.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 30000,
        }),
      )
    })

    it('Content-Typeがapplication/jsonに設定される', async () => {
      const axios = await import('axios')
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      const getMock = vi.fn().mockResolvedValue({
        data: { data: [], has_more: false },
      })
      const axiosInstance = axios.default.create()
      axiosInstance.get = getMock

      const client = createDifyApiClient({ config, logger })
      await client.fetchApps()

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

      const getMock = vi.fn().mockResolvedValue({
        data: { data: [], has_more: false },
      })
      const axiosInstance = axios.default.create()
      axiosInstance.get = getMock

      const client = createDifyApiClient({ config, logger })
      await client.fetchApps()

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
      const axios = await import('axios')
      const axiosRetry = await import('axios-retry')
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      const getMock = vi.fn().mockResolvedValue({
        data: { data: [], has_more: false },
      })
      const axiosInstance = axios.default.create()
      axiosInstance.get = getMock

      const client = createDifyApiClient({ config, logger })
      await client.fetchApps()

      expect(axiosRetry.default).toHaveBeenCalled()
    })

    it('リトライ回数が環境変数の値で設定される', async () => {
      const axios = await import('axios')
      const axiosRetry = await import('axios-retry')
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      const getMock = vi.fn().mockResolvedValue({
        data: { data: [], has_more: false },
      })
      const axiosInstance = axios.default.create()
      axiosInstance.get = getMock

      const client = createDifyApiClient({ config, logger })
      await client.fetchApps()

      expect(axiosRetry.default).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          retries: 3,
        }),
      )
    })
  })

  describe('リトライ条件', () => {
    it('ネットワークエラーはリトライ対象', async () => {
      const axios = await import('axios')
      const axiosRetry = await import('axios-retry')
      const axiosRetryMock = axiosRetry.default as ReturnType<typeof vi.fn>
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      const getMock = vi.fn().mockResolvedValue({
        data: { data: [], has_more: false },
      })
      const axiosInstance = axios.default.create()
      axiosInstance.get = getMock

      // isNetworkOrIdempotentRequestErrorがtrueを返すように設定
      vi.mocked(axiosRetry.isNetworkOrIdempotentRequestError).mockReturnValue(true)

      const client = createDifyApiClient({ config, logger })
      await client.fetchApps()

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
      const axios = await import('axios')
      const axiosRetry = await import('axios-retry')
      const axiosRetryMock = axiosRetry.default as ReturnType<typeof vi.fn>
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      const getMock = vi.fn().mockResolvedValue({
        data: { data: [], has_more: false },
      })
      const axiosInstance = axios.default.create()
      axiosInstance.get = getMock

      vi.mocked(axiosRetry.isNetworkOrIdempotentRequestError).mockReturnValue(false)

      const client = createDifyApiClient({ config, logger })
      await client.fetchApps()

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
      const axios = await import('axios')
      const axiosRetry = await import('axios-retry')
      const axiosRetryMock = axiosRetry.default as ReturnType<typeof vi.fn>
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      const getMock = vi.fn().mockResolvedValue({
        data: { data: [], has_more: false },
      })
      const axiosInstance = axios.default.create()
      axiosInstance.get = getMock

      vi.mocked(axiosRetry.isNetworkOrIdempotentRequestError).mockReturnValue(false)

      const client = createDifyApiClient({ config, logger })
      await client.fetchApps()

      const retryConfig = axiosRetryMock.mock.calls[0][1]
      const retryCondition = retryConfig.retryCondition as (error: {
        response?: { status: number }
      }) => boolean

      expect(retryCondition({ response: { status: 429 } })).toBe(true)
    })

    it('400/401/403/404エラーはリトライ対象外', async () => {
      const axios = await import('axios')
      const axiosRetry = await import('axios-retry')
      const axiosRetryMock = axiosRetry.default as ReturnType<typeof vi.fn>
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      const getMock = vi.fn().mockResolvedValue({
        data: { data: [], has_more: false },
      })
      const axiosInstance = axios.default.create()
      axiosInstance.get = getMock

      vi.mocked(axiosRetry.isNetworkOrIdempotentRequestError).mockReturnValue(false)

      const client = createDifyApiClient({ config, logger })
      await client.fetchApps()

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
      const axios = await import('axios')
      const axiosRetry = await import('axios-retry')
      const axiosRetryMock = axiosRetry.default as ReturnType<typeof vi.fn>
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      const getMock = vi.fn().mockResolvedValue({
        data: { data: [], has_more: false },
      })
      const axiosInstance = axios.default.create()
      axiosInstance.get = getMock

      const client = createDifyApiClient({ config, logger })
      await client.fetchApps()

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
      const axios = await import('axios')
      const axiosRetry = await import('axios-retry')
      const axiosRetryMock = axiosRetry.default as ReturnType<typeof vi.fn>
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      const getMock = vi.fn().mockResolvedValue({
        data: { data: [], has_more: false },
      })
      const axiosInstance = axios.default.create()
      axiosInstance.get = getMock

      const client = createDifyApiClient({ config, logger })
      await client.fetchApps()

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
      const axios = await import('axios')
      const axiosRetry = await import('axios-retry')
      const axiosRetryMock = axiosRetry.default as ReturnType<typeof vi.fn>
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      const getMock = vi.fn().mockResolvedValue({
        data: { data: [], has_more: false },
      })
      const axiosInstance = axios.default.create()
      axiosInstance.get = getMock

      const client = createDifyApiClient({ config, logger })
      await client.fetchApps()

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

      const getMock = vi.fn().mockResolvedValue({
        data: { data: [], has_more: false },
      })
      const axiosInstance = axios.default.create()
      axiosInstance.get = getMock

      const client = createDifyApiClient({ config, logger })
      await client.fetchApps()

      expect(axiosInstance.interceptors.request.use).toHaveBeenCalled()
    })

    it('レスポンスインターセプターが設定される', async () => {
      const axios = await import('axios')
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      const getMock = vi.fn().mockResolvedValue({
        data: { data: [], has_more: false },
      })
      const axiosInstance = axios.default.create()
      axiosInstance.get = getMock

      const client = createDifyApiClient({ config, logger })
      await client.fetchApps()

      expect(axiosInstance.interceptors.response.use).toHaveBeenCalled()
    })
  })

  describe('fetchApps', () => {
    it('/console/api/appsを呼び出す', async () => {
      const axios = await import('axios')
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      const getMock = vi.fn().mockResolvedValue({
        data: {
          data: [
            { id: 'app-1', name: 'App 1', mode: 'chat' },
            { id: 'app-2', name: 'App 2', mode: 'completion' },
          ],
          has_more: false,
        },
      })

      const axiosInstance = axios.default.create()
      axiosInstance.get = getMock

      const client = createDifyApiClient({ config, logger })

      const result = await client.fetchApps()

      expect(getMock).toHaveBeenCalledWith(
        '/console/api/apps',
        expect.objectContaining({
          params: { page: 1, limit: 100 },
        }),
      )
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('app-1')
    })

    it('ページネーションで全アプリを取得する', async () => {
      const axios = await import('axios')
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      const getMock = vi
        .fn()
        .mockResolvedValueOnce({
          data: {
            data: [{ id: 'app-1', name: 'App 1', mode: 'chat' }],
            has_more: true,
          },
        })
        .mockResolvedValueOnce({
          data: {
            data: [{ id: 'app-2', name: 'App 2', mode: 'chat' }],
            has_more: false,
          },
        })

      const axiosInstance = axios.default.create()
      axiosInstance.get = getMock

      const client = createDifyApiClient({ config, logger })

      const result = await client.fetchApps()

      expect(getMock).toHaveBeenCalledTimes(2)
      expect(result).toHaveLength(2)
    })
  })

  describe('fetchAppTokenCosts', () => {
    it('/console/api/apps/{appId}/statistics/token-costsを呼び出す', async () => {
      const axios = await import('axios')
      const { createDifyApiClient } = await import('../../../src/fetcher/dify-api-client.js')

      const getMock = vi.fn().mockResolvedValue({
        data: {
          data: [{ date: '2024-01-15', token_count: 100, total_price: '0.001', currency: 'USD' }],
        },
      })

      const axiosInstance = axios.default.create()
      axiosInstance.get = getMock

      const client = createDifyApiClient({ config, logger })

      const result = await client.fetchAppTokenCosts({
        appId: 'app-123',
        start: '2024-01-01 00:00',
        end: '2024-01-31 23:59',
      })

      expect(getMock).toHaveBeenCalledWith(
        '/console/api/apps/app-123/statistics/token-costs',
        expect.objectContaining({
          params: {
            start: '2024-01-01 00:00',
            end: '2024-01-31 23:59',
          },
        }),
      )
      expect(result.data).toHaveLength(1)
      expect(result.data[0].token_count).toBe(100)
    })
  })
})
