/**
 * DifyUsageFetcher 単体テスト
 *
 * オーケストレーション機能、バリデーション、
 * エラーハンドリングの動作を検証する。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DifyApiClient, DifyApp } from '../../../src/fetcher/dify-api-client.js'
import type { IFetcher } from '../../../src/interfaces/fetcher.js'
import type { Logger } from '../../../src/logger/winston-logger.js'
import type { DifyAppTokenCost, DifyAppTokenCostsResponse } from '../../../src/types/dify-usage.js'
import type { EnvConfig } from '../../../src/types/env.js'
import type { Watermark } from '../../../src/types/watermark.js'
import type { WatermarkManager } from '../../../src/watermark/watermark-manager.js'

describe('DifyUsageFetcher', () => {
  let config: EnvConfig
  let logger: Logger
  let mockClient: DifyApiClient
  let mockWatermarkManager: WatermarkManager
  let fetcher: IFetcher

  beforeEach(async () => {
    vi.clearAllMocks()

    // 日付を固定（テストの再現性のため）
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-20T12:00:00.000Z'))

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
    }

    logger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      child: vi.fn().mockReturnThis(),
    }

    mockClient = {
      fetchApps: vi.fn(),
      fetchAppTokenCosts: vi.fn(),
    }

    mockWatermarkManager = {
      load: vi.fn(),
      update: vi.fn(),
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ヘルパー関数：モックアプリの生成
  function createMockApp(overrides: Partial<DifyApp> = {}): DifyApp {
    return {
      id: 'app-123',
      name: 'Test App',
      mode: 'chat',
      ...overrides,
    }
  }

  // ヘルパー関数：モックトークンコストレコードの生成
  function createMockTokenCost(overrides: Partial<DifyAppTokenCost> = {}): DifyAppTokenCost {
    return {
      date: '2024-01-15',
      token_count: 100,
      total_price: '0.001',
      currency: 'USD',
      ...overrides,
    }
  }

  // ヘルパー関数：モックレスポンスの生成
  function createMockTokenCostsResponse(data: DifyAppTokenCost[] = []): DifyAppTokenCostsResponse {
    return { data }
  }

  describe('オーケストレーション動作', () => {
    it('ウォーターマーク読み込み→アプリ取得→トークンコスト取得→ウォーターマーク更新の順序で実行される', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      const watermark: Watermark = {
        last_fetched_date: '2024-01-15T00:00:00.000Z',
        last_updated_at: '2024-01-15T10:30:00.000Z',
      }
      vi.mocked(mockWatermarkManager.load).mockResolvedValue(watermark)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      const apps = [createMockApp()]
      vi.mocked(mockClient.fetchApps).mockResolvedValue(apps)

      const response = createMockTokenCostsResponse([createMockTokenCost()])
      vi.mocked(mockClient.fetchAppTokenCosts).mockResolvedValue(response)

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      const fetchPromise = fetcher.fetch(onRecords)
      await vi.runAllTimersAsync()
      await fetchPromise

      // Assert
      expect(mockWatermarkManager.load).toHaveBeenCalledTimes(1)
      expect(mockClient.fetchApps).toHaveBeenCalled()
      expect(mockClient.fetchAppTokenCosts).toHaveBeenCalled()
      expect(mockWatermarkManager.update).toHaveBeenCalledTimes(1)

      // 順序の確認
      const loadCallOrder = vi.mocked(mockWatermarkManager.load).mock.invocationCallOrder[0]
      const fetchAppsCallOrder = vi.mocked(mockClient.fetchApps).mock.invocationCallOrder[0]
      const fetchCostsCallOrder = vi.mocked(mockClient.fetchAppTokenCosts).mock.invocationCallOrder[0]
      const updateCallOrder = vi.mocked(mockWatermarkManager.update).mock.invocationCallOrder[0]

      expect(loadCallOrder).toBeLessThan(fetchAppsCallOrder)
      expect(fetchAppsCallOrder).toBeLessThan(fetchCostsCallOrder)
      expect(fetchCostsCallOrder).toBeLessThan(updateCallOrder)
    })

    it('開始日が正しく計算される（初回実行時：ウォーターマーク不存在）', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      const apps = [createMockApp()]
      vi.mocked(mockClient.fetchApps).mockResolvedValue(apps)

      const response = createMockTokenCostsResponse([createMockTokenCost()])
      vi.mocked(mockClient.fetchAppTokenCosts).mockResolvedValue(response)

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      const fetchPromise = fetcher.fetch(onRecords)
      await vi.runAllTimersAsync()
      await fetchPromise

      // Assert - 開始日は30日前（DIFY_FETCH_DAYS）
      expect(mockClient.fetchAppTokenCosts).toHaveBeenCalledWith(
        expect.objectContaining({
          start: expect.stringContaining('2023-12-21'), // 2024-01-20 - 30日
        }),
      )
    })

    it('FetchResultが正しく返却される', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      const apps = [createMockApp()]
      vi.mocked(mockClient.fetchApps).mockResolvedValue(apps)

      const response = createMockTokenCostsResponse([createMockTokenCost(), createMockTokenCost()])
      vi.mocked(mockClient.fetchAppTokenCosts).mockResolvedValue(response)

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      const fetchPromise = fetcher.fetch(onRecords)
      await vi.runAllTimersAsync()
      const result = await fetchPromise

      // Assert
      expect(result.success).toBe(true)
      expect(result.totalRecords).toBe(2)
      expect(result.totalPages).toBe(1) // アプリベースなのでページングは使用しない
      expect(result.errors).toHaveLength(0)
      expect(result.startDate).toBeDefined()
      expect(result.endDate).toBeDefined()
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe('複数アプリ処理', () => {
    it('複数アプリから順番にトークンコストを取得する', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      const apps = [
        createMockApp({ id: 'app-1', name: 'App 1' }),
        createMockApp({ id: 'app-2', name: 'App 2' }),
        createMockApp({ id: 'app-3', name: 'App 3' }),
      ]
      vi.mocked(mockClient.fetchApps).mockResolvedValue(apps)

      vi.mocked(mockClient.fetchAppTokenCosts)
        .mockResolvedValueOnce(createMockTokenCostsResponse([createMockTokenCost()]))
        .mockResolvedValueOnce(createMockTokenCostsResponse([createMockTokenCost(), createMockTokenCost()]))
        .mockResolvedValueOnce(createMockTokenCostsResponse([createMockTokenCost()]))

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      const fetchPromise = fetcher.fetch(onRecords)
      await vi.runAllTimersAsync()
      const result = await fetchPromise

      // Assert
      expect(mockClient.fetchAppTokenCosts).toHaveBeenCalledTimes(3)
      expect(mockClient.fetchAppTokenCosts).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ appId: 'app-1' }),
      )
      expect(mockClient.fetchAppTokenCosts).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ appId: 'app-2' }),
      )
      expect(mockClient.fetchAppTokenCosts).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ appId: 'app-3' }),
      )
      expect(result.totalRecords).toBe(4)
    })

    it('アプリが0件の場合はトークンコスト取得をスキップする', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      vi.mocked(mockClient.fetchApps).mockResolvedValue([])

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      const fetchPromise = fetcher.fetch(onRecords)
      await vi.runAllTimersAsync()
      const result = await fetchPromise

      // Assert
      expect(mockClient.fetchAppTokenCosts).not.toHaveBeenCalled()
      expect(result.totalRecords).toBe(0)
      expect(result.success).toBe(true)
    })
  })

  describe('バリデーション処理', () => {
    it('有効なレコードはonRecordsコールバックに渡される', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      const app = createMockApp({ id: 'app-123', name: 'Test App' })
      vi.mocked(mockClient.fetchApps).mockResolvedValue([app])

      const validRecord = createMockTokenCost()
      const response = createMockTokenCostsResponse([validRecord])
      vi.mocked(mockClient.fetchAppTokenCosts).mockResolvedValue(response)

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      const fetchPromise = fetcher.fetch(onRecords)
      await vi.runAllTimersAsync()
      await fetchPromise

      // Assert - app_idとapp_nameが付加されたレコードが渡される
      expect(onRecords).toHaveBeenCalledWith([
        expect.objectContaining({
          ...validRecord,
          app_id: 'app-123',
          app_name: 'Test App',
        }),
      ])
    })

    it('バリデーションエラーのレコードはスキップされ、エラーログが出力される', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      const app = createMockApp()
      vi.mocked(mockClient.fetchApps).mockResolvedValue([app])

      // 不正なレコード（token_countが負）
      const invalidRecord = {
        date: '2024-01-15',
        token_count: -1, // 不正な値
        total_price: '0.001',
        currency: 'USD',
      } as DifyAppTokenCost

      const validRecord = createMockTokenCost()

      const response = createMockTokenCostsResponse([invalidRecord, validRecord])
      vi.mocked(mockClient.fetchAppTokenCosts).mockResolvedValue(response)

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      const fetchPromise = fetcher.fetch(onRecords)
      await vi.runAllTimersAsync()
      const result = await fetchPromise

      // Assert - 有効なレコードのみ渡される
      expect(onRecords).toHaveBeenCalledWith([
        expect.objectContaining({
          date: validRecord.date,
          token_count: validRecord.token_count,
        }),
      ])
      expect(result.totalRecords).toBe(1)
      expect(result.errors.some((e) => e.type === 'validation')).toBe(true)
    })
  })

  describe('エラーハンドリング', () => {
    it('アプリ一覧取得失敗時にエラーをerrorsに追加する', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      vi.mocked(mockClient.fetchApps).mockRejectedValue(new Error('API Error'))

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      const fetchPromise = fetcher.fetch(onRecords)
      await vi.runAllTimersAsync()
      const result = await fetchPromise

      // Assert
      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].type).toBe('api')
      expect(result.errors[0].message).toContain('アプリ一覧')
      expect(logger.error).toHaveBeenCalled()
    })

    it('1つのアプリでトークンコスト取得失敗しても他のアプリは処理を継続する', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      const apps = [
        createMockApp({ id: 'app-1', name: 'App 1' }),
        createMockApp({ id: 'app-2', name: 'App 2' }),
        createMockApp({ id: 'app-3', name: 'App 3' }),
      ]
      vi.mocked(mockClient.fetchApps).mockResolvedValue(apps)

      vi.mocked(mockClient.fetchAppTokenCosts)
        .mockResolvedValueOnce(createMockTokenCostsResponse([createMockTokenCost()]))
        .mockRejectedValueOnce(new Error('API Error for App 2'))
        .mockResolvedValueOnce(createMockTokenCostsResponse([createMockTokenCost()]))

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      const fetchPromise = fetcher.fetch(onRecords)
      await vi.runAllTimersAsync()
      const result = await fetchPromise

      // Assert
      expect(mockClient.fetchAppTokenCosts).toHaveBeenCalledTimes(3)
      expect(result.success).toBe(false) // エラーがあるのでfalse
      expect(result.totalRecords).toBe(2) // app-1とapp-3のレコード
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toContain('App 2')
    })

    it('0件取得時はウォーターマークを更新しない', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      const apps = [createMockApp()]
      vi.mocked(mockClient.fetchApps).mockResolvedValue(apps)

      const response = createMockTokenCostsResponse([])
      vi.mocked(mockClient.fetchAppTokenCosts).mockResolvedValue(response)

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      const fetchPromise = fetcher.fetch(onRecords)
      await vi.runAllTimersAsync()
      await fetchPromise

      // Assert
      expect(mockWatermarkManager.update).not.toHaveBeenCalled()
    })
  })

  describe('ウォーターマーク更新', () => {
    it('取得完了後にウォーターマークが正しい値で更新される', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      const apps = [createMockApp()]
      vi.mocked(mockClient.fetchApps).mockResolvedValue(apps)

      const response = createMockTokenCostsResponse([createMockTokenCost()])
      vi.mocked(mockClient.fetchAppTokenCosts).mockResolvedValue(response)

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      const fetchPromise = fetcher.fetch(onRecords)
      await vi.runAllTimersAsync()
      await fetchPromise

      // Assert
      expect(mockWatermarkManager.update).toHaveBeenCalledWith(
        expect.objectContaining({
          last_fetched_date: expect.any(String),
          last_updated_at: expect.any(String),
        }),
      )
    })
  })

  describe('onRecordsコールバック', () => {
    it('各アプリの有効なレコードがコールバックに渡される', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      const apps = [
        createMockApp({ id: 'app-1', name: 'App 1' }),
        createMockApp({ id: 'app-2', name: 'App 2' }),
      ]
      vi.mocked(mockClient.fetchApps).mockResolvedValue(apps)

      const record1 = createMockTokenCost({ date: '2024-01-15' })
      const record2 = createMockTokenCost({ date: '2024-01-16' })

      vi.mocked(mockClient.fetchAppTokenCosts)
        .mockResolvedValueOnce(createMockTokenCostsResponse([record1]))
        .mockResolvedValueOnce(createMockTokenCostsResponse([record2]))

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      const fetchPromise = fetcher.fetch(onRecords)
      await vi.runAllTimersAsync()
      await fetchPromise

      // Assert
      expect(onRecords).toHaveBeenCalledTimes(2)
      expect(onRecords).toHaveBeenNthCalledWith(1, [
        expect.objectContaining({
          date: '2024-01-15',
          app_id: 'app-1',
          app_name: 'App 1',
        }),
      ])
      expect(onRecords).toHaveBeenNthCalledWith(2, [
        expect.objectContaining({
          date: '2024-01-16',
          app_id: 'app-2',
          app_name: 'App 2',
        }),
      ])
    })

    it('空のレコードリストの場合はコールバックを呼び出さない', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      const apps = [createMockApp()]
      vi.mocked(mockClient.fetchApps).mockResolvedValue(apps)

      const response = createMockTokenCostsResponse([])
      vi.mocked(mockClient.fetchAppTokenCosts).mockResolvedValue(response)

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      const fetchPromise = fetcher.fetch(onRecords)
      await vi.runAllTimersAsync()
      await fetchPromise

      // Assert
      expect(onRecords).not.toHaveBeenCalled()
    })
  })

  describe('ログ出力', () => {
    it('取得開始時に開始ログが出力される', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      const apps = [createMockApp()]
      vi.mocked(mockClient.fetchApps).mockResolvedValue(apps)

      const response = createMockTokenCostsResponse([createMockTokenCost()])
      vi.mocked(mockClient.fetchAppTokenCosts).mockResolvedValue(response)

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      const fetchPromise = fetcher.fetch(onRecords)
      await vi.runAllTimersAsync()
      await fetchPromise

      // Assert
      expect(logger.info).toHaveBeenCalledWith(
        'Dify使用量取得開始',
        expect.objectContaining({
          startDate: expect.any(String),
          endDate: expect.any(String),
        }),
      )
    })

    it('取得完了時に完了ログが出力される', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      const apps = [createMockApp()]
      vi.mocked(mockClient.fetchApps).mockResolvedValue(apps)

      const response = createMockTokenCostsResponse([createMockTokenCost()])
      vi.mocked(mockClient.fetchAppTokenCosts).mockResolvedValue(response)

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      const fetchPromise = fetcher.fetch(onRecords)
      await vi.runAllTimersAsync()
      await fetchPromise

      // Assert
      expect(logger.info).toHaveBeenCalledWith(
        'Dify使用量取得完了',
        expect.objectContaining({
          success: expect.any(Boolean),
          totalRecords: expect.any(Number),
          durationMs: expect.any(Number),
        }),
      )
    })

    it('メールアドレスはログに出力されない', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      const apps = [createMockApp()]
      vi.mocked(mockClient.fetchApps).mockResolvedValue(apps)

      const response = createMockTokenCostsResponse([createMockTokenCost()])
      vi.mocked(mockClient.fetchAppTokenCosts).mockResolvedValue(response)

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      const fetchPromise = fetcher.fetch(onRecords)
      await vi.runAllTimersAsync()
      await fetchPromise

      // Assert - 全てのログ呼び出しにメールアドレスが含まれていないことを確認
      const allLogCalls = [
        ...vi.mocked(logger.info).mock.calls,
        ...vi.mocked(logger.warn).mock.calls,
        ...vi.mocked(logger.error).mock.calls,
        ...vi.mocked(logger.debug).mock.calls,
      ]

      for (const call of allLogCalls) {
        const logContent = JSON.stringify(call)
        expect(logContent).not.toContain(config.DIFY_EMAIL)
        expect(logContent).not.toContain(config.DIFY_PASSWORD)
      }
    })
  })
})
