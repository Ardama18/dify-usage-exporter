/**
 * DifyUsageFetcher 単体テスト
 *
 * オーケストレーション機能、ページング処理、バリデーション、
 * エラーハンドリングの動作を検証する。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DifyApiClient } from '../../../src/fetcher/dify-api-client.js'
import type { IFetcher } from '../../../src/interfaces/fetcher.js'
import type { Logger } from '../../../src/logger/winston-logger.js'
import type { DifyUsageRecord, DifyUsageResponse } from '../../../src/types/dify-usage.js'
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

    mockClient = {
      fetchUsage: vi.fn(),
    }

    mockWatermarkManager = {
      load: vi.fn(),
      update: vi.fn(),
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ヘルパー関数：モックレスポンスの生成
  function createMockResponse(
    records: DifyUsageRecord[],
    options: { total?: number; page?: number; has_more?: boolean } = {},
  ): DifyUsageResponse {
    return {
      data: records,
      total: options.total ?? records.length,
      page: options.page ?? 1,
      limit: config.DIFY_FETCH_PAGE_SIZE,
      has_more: options.has_more ?? false,
    }
  }

  // ヘルパー関数：モックレコードの生成
  function createMockRecord(overrides: Partial<DifyUsageRecord> = {}): DifyUsageRecord {
    return {
      date: '2024-01-15',
      app_id: 'app-123',
      provider: 'openai',
      model: 'gpt-4',
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
      ...overrides,
    }
  }

  describe('オーケストレーション動作', () => {
    it('ウォーターマーク読み込み→API呼び出し→ウォーターマーク更新の順序で実行される', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      const watermark: Watermark = {
        last_fetched_date: '2024-01-15T00:00:00.000Z',
        last_updated_at: '2024-01-15T10:30:00.000Z',
      }
      vi.mocked(mockWatermarkManager.load).mockResolvedValue(watermark)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      const response = createMockResponse([createMockRecord()])
      vi.mocked(mockClient.fetchUsage).mockResolvedValue(response)

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      await fetcher.fetch(onRecords)

      // Assert
      expect(mockWatermarkManager.load).toHaveBeenCalledTimes(1)
      expect(mockClient.fetchUsage).toHaveBeenCalled()
      expect(mockWatermarkManager.update).toHaveBeenCalledTimes(1)

      // 順序の確認
      const loadCallOrder = vi.mocked(mockWatermarkManager.load).mock.invocationCallOrder[0]
      const fetchCallOrder = vi.mocked(mockClient.fetchUsage).mock.invocationCallOrder[0]
      const updateCallOrder = vi.mocked(mockWatermarkManager.update).mock.invocationCallOrder[0]

      expect(loadCallOrder).toBeLessThan(fetchCallOrder)
      expect(fetchCallOrder).toBeLessThan(updateCallOrder)
    })

    it('開始日が正しく計算される（ウォーターマーク存在時）', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      const watermark: Watermark = {
        last_fetched_date: '2024-01-15T00:00:00.000Z',
        last_updated_at: '2024-01-15T10:30:00.000Z',
      }
      vi.mocked(mockWatermarkManager.load).mockResolvedValue(watermark)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      const response = createMockResponse([createMockRecord()])
      vi.mocked(mockClient.fetchUsage).mockResolvedValue(response)

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      await fetcher.fetch(onRecords)

      // Assert - 開始日はウォーターマークの翌日
      expect(mockClient.fetchUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: '2024-01-16', // last_fetched_date + 1日
        }),
      )
    })

    it('開始日が正しく計算される（初回実行時：ウォーターマーク不存在）', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      const response = createMockResponse([createMockRecord()])
      vi.mocked(mockClient.fetchUsage).mockResolvedValue(response)

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      await fetcher.fetch(onRecords)

      // Assert - 開始日は30日前（DIFY_INITIAL_FETCH_DAYS）
      expect(mockClient.fetchUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: '2023-12-21', // 2024-01-20 - 30日
        }),
      )
    })

    it('FetchResultが正しく返却される', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      const response = createMockResponse([createMockRecord(), createMockRecord()])
      vi.mocked(mockClient.fetchUsage).mockResolvedValue(response)

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      const result = await fetcher.fetch(onRecords)

      // Assert
      expect(result.success).toBe(true)
      expect(result.totalRecords).toBe(2)
      expect(result.totalPages).toBe(1)
      expect(result.errors).toHaveLength(0)
      expect(result.startDate).toBeDefined()
      expect(result.endDate).toBeDefined()
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe('ページング処理', () => {
    it('has_more=trueの間、次のページを取得し続ける', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      // 3ページ分のデータ
      vi.mocked(mockClient.fetchUsage)
        .mockResolvedValueOnce(
          createMockResponse([createMockRecord()], { page: 1, has_more: true, total: 3 }),
        )
        .mockResolvedValueOnce(
          createMockResponse([createMockRecord()], { page: 2, has_more: true, total: 3 }),
        )
        .mockResolvedValueOnce(
          createMockResponse([createMockRecord()], { page: 3, has_more: false, total: 3 }),
        )

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
      expect(mockClient.fetchUsage).toHaveBeenCalledTimes(3)
      expect(result.totalPages).toBe(3)
      expect(result.totalRecords).toBe(3)
    })

    it('ページ番号が正しくインクリメントされる', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      vi.mocked(mockClient.fetchUsage)
        .mockResolvedValueOnce(
          createMockResponse([createMockRecord()], { page: 1, has_more: true }),
        )
        .mockResolvedValueOnce(
          createMockResponse([createMockRecord()], { page: 2, has_more: false }),
        )

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
      expect(mockClient.fetchUsage).toHaveBeenNthCalledWith(1, expect.objectContaining({ page: 1 }))
      expect(mockClient.fetchUsage).toHaveBeenNthCalledWith(2, expect.objectContaining({ page: 2 }))
    })

    it('環境変数DIFY_FETCH_PAGE_SIZEがlimitに反映される', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      config.DIFY_FETCH_PAGE_SIZE = 50

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      const response = createMockResponse([createMockRecord()])
      vi.mocked(mockClient.fetchUsage).mockResolvedValue(response)

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      await fetcher.fetch(onRecords)

      // Assert
      expect(mockClient.fetchUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 50,
        }),
      )
    })
  })

  describe('進捗ログ出力', () => {
    it('100ページごとに進捗ログを出力する', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      // 200ページ分のデータをシミュレート
      const fetchUsageMock = vi.mocked(mockClient.fetchUsage)
      for (let i = 1; i <= 200; i++) {
        fetchUsageMock.mockResolvedValueOnce(
          createMockResponse([createMockRecord()], {
            page: i,
            has_more: i < 200,
            total: 200,
          }),
        )
      }

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

      // Assert - 100ページと200ページで進捗ログが出力される
      const infoCalls = vi.mocked(logger.info).mock.calls
      const progressCalls = infoCalls.filter(
        (call) => call[0] === '取得進捗' && call[1]?.page !== undefined,
      )
      expect(progressCalls.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('ページ間ディレイ', () => {
    it('各ページ取得後に1秒のディレイを挿入する', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      vi.mocked(mockClient.fetchUsage)
        .mockResolvedValueOnce(
          createMockResponse([createMockRecord()], { page: 1, has_more: true }),
        )
        .mockResolvedValueOnce(
          createMockResponse([createMockRecord()], { page: 2, has_more: false }),
        )

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      const fetchPromise = fetcher.fetch(onRecords)

      // 最初のAPI呼び出しを待機
      await vi.advanceTimersByTimeAsync(0)

      // 1秒のディレイを進める
      await vi.advanceTimersByTimeAsync(1000)

      await fetchPromise

      // Assert
      expect(mockClient.fetchUsage).toHaveBeenCalledTimes(2)
    })

    it('最後のページ後はディレイを挿入しない', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      const response = createMockResponse([createMockRecord()], { has_more: false })
      vi.mocked(mockClient.fetchUsage).mockResolvedValue(response)

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      const startTime = Date.now()
      await fetcher.fetch(onRecords)
      const endTime = Date.now()

      // Assert - 1秒未満で完了（最後のページ後のディレイなし）
      expect(endTime - startTime).toBeLessThan(1000)
    })
  })

  describe('バリデーション処理', () => {
    it('有効なレコードはonRecordsコールバックに渡される', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      const validRecord = createMockRecord()
      const response = createMockResponse([validRecord])
      vi.mocked(mockClient.fetchUsage).mockResolvedValue(response)

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      await fetcher.fetch(onRecords)

      // Assert
      expect(onRecords).toHaveBeenCalledWith([validRecord])
    })

    it('バリデーションエラーのレコードはスキップされ、エラーログが出力される', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      // 不正なレコード（total_tokensが負）
      const invalidRecord = {
        date: '2024-01-15',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: -1, // 不正な値
      } as DifyUsageRecord

      const validRecord = createMockRecord()

      const response = createMockResponse([invalidRecord, validRecord])
      vi.mocked(mockClient.fetchUsage).mockResolvedValue(response)

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      const result = await fetcher.fetch(onRecords)

      // Assert - 有効なレコードのみ渡される
      expect(onRecords).toHaveBeenCalledWith([validRecord])
      expect(result.totalRecords).toBe(1)
      expect(result.errors.some((e) => e.type === 'validation')).toBe(true)
    })
  })

  describe('エラーハンドリング', () => {
    it('ページ取得失敗時にエラーをerrorsに追加してループを中断する', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      vi.mocked(mockClient.fetchUsage)
        .mockResolvedValueOnce(
          createMockResponse([createMockRecord()], { page: 1, has_more: true }),
        )
        .mockRejectedValueOnce(new Error('API Error'))

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
      expect(result.totalRecords).toBe(1) // 1ページ目のレコードのみ
      expect(logger.error).toHaveBeenCalled()
    })

    it('エラー発生後も取得済みデータまでウォーターマークを更新する', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      vi.mocked(mockClient.fetchUsage)
        .mockResolvedValueOnce(
          createMockResponse([createMockRecord()], { page: 1, has_more: true }),
        )
        .mockRejectedValueOnce(new Error('API Error'))

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

      // Assert - ウォーターマークが更新されている
      expect(mockWatermarkManager.update).toHaveBeenCalled()
    })

    it('0件取得時はウォーターマークを更新しない', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      const response = createMockResponse([])
      vi.mocked(mockClient.fetchUsage).mockResolvedValue(response)

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      await fetcher.fetch(onRecords)

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

      const response = createMockResponse([createMockRecord()])
      vi.mocked(mockClient.fetchUsage).mockResolvedValue(response)

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      await fetcher.fetch(onRecords)

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
    it('各ページの有効なレコードがコールバックに渡される', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      const record1 = createMockRecord({ app_id: 'app-1' })
      const record2 = createMockRecord({ app_id: 'app-2' })

      vi.mocked(mockClient.fetchUsage)
        .mockResolvedValueOnce(createMockResponse([record1], { page: 1, has_more: true }))
        .mockResolvedValueOnce(createMockResponse([record2], { page: 2, has_more: false }))

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
      expect(onRecords).toHaveBeenNthCalledWith(1, [record1])
      expect(onRecords).toHaveBeenNthCalledWith(2, [record2])
    })

    it('空のレコードリストの場合はコールバックを呼び出さない', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      const response = createMockResponse([])
      vi.mocked(mockClient.fetchUsage).mockResolvedValue(response)

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      await fetcher.fetch(onRecords)

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

      const response = createMockResponse([createMockRecord()])
      vi.mocked(mockClient.fetchUsage).mockResolvedValue(response)

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      await fetcher.fetch(onRecords)

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

      const response = createMockResponse([createMockRecord()])
      vi.mocked(mockClient.fetchUsage).mockResolvedValue(response)

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      await fetcher.fetch(onRecords)

      // Assert
      expect(logger.info).toHaveBeenCalledWith(
        'Dify使用量取得完了',
        expect.objectContaining({
          success: expect.any(Boolean),
          totalRecords: expect.any(Number),
          totalPages: expect.any(Number),
          durationMs: expect.any(Number),
        }),
      )
    })

    it('APIトークンはログに出力されない', async () => {
      // Arrange
      const { createDifyUsageFetcher } = await import('../../../src/fetcher/dify-usage-fetcher.js')

      vi.mocked(mockWatermarkManager.load).mockResolvedValue(null)
      vi.mocked(mockWatermarkManager.update).mockResolvedValue()

      const response = createMockResponse([createMockRecord()])
      vi.mocked(mockClient.fetchUsage).mockResolvedValue(response)

      fetcher = createDifyUsageFetcher({
        client: mockClient,
        watermarkManager: mockWatermarkManager,
        logger,
        config,
      })

      const onRecords = vi.fn().mockResolvedValue(undefined)

      // Act
      await fetcher.fetch(onRecords)

      // Assert - 全てのログ呼び出しにトークンが含まれていないことを確認
      const allLogCalls = [
        ...vi.mocked(logger.info).mock.calls,
        ...vi.mocked(logger.warn).mock.calls,
        ...vi.mocked(logger.error).mock.calls,
        ...vi.mocked(logger.debug).mock.calls,
      ]

      for (const call of allLogCalls) {
        const logContent = JSON.stringify(call)
        expect(logContent).not.toContain(config.DIFY_API_TOKEN)
      }
    })
  })
})
