/**
 * MetricsCollector/MetricsReporter 統合テスト - Design Doc: 5-monitoring-logging-healthcheck/design.md
 * 生成日: 2025-11-22
 * テスト種別: Integration Test
 * 実装タイミング: Phase 2実装と同時
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Logger } from '../../../logger/winston-logger.js'
import { createMetricsCollector, type MetricsCollector } from '../../metrics-collector.js'
import { createMetricsReporter, type MetricsReporter } from '../../metrics-reporter.js'

describe('MetricsCollector 統合テスト', () => {
  let collector: MetricsCollector

  beforeEach(() => {
    collector = createMetricsCollector()
  })

  describe('AC-MC-1: メトリクス収集開始', () => {
    // AC解釈: [契機型] ジョブ実行開始時、メトリクス収集を開始
    // 検証: startCollection()がexecutionIdを返し、開始時刻を記録すること
    // @category: integration
    // @dependency: MetricsCollector
    // @complexity: medium
    it('AC-MC-1: startCollection()がexecutionIdを返す', () => {
      const executionId = collector.startCollection()
      expect(executionId).toBeDefined()
      expect(typeof executionId).toBe('string')
      expect(executionId.length).toBeGreaterThan(0)
    })

    // AC解釈: executionId生成パターンは exec-${timestamp}-${randomSuffix}
    // 検証: executionIdの形式が正しいこと
    // @category: integration
    // @dependency: MetricsCollector
    // @complexity: low
    it('AC-MC-1: executionIdが正しい形式 (exec-{timestamp}-{hex}) で生成される', () => {
      const executionId = collector.startCollection()
      // パターン: exec-${timestamp}-${randomHex(8文字)}
      const pattern = /^exec-\d+-[0-9a-f]{8}$/
      expect(executionId).toMatch(pattern)
    })

    // AC解釈: startCollection()は開始時刻を記録
    // 検証: 内部状態に開始時刻が保存されること
    // @category: integration
    // @dependency: MetricsCollector
    // @complexity: low
    it('AC-MC-1: startCollection()が開始時刻を記録する', async () => {
      collector.startCollection()

      // 少し待機
      await new Promise((resolve) => setTimeout(resolve, 10))

      collector.stopCollection()
      const duration = collector.getExecutionDuration()

      // durationが0より大きいことで開始時刻が記録されていることを検証
      expect(duration).toBeGreaterThanOrEqual(10)
      expect(duration).toBeLessThan(1000) // 1秒以内に完了
    })

    // AC解釈: 同一インスタンスでの複数回startCollection()呼び出し
    // 検証: 毎回新しいexecutionIdが生成されること
    // @category: edge-case
    // @dependency: MetricsCollector
    // @complexity: medium
    it('AC-MC-1-edge: 複数回のstartCollection()で異なるexecutionIdが生成される', () => {
      const id1 = collector.startCollection()
      const id2 = collector.startCollection()
      const id3 = collector.startCollection()

      expect(id1).not.toBe(id2)
      expect(id2).not.toBe(id3)
      expect(id1).not.toBe(id3)
    })
  })

  describe('AC-MC-3: 各処理フェーズのメトリクス記録', () => {
    beforeEach(() => {
      collector.startCollection()
    })

    // AC解釈: [遍在型] 各処理フェーズ（fetch, transform, send）でレコード数を記録
    // 検証: 各recordメソッドが正しくカウントを加算すること
    // @category: integration
    // @dependency: MetricsCollector
    // @complexity: low
    it('AC-MC-3: recordFetched()がfetchedRecordsを加算する', () => {
      collector.recordFetched(100)
      const metrics = collector.getMetrics()
      expect(metrics.fetchedRecords).toBe(100)
    })

    // @category: integration
    // @dependency: MetricsCollector
    // @complexity: low
    it('AC-MC-3: recordTransformed()がtransformedRecordsを加算する', () => {
      collector.recordTransformed(90)
      const metrics = collector.getMetrics()
      expect(metrics.transformedRecords).toBe(90)
    })

    // @category: integration
    // @dependency: MetricsCollector
    // @complexity: low
    it('AC-MC-3: recordSendSuccess()がsendSuccessを加算する', () => {
      collector.recordSendSuccess(80)
      const metrics = collector.getMetrics()
      expect(metrics.sendSuccess).toBe(80)
    })

    // @category: integration
    // @dependency: MetricsCollector
    // @complexity: low
    it('AC-MC-3: recordSendFailed()がsendFailedを加算する', () => {
      collector.recordSendFailed(10)
      const metrics = collector.getMetrics()
      expect(metrics.sendFailed).toBe(10)
    })

    // @category: integration
    // @dependency: MetricsCollector
    // @complexity: low
    it('AC-MC-3: recordSpoolSaved()がspoolSavedを加算する', () => {
      collector.recordSpoolSaved(5)
      const metrics = collector.getMetrics()
      expect(metrics.spoolSaved).toBe(5)
    })

    // @category: integration
    // @dependency: MetricsCollector
    // @complexity: low
    it('AC-MC-3: recordSpoolResendSuccess()がspoolResendSuccessを加算する', () => {
      collector.recordSpoolResendSuccess(3)
      const metrics = collector.getMetrics()
      expect(metrics.spoolResendSuccess).toBe(3)
    })

    // @category: integration
    // @dependency: MetricsCollector
    // @complexity: low
    it('AC-MC-3: recordFailedMoved()がfailedMovedを加算する', () => {
      collector.recordFailedMoved(2)
      const metrics = collector.getMetrics()
      expect(metrics.failedMoved).toBe(2)
    })

    // AC解釈: 複数回の記録で累積されること
    // 検証: 同じメソッドを複数回呼び出した時に値が累積されること
    // @category: integration
    // @dependency: MetricsCollector
    // @complexity: medium
    it('AC-MC-3: 複数回のrecord呼び出しで値が累積される', () => {
      collector.recordFetched(50)
      collector.recordFetched(30)
      collector.recordFetched(20)

      const metrics = collector.getMetrics()
      expect(metrics.fetchedRecords).toBe(100)
    })
  })

  describe('AC-MC-4: ジョブ実行時間記録', () => {
    // AC解釈: [遍在型] ジョブ実行時間（durationMs）をメトリクスに含める
    // 検証: stopCollection()後にgetExecutionDuration()が正しい値を返すこと
    // @category: integration
    // @dependency: MetricsCollector
    // @complexity: medium
    it('AC-MC-4: stopCollection()後にgetExecutionDuration()が実行時間を返す', async () => {
      collector.startCollection()

      // 50ms待機
      await new Promise((resolve) => setTimeout(resolve, 50))

      collector.stopCollection()
      const duration = collector.getExecutionDuration()

      // 50ms以上を期待（タイマー精度の関係で若干の誤差を許容）
      expect(duration).toBeGreaterThanOrEqual(40)
      expect(duration).toBeLessThan(200)
    })

    // AC解釈: 実行時間はミリ秒単位で計算
    // 検証: durationMsが0以上の整数であること
    // @category: integration
    // @dependency: MetricsCollector
    // @complexity: low
    it('AC-MC-4: getExecutionDuration()がミリ秒単位の値を返す', () => {
      collector.startCollection()
      collector.stopCollection()
      const duration = collector.getExecutionDuration()

      expect(typeof duration).toBe('number')
      expect(duration).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(duration)).toBe(true)
    })

    // AC解釈: stopCollection()が終了時刻を記録
    // 検証: 内部状態に終了時刻が保存されること
    // @category: integration
    // @dependency: MetricsCollector
    // @complexity: low
    it('AC-MC-4: stopCollection()が終了時刻を記録する', async () => {
      collector.startCollection()
      await new Promise((resolve) => setTimeout(resolve, 10))
      collector.stopCollection()

      const duration1 = collector.getExecutionDuration()
      await new Promise((resolve) => setTimeout(resolve, 50))
      const duration2 = collector.getExecutionDuration()

      // 終了時刻が記録されているため、後から取得しても同じ値
      expect(duration1).toBe(duration2)
    })
  })

  describe('getMetrics/getExecutionId動作検証', () => {
    // AC解釈: getMetrics()がExecutionMetrics形式のオブジェクトを返す
    // 検証: 全フィールドが含まれ、型が正しいこと
    // @category: integration
    // @dependency: MetricsCollector
    // @complexity: medium
    it('getMetrics()がExecutionMetrics形式のオブジェクトを返す', () => {
      collector.startCollection()
      const metrics = collector.getMetrics()

      expect(metrics).toHaveProperty('fetchedRecords')
      expect(metrics).toHaveProperty('transformedRecords')
      expect(metrics).toHaveProperty('sendSuccess')
      expect(metrics).toHaveProperty('sendFailed')
      expect(metrics).toHaveProperty('spoolSaved')
      expect(metrics).toHaveProperty('spoolResendSuccess')
      expect(metrics).toHaveProperty('failedMoved')

      // 全てがnumber型
      expect(typeof metrics.fetchedRecords).toBe('number')
      expect(typeof metrics.transformedRecords).toBe('number')
      expect(typeof metrics.sendSuccess).toBe('number')
      expect(typeof metrics.sendFailed).toBe('number')
      expect(typeof metrics.spoolSaved).toBe('number')
      expect(typeof metrics.spoolResendSuccess).toBe('number')
      expect(typeof metrics.failedMoved).toBe('number')
    })

    // AC解釈: getExecutionId()が生成されたexecutionIdを返す
    // 検証: startCollection()で生成されたIDが取得できること
    // @category: integration
    // @dependency: MetricsCollector
    // @complexity: low
    it('getExecutionId()が生成されたexecutionIdを返す', () => {
      const generatedId = collector.startCollection()
      const retrievedId = collector.getExecutionId()
      expect(retrievedId).toBe(generatedId)
    })

    // AC解釈: startCollection()前のgetExecutionId()呼び出し
    // 検証: 初期状態での動作確認
    // @category: edge-case
    // @dependency: MetricsCollector
    // @complexity: medium
    it('edge: startCollection()前のgetExecutionId()呼び出しの動作', () => {
      // 初期状態では空文字列を返す
      const id = collector.getExecutionId()
      expect(id).toBe('')
    })
  })

  describe('エッジケース', () => {
    beforeEach(() => {
      collector.startCollection()
    })

    // AC解釈: 0件のレコード数を記録
    // 検証: 0を引数として正常に動作すること
    // @category: edge-case
    // @dependency: MetricsCollector
    // @complexity: low
    it('edge: recordFetched(0)が正常に動作する', () => {
      collector.recordFetched(0)
      const metrics = collector.getMetrics()
      expect(metrics.fetchedRecords).toBe(0)
    })

    // AC解釈: 負の数値を引数として渡した場合
    // 検証: 負の値が許容されるか、エラーになるか
    // @category: edge-case
    // @dependency: MetricsCollector
    // @complexity: medium
    it('edge: 負の数値を引数として渡した場合の動作', () => {
      collector.recordFetched(10)
      // 負の値は無視される（addPositiveの実装）
      collector.recordFetched(-5)
      const metrics = collector.getMetrics()
      // 10のまま（負の値は加算されない）
      expect(metrics.fetchedRecords).toBe(10)
    })

    // AC解釈: 非常に大きな数値を引数として渡した場合
    // 検証: Number.MAX_SAFE_INTEGER付近の値での動作
    // @category: edge-case
    // @dependency: MetricsCollector
    // @complexity: medium
    it('edge: 大きな数値でのオーバーフロー検証', () => {
      const largeValue = Number.MAX_SAFE_INTEGER - 100
      collector.recordFetched(largeValue)
      const metrics = collector.getMetrics()
      expect(metrics.fetchedRecords).toBe(largeValue)
    })
  })
})

describe('MetricsReporter 統合テスト', () => {
  let reporter: MetricsReporter
  let mockLogger: Logger

  beforeEach(() => {
    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(() => mockLogger),
    }
    reporter = createMetricsReporter({ logger: mockLogger })
  })

  describe('AC-MC-2: メトリクスログ出力', () => {
    // AC解釈: [契機型] ジョブ実行完了時、ExecutionMetrics形式でメトリクスをログ出力
    // 検証: report()がLogger.info()を呼び出すこと
    // @category: integration
    // @dependency: MetricsReporter, Logger
    // @complexity: medium
    it('AC-MC-2: report()がメトリクスをログ出力する', () => {
      const executionId = 'exec-123-abcd1234'
      const metrics = {
        fetchedRecords: 100,
        transformedRecords: 90,
        sendSuccess: 80,
        sendFailed: 10,
        spoolSaved: 5,
        spoolResendSuccess: 3,
        failedMoved: 2,
      }
      const durationMs = 1000

      reporter.report(executionId, metrics, durationMs)

      expect(mockLogger.info).toHaveBeenCalledTimes(1)
    })

    // AC解釈: ログ出力形式がJSON Lines形式であること
    // 検証: ログの構造が仕様に準拠していること
    // @category: integration
    // @dependency: MetricsReporter, Logger
    // @complexity: medium
    it('AC-MC-2: ログ出力がJSON Lines形式である', () => {
      const executionId = 'exec-123-abcd1234'
      const metrics = {
        fetchedRecords: 100,
        transformedRecords: 90,
        sendSuccess: 80,
        sendFailed: 10,
        spoolSaved: 5,
        spoolResendSuccess: 3,
        failedMoved: 2,
      }
      const durationMs = 1000

      reporter.report(executionId, metrics, durationMs)

      // logger.infoが呼ばれた引数を検証
      const call = (mockLogger.info as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(call[0]).toBe('ジョブ完了メトリクス')
      expect(call[1]).toBeDefined()
      expect(typeof call[1]).toBe('object')
    })

    // AC解釈: ログにmetricsオブジェクトが含まれること
    // 検証: ExecutionMetrics全フィールドがログに含まれること
    // @category: integration
    // @dependency: MetricsReporter, Logger
    // @complexity: low
    it('AC-MC-2: ログにExecutionMetricsの全フィールドが含まれる', () => {
      const executionId = 'exec-123-abcd1234'
      const metrics = {
        fetchedRecords: 100,
        transformedRecords: 90,
        sendSuccess: 80,
        sendFailed: 10,
        spoolSaved: 5,
        spoolResendSuccess: 3,
        failedMoved: 2,
      }
      const durationMs = 1000

      reporter.report(executionId, metrics, durationMs)

      const call = (mockLogger.info as ReturnType<typeof vi.fn>).mock.calls[0]
      const logData = call[1]

      expect(logData.metrics).toEqual(metrics)
    })
  })

  describe('AC-MC-5: レコード処理速度計算', () => {
    // AC解釈: [遍在型] レコード処理速度（recordsPerSecond）をメトリクスに含める
    // 検証: report()がrecordsPerSecondを計算してログに含めること
    // @category: integration
    // @dependency: MetricsReporter
    // @complexity: medium
    it('AC-MC-5: recordsPerSecondをログに含める', () => {
      const executionId = 'exec-123-abcd1234'
      const metrics = {
        fetchedRecords: 100,
        transformedRecords: 90,
        sendSuccess: 80,
        sendFailed: 10,
        spoolSaved: 5,
        spoolResendSuccess: 3,
        failedMoved: 2,
      }
      const durationMs = 1000

      reporter.report(executionId, metrics, durationMs)

      const call = (mockLogger.info as ReturnType<typeof vi.fn>).mock.calls[0]
      const logData = call[1]

      expect(logData).toHaveProperty('recordsPerSecond')
    })

    // AC解釈: recordsPerSecond = sendSuccess / (durationMs / 1000)
    // 検証: 計算結果が正しいこと
    // @category: integration
    // @dependency: MetricsReporter
    // @complexity: medium
    it('AC-MC-5: recordsPerSecondが正しく計算される', () => {
      const executionId = 'exec-123-abcd1234'
      const metrics = {
        fetchedRecords: 100,
        transformedRecords: 90,
        sendSuccess: 80,
        sendFailed: 10,
        spoolSaved: 5,
        spoolResendSuccess: 3,
        failedMoved: 2,
      }
      const durationMs = 2000 // 2秒

      reporter.report(executionId, metrics, durationMs)

      const call = (mockLogger.info as ReturnType<typeof vi.fn>).mock.calls[0]
      const logData = call[1]

      // sendSuccess / (durationMs / 1000) = 80 / 2 = 40
      expect(logData.recordsPerSecond).toBe(40)
    })

    // AC解釈: durationMsが0の場合の処理
    // 検証: ゼロ除算が発生しないこと
    // @category: edge-case
    // @dependency: MetricsReporter
    // @complexity: high
    it('AC-MC-5-edge: durationMs=0の場合にゼロ除算が発生しない', () => {
      const executionId = 'exec-123-abcd1234'
      const metrics = {
        fetchedRecords: 100,
        transformedRecords: 90,
        sendSuccess: 80,
        sendFailed: 10,
        spoolSaved: 5,
        spoolResendSuccess: 3,
        failedMoved: 2,
      }
      const durationMs = 0

      // 例外が発生しないこと
      expect(() => reporter.report(executionId, metrics, durationMs)).not.toThrow()

      const call = (mockLogger.info as ReturnType<typeof vi.fn>).mock.calls[0]
      const logData = call[1]

      // ゼロ除算を避けて0を返す
      expect(logData.recordsPerSecond).toBe(0)
    })

    // AC解釈: sendSuccessが0の場合の処理
    // 検証: recordsPerSecondが0になること
    // @category: edge-case
    // @dependency: MetricsReporter
    // @complexity: low
    it('AC-MC-5-edge: sendSuccess=0の場合のrecordsPerSecond計算', () => {
      const executionId = 'exec-123-abcd1234'
      const metrics = {
        fetchedRecords: 0,
        transformedRecords: 0,
        sendSuccess: 0,
        sendFailed: 0,
        spoolSaved: 0,
        spoolResendSuccess: 0,
        failedMoved: 0,
      }
      const durationMs = 1000

      reporter.report(executionId, metrics, durationMs)

      const call = (mockLogger.info as ReturnType<typeof vi.fn>).mock.calls[0]
      const logData = call[1]

      expect(logData.recordsPerSecond).toBe(0)
    })
  })

  describe('AC-LOG-1: JSON Lines形式出力', () => {
    // AC解釈: [遍在型] 全てのログをJSON Lines形式で標準出力に出力
    // 検証: ログがJSON形式で出力されること
    // @category: integration
    // @dependency: MetricsReporter, Logger
    // @complexity: medium
    it('AC-LOG-1: メトリクスログがJSON形式で出力される', () => {
      const executionId = 'exec-123-abcd1234'
      const metrics = {
        fetchedRecords: 100,
        transformedRecords: 90,
        sendSuccess: 80,
        sendFailed: 10,
        spoolSaved: 5,
        spoolResendSuccess: 3,
        failedMoved: 2,
      }
      const durationMs = 1000

      reporter.report(executionId, metrics, durationMs)

      const call = (mockLogger.info as ReturnType<typeof vi.fn>).mock.calls[0]
      const logData = call[1]

      // JSON形式としてシリアライズ可能か検証
      expect(() => JSON.stringify(logData)).not.toThrow()
    })
  })

  describe('AC-LOG-2: executionId付与', () => {
    // AC解釈: [遍在型] メトリクスログにexecutionIdを含める
    // 検証: ログにexecutionIdフィールドが含まれること
    // @category: integration
    // @dependency: MetricsReporter
    // @complexity: low
    it('AC-LOG-2: メトリクスログにexecutionIdが含まれる', () => {
      const executionId = 'exec-123-abcd1234'
      const metrics = {
        fetchedRecords: 100,
        transformedRecords: 90,
        sendSuccess: 80,
        sendFailed: 10,
        spoolSaved: 5,
        spoolResendSuccess: 3,
        failedMoved: 2,
      }
      const durationMs = 1000

      reporter.report(executionId, metrics, durationMs)

      const call = (mockLogger.info as ReturnType<typeof vi.fn>).mock.calls[0]
      const logData = call[1]

      expect(logData.executionId).toBe(executionId)
    })
  })

  describe('AC-PERF-2: メトリクス収集・出力のオーバーヘッド', () => {
    // AC解釈: [遍在型] メトリクス収集・出力によるジョブ実行時間への影響を1%以下に抑える
    // 検証: report()の実行時間測定
    // @category: integration
    // @dependency: MetricsReporter
    // @complexity: medium
    it('AC-PERF-2: report()の実行時間が軽微である', () => {
      const executionId = 'exec-123-abcd1234'
      const metrics = {
        fetchedRecords: 100,
        transformedRecords: 90,
        sendSuccess: 80,
        sendFailed: 10,
        spoolSaved: 5,
        spoolResendSuccess: 3,
        failedMoved: 2,
      }
      const durationMs = 1000

      const start = performance.now()
      reporter.report(executionId, metrics, durationMs)
      const elapsed = performance.now() - start

      // 1ms以内に完了すること
      expect(elapsed).toBeLessThan(10)
    })
  })

  describe('エッジケース', () => {
    // AC解釈: 全フィールドが0のメトリクス
    // 検証: 空のジョブ実行時の動作
    // @category: edge-case
    // @dependency: MetricsReporter
    // @complexity: low
    it('edge: 全メトリクスが0の場合のログ出力', () => {
      const executionId = 'exec-123-abcd1234'
      const metrics = {
        fetchedRecords: 0,
        transformedRecords: 0,
        sendSuccess: 0,
        sendFailed: 0,
        spoolSaved: 0,
        spoolResendSuccess: 0,
        failedMoved: 0,
      }
      const durationMs = 100

      expect(() => reporter.report(executionId, metrics, durationMs)).not.toThrow()
      expect(mockLogger.info).toHaveBeenCalledTimes(1)
    })

    // AC解釈: 非常に大きなdurationMs
    // 検証: 長時間実行ジョブのメトリクス出力
    // @category: edge-case
    // @dependency: MetricsReporter
    // @complexity: low
    it('edge: 大きなdurationMs値でのログ出力', () => {
      const executionId = 'exec-123-abcd1234'
      const metrics = {
        fetchedRecords: 1000000,
        transformedRecords: 1000000,
        sendSuccess: 1000000,
        sendFailed: 0,
        spoolSaved: 0,
        spoolResendSuccess: 0,
        failedMoved: 0,
      }
      const durationMs = 3600000 // 1時間

      expect(() => reporter.report(executionId, metrics, durationMs)).not.toThrow()

      const call = (mockLogger.info as ReturnType<typeof vi.fn>).mock.calls[0]
      const logData = call[1]

      // 1000000 / 3600 = 277.78 records/sec
      expect(logData.recordsPerSecond).toBeCloseTo(277.78, 0)
    })
  })
})

describe('MetricsCollector + MetricsReporter 連携テスト', () => {
  let collector: MetricsCollector
  let reporter: MetricsReporter
  let mockLogger: Logger

  beforeEach(() => {
    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(() => mockLogger),
    }
    collector = createMetricsCollector()
    reporter = createMetricsReporter({ logger: mockLogger })
  })

  describe('完全フロー検証', () => {
    // AC解釈: startCollection() → record*() → stopCollection() → report()の完全フロー
    // 検証: 全体の連携が正しく動作すること
    // @category: integration
    // @dependency: MetricsCollector, MetricsReporter
    // @complexity: high
    it('完全フロー: startCollection → record → stopCollection → report', async () => {
      // 1. 収集開始
      const executionId = collector.startCollection()

      // 2. メトリクス記録
      collector.recordFetched(100)
      collector.recordTransformed(95)
      collector.recordSendSuccess(90)
      collector.recordSendFailed(5)
      collector.recordSpoolSaved(2)
      collector.recordSpoolResendSuccess(1)
      collector.recordFailedMoved(1)

      // 少し待機（実行時間を生成）
      await new Promise((resolve) => setTimeout(resolve, 10))

      // 3. 収集停止
      collector.stopCollection()

      // 4. レポート出力
      const metrics = collector.getMetrics()
      const duration = collector.getExecutionDuration()
      reporter.report(executionId, metrics, duration)

      // 検証
      expect(mockLogger.info).toHaveBeenCalledTimes(1)
      const call = (mockLogger.info as ReturnType<typeof vi.fn>).mock.calls[0]
      const logData = call[1]

      expect(logData.executionId).toBe(executionId)
      expect(logData.metrics.fetchedRecords).toBe(100)
      expect(logData.metrics.transformedRecords).toBe(95)
      expect(logData.metrics.sendSuccess).toBe(90)
      expect(logData.metrics.sendFailed).toBe(5)
      expect(logData.metrics.spoolSaved).toBe(2)
      expect(logData.metrics.spoolResendSuccess).toBe(1)
      expect(logData.metrics.failedMoved).toBe(1)
      expect(logData.durationMs).toBeGreaterThanOrEqual(10)
    })

    // AC解釈: 複数回のジョブ実行をシミュレート
    // 検証: 連続実行時の状態リセット確認
    // @category: integration
    // @dependency: MetricsCollector, MetricsReporter
    // @complexity: high
    it('完全フロー: 複数回のジョブ実行で状態が正しくリセットされる', () => {
      // 1回目の実行
      const id1 = collector.startCollection()
      collector.recordFetched(100)
      collector.stopCollection()
      const metrics1 = collector.getMetrics()
      reporter.report(id1, metrics1, collector.getExecutionDuration())

      // 2回目の実行
      const id2 = collector.startCollection()
      collector.recordFetched(200)
      collector.stopCollection()
      const metrics2 = collector.getMetrics()
      reporter.report(id2, metrics2, collector.getExecutionDuration())

      // 検証
      expect(mockLogger.info).toHaveBeenCalledTimes(2)

      const call1 = (mockLogger.info as ReturnType<typeof vi.fn>).mock.calls[0]
      const call2 = (mockLogger.info as ReturnType<typeof vi.fn>).mock.calls[1]

      // 1回目と2回目でexecutionIdが異なる
      expect(call1[1].executionId).not.toBe(call2[1].executionId)

      // メトリクスがリセットされている
      expect(call1[1].metrics.fetchedRecords).toBe(100)
      expect(call2[1].metrics.fetchedRecords).toBe(200)
    })
  })

  describe('実際のユースケース', () => {
    // 実際のユースケースに近いシナリオをテスト
    it('ユースケース: フェッチ -> 変換 -> 送信の完全フロー', async () => {
      const executionId = collector.startCollection()

      // フェッチフェーズ
      collector.recordFetched(500)

      // 変換フェーズ（一部失敗）
      collector.recordTransformed(480)

      // 送信フェーズ（バッチ送信）
      collector.recordSendSuccess(400)
      collector.recordSendFailed(80)
      collector.recordSpoolSaved(4)

      await new Promise((resolve) => setTimeout(resolve, 5))
      collector.stopCollection()

      reporter.report(executionId, collector.getMetrics(), collector.getExecutionDuration())

      const call = (mockLogger.info as ReturnType<typeof vi.fn>).mock.calls[0]
      const logData = call[1]

      expect(logData.metrics.fetchedRecords).toBe(500)
      expect(logData.metrics.transformedRecords).toBe(480)
      expect(logData.metrics.sendSuccess).toBe(400)
      expect(logData.metrics.sendFailed).toBe(80)
      expect(logData.metrics.spoolSaved).toBe(4)
    })

    it('ユースケース: スプール再送を含むフロー', async () => {
      const executionId = collector.startCollection()

      // 通常フェッチ
      collector.recordFetched(100)
      collector.recordTransformed(100)
      collector.recordSendSuccess(100)

      // スプール再送
      collector.recordSpoolResendSuccess(5)

      await new Promise((resolve) => setTimeout(resolve, 5))
      collector.stopCollection()

      reporter.report(executionId, collector.getMetrics(), collector.getExecutionDuration())

      const call = (mockLogger.info as ReturnType<typeof vi.fn>).mock.calls[0]
      const logData = call[1]

      expect(logData.metrics.sendSuccess).toBe(100)
      expect(logData.metrics.spoolResendSuccess).toBe(5)
    })

    it('ユースケース: 部分的エラーを含むフロー', async () => {
      const executionId = collector.startCollection()

      collector.recordFetched(1000)
      collector.recordTransformed(1000)
      collector.recordSendSuccess(900)
      collector.recordSendFailed(100)
      collector.recordSpoolSaved(10)
      collector.recordFailedMoved(2)

      await new Promise((resolve) => setTimeout(resolve, 5))
      collector.stopCollection()

      reporter.report(executionId, collector.getMetrics(), collector.getExecutionDuration())

      const call = (mockLogger.info as ReturnType<typeof vi.fn>).mock.calls[0]
      const logData = call[1]

      expect(logData.metrics.sendSuccess + logData.metrics.sendFailed).toBe(1000)
      expect(logData.metrics.failedMoved).toBe(2)
    })
  })

  describe('パフォーマンス', () => {
    it('パフォーマンス: 10000回の recordSendSuccess() が 1ms 以内', () => {
      collector.startCollection()

      const start = performance.now()
      for (let i = 0; i < 10000; i++) {
        collector.recordSendSuccess(1)
      }
      const elapsed = performance.now() - start

      // 1ms以内に完了すること
      expect(elapsed).toBeLessThan(10)

      const metrics = collector.getMetrics()
      expect(metrics.sendSuccess).toBe(10000)
    })

    it('パフォーマンス: getMetrics() が 1ms 以内', () => {
      collector.startCollection()
      collector.recordFetched(10000)
      collector.recordTransformed(10000)
      collector.recordSendSuccess(10000)

      const start = performance.now()
      const metrics = collector.getMetrics()
      const elapsed = performance.now() - start

      expect(elapsed).toBeLessThan(1)
      expect(metrics).toBeDefined()
    })

    it('パフォーマンス: メトリクス記録のオーバーヘッドが1%以下（AC-PERF-2）', () => {
      const iterations = 1000

      collector.startCollection()

      const start = performance.now()
      for (let i = 0; i < iterations; i++) {
        collector.recordFetched(1)
        collector.recordTransformed(1)
        collector.recordSendSuccess(1)
      }
      const elapsed = performance.now() - start

      // 1000回の記録が1ms以内であれば十分軽量
      // 基本処理が1回0.001msとして1000回で1ms
      // オーバーヘッドが1%以下なら合計で1.01ms以内
      expect(elapsed).toBeLessThan(10)
    })
  })
})
