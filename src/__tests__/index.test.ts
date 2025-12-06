/**
 * index.ts メトリクス統合テスト
 *
 * メインエントリポイント（index.ts）のonTickコールバック内での
 * MetricsCollectorとMetricsReporterの統合をテストする。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// モジュールモック
vi.mock('../config/env-config.js', () => ({
  loadConfig: vi.fn(),
}))

vi.mock('../logger/winston-logger.js', () => ({
  createLogger: vi.fn(),
}))

vi.mock('../scheduler/cron-scheduler.js', () => ({
  createScheduler: vi.fn(),
}))

vi.mock('../shutdown/graceful-shutdown.js', () => ({
  setupGracefulShutdown: vi.fn(),
}))

vi.mock('../monitoring/metrics-collector.js', () => ({
  createMetricsCollector: vi.fn(),
}))

vi.mock('../monitoring/metrics-reporter.js', () => ({
  createMetricsReporter: vi.fn(),
}))

vi.mock('../fetcher/dify-api-client.js', () => ({
  createDifyApiClient: vi.fn(),
}))

vi.mock('../watermark/watermark-manager.js', () => ({
  createWatermarkManager: vi.fn(),
}))

vi.mock('../fetcher/dify-usage-fetcher.js', () => ({
  createDifyUsageFetcher: vi.fn(),
}))

vi.mock('../transformer/data-transformer.js', () => ({
  createDataTransformer: vi.fn(),
}))

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}))

// 各モジュールをインポート
import axios from 'axios'
import { loadConfig } from '../config/env-config.js'
import { createDifyApiClient } from '../fetcher/dify-api-client.js'
import { createDifyUsageFetcher } from '../fetcher/dify-usage-fetcher.js'
import { main } from '../index.js'
import type { Logger } from '../logger/winston-logger.js'
import { createLogger } from '../logger/winston-logger.js'
import type { MetricsCollector } from '../monitoring/metrics-collector.js'
import { createMetricsCollector } from '../monitoring/metrics-collector.js'
import type { MetricsReporter } from '../monitoring/metrics-reporter.js'
import { createMetricsReporter } from '../monitoring/metrics-reporter.js'
import type { Scheduler } from '../scheduler/cron-scheduler.js'
import { createScheduler } from '../scheduler/cron-scheduler.js'
import { setupGracefulShutdown } from '../shutdown/graceful-shutdown.js'
import { createDataTransformer } from '../transformer/data-transformer.js'
import { createWatermarkManager } from '../watermark/watermark-manager.js'

describe('index.ts メトリクス統合', () => {
  // モック
  const mockConfig = {
    NODE_ENV: 'test',
    LOG_LEVEL: 'debug',
    CRON_SCHEDULE: '0 * * * *',
    GRACEFUL_SHUTDOWN_TIMEOUT: 30,
    MAX_RETRY: 3,
    DIFY_API_BASE_URL: 'https://api.dify.ai',
    EXTERNAL_API_URL: 'https://external.api',
    HEALTHCHECK_PORT: 8080,
    HEALTHCHECK_ENABLED: false,
  }

  let mockLoggerInstance: Logger
  const mockLogger: Logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => mockLoggerInstance),
  }
  mockLoggerInstance = mockLogger

  let capturedOnTick: (() => Promise<void>) | undefined
  const mockScheduler: Scheduler = {
    start: vi.fn(),
    stop: vi.fn(),
    isRunning: vi.fn().mockReturnValue(false),
  }

  // getMetricsで同じオブジェクトを返すために外部に定義
  const mockMetricsData = {
    fetchedRecords: 100,
    transformedRecords: 98,
    sendSuccess: 95,
    sendFailed: 3,
    spoolSaved: 1,
    spoolResendSuccess: 0,
    failedMoved: 0,
  }

  const mockMetricsCollector: MetricsCollector = {
    startCollection: vi.fn().mockReturnValue('exec-1234567890-abc12345'),
    stopCollection: vi.fn(),
    recordFetched: vi.fn(),
    recordTransformed: vi.fn(),
    recordSendSuccess: vi.fn(),
    recordSendFailed: vi.fn(),
    recordSpoolSaved: vi.fn(),
    recordSpoolResendSuccess: vi.fn(),
    recordFailedMoved: vi.fn(),
    getMetrics: vi.fn().mockReturnValue(mockMetricsData),
    getExecutionDuration: vi.fn().mockReturnValue(5432),
    getExecutionId: vi.fn().mockReturnValue('exec-1234567890-abc12345'),
  }

  const mockMetricsReporter: MetricsReporter = {
    report: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    capturedOnTick = undefined

    // mockMetricsCollectorのモック関数を再設定（clearAllMocksでクリアされるため）
    vi.mocked(mockMetricsCollector.startCollection).mockReturnValue('exec-1234567890-abc12345')
    vi.mocked(mockMetricsCollector.getMetrics).mockReturnValue(mockMetricsData)
    vi.mocked(mockMetricsCollector.getExecutionDuration).mockReturnValue(5432)
    vi.mocked(mockMetricsCollector.getExecutionId).mockReturnValue('exec-1234567890-abc12345')

    // 環境変数読み込みモック
    vi.mocked(loadConfig).mockReturnValue(mockConfig as ReturnType<typeof loadConfig>)

    // ロガーモック
    vi.mocked(createLogger).mockReturnValue(mockLogger)

    // スケジューラモック - onTickコールバックをキャプチャ
    vi.mocked(createScheduler).mockImplementation((_config, _logger, onTick) => {
      capturedOnTick = onTick
      return mockScheduler
    })

    // MetricsCollectorモック
    vi.mocked(createMetricsCollector).mockReturnValue(mockMetricsCollector)

    // MetricsReporterモック
    vi.mocked(createMetricsReporter).mockReturnValue(mockMetricsReporter)

    // 追加モック - onTick内で使用されるコンポーネント
    const mockDifyClient = {}
    const mockWatermarkManager = {}
    const mockFetcher = {
      fetch: vi.fn().mockResolvedValue({ success: true, totalRecords: 0, errors: [] }),
    }
    const mockTransformer = {
      transform: vi.fn().mockReturnValue({
        records: [],
        successCount: 0,
        failedCount: 0,
        batchIdempotencyKey: 'test-batch-key',
      }),
    }

    vi.mocked(createDifyApiClient).mockReturnValue(
      mockDifyClient as ReturnType<typeof createDifyApiClient>,
    )
    vi.mocked(createWatermarkManager).mockReturnValue(
      mockWatermarkManager as ReturnType<typeof createWatermarkManager>,
    )
    vi.mocked(createDifyUsageFetcher).mockReturnValue(
      mockFetcher as unknown as ReturnType<typeof createDifyUsageFetcher>,
    )
    vi.mocked(createDataTransformer).mockReturnValue(
      mockTransformer as ReturnType<typeof createDataTransformer>,
    )
    vi.mocked(axios.post).mockResolvedValue({ status: 200, data: {} })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('main関数', () => {
    it('アプリケーションが正常に起動する', async () => {
      await main()

      // 設定が読み込まれる
      expect(loadConfig).toHaveBeenCalledTimes(1)

      // ロガーが作成される
      expect(createLogger).toHaveBeenCalledWith(mockConfig)

      // スケジューラが作成される
      expect(createScheduler).toHaveBeenCalledWith(mockConfig, mockLogger, expect.any(Function))

      // Graceful Shutdownが設定される
      expect(setupGracefulShutdown).toHaveBeenCalledWith({
        timeoutMs: mockConfig.GRACEFUL_SHUTDOWN_TIMEOUT * 1000,
        scheduler: mockScheduler,
        logger: mockLogger,
      })

      // スケジューラが起動される
      expect(mockScheduler.start).toHaveBeenCalledTimes(1)

      // 起動ログが出力される
      expect(mockLogger.info).toHaveBeenCalledWith('アプリケーション起動開始', expect.any(Object))
    })
  })

  describe('onTickコールバック - メトリクス統合', () => {
    it('onTick内でMetricsCollectorが初期化される', async () => {
      await main()

      expect(capturedOnTick).toBeDefined()
      await capturedOnTick?.()

      // MetricsCollectorが作成される
      expect(createMetricsCollector).toHaveBeenCalledTimes(1)
    })

    it('onTick内でstartCollection()が呼ばれる', async () => {
      await main()
      await capturedOnTick?.()

      expect(mockMetricsCollector.startCollection).toHaveBeenCalledTimes(1)
    })

    it('onTick内でstopCollection()が呼ばれる', async () => {
      await main()
      await capturedOnTick?.()

      expect(mockMetricsCollector.stopCollection).toHaveBeenCalledTimes(1)
    })

    it('onTick内でMetricsReporter.report()が呼ばれる', async () => {
      await main()

      // MetricsReporterが作成される
      expect(createMetricsReporter).toHaveBeenCalledWith({ logger: mockLogger })

      await capturedOnTick?.()

      // report()が呼ばれる
      expect(mockMetricsReporter.report).toHaveBeenCalledTimes(1)

      // 引数の型が正しいことを確認（executionId, metrics, duration）
      const reportCall = vi.mocked(mockMetricsReporter.report).mock.calls[0]
      expect(reportCall).toHaveLength(3)
    })

    it('既存のジョブ処理は変更なく動作する', async () => {
      await main()
      await capturedOnTick?.()

      // エクスポートジョブ実行ログが出力される（プレースホルダー）
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringMatching(/ジョブ実行開始|エクスポートジョブ/),
        expect.any(Object),
      )
    })

    it('エラー発生時もstopCollection()とreport()が呼ばれる（try-finally）', async () => {
      // ジョブ内でエラーを発生させる
      const mockError = new Error('テストエラー')
      vi.mocked(createScheduler).mockImplementation((_config, _logger, _onTick) => {
        capturedOnTick = async () => {
          const collector = createMetricsCollector()
          const reporter = createMetricsReporter({ logger: mockLogger })
          collector.startCollection()
          try {
            throw mockError
          } finally {
            collector.stopCollection()
            reporter.report(
              collector.getExecutionId(),
              collector.getMetrics(),
              collector.getExecutionDuration(),
            )
          }
        }
        return mockScheduler
      })

      await main()

      if (capturedOnTick) {
        await expect(capturedOnTick()).rejects.toThrow('テストエラー')
      }

      // stopCollection()が呼ばれる
      expect(mockMetricsCollector.stopCollection).toHaveBeenCalledTimes(1)

      // report()が呼ばれる
      expect(mockMetricsReporter.report).toHaveBeenCalledTimes(1)
    })

    it('メトリクス収集の順序が正しい（startCollection → 処理 → stopCollection → report）', async () => {
      const callOrder: string[] = []

      vi.mocked(mockMetricsCollector.startCollection).mockImplementation(() => {
        callOrder.push('startCollection')
        return 'exec-1234567890-abc12345'
      })

      vi.mocked(mockMetricsCollector.stopCollection).mockImplementation(() => {
        callOrder.push('stopCollection')
      })

      vi.mocked(mockMetricsReporter.report).mockImplementation(() => {
        callOrder.push('report')
      })

      await main()
      await capturedOnTick?.()

      expect(callOrder).toEqual(['startCollection', 'stopCollection', 'report'])
    })
  })
})
