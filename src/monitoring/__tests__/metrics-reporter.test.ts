/**
 * MetricsReporter 単体テスト
 *
 * 対応AC: AC-MC-2, AC-MC-5, AC-LOG-1, AC-LOG-2
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Logger } from '../../logger/winston-logger.js'
import type { ExecutionMetrics } from '../../types/metrics.js'
import { createMetricsReporter } from '../metrics-reporter.js'

describe('MetricsReporter', () => {
  let mockLogger: Logger
  let logInfoCalls: Array<{ message: string; meta?: Record<string, unknown> }>

  beforeEach(() => {
    logInfoCalls = []
    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn((message: string, meta?: Record<string, unknown>) => {
        logInfoCalls.push({ message, meta })
      }),
      debug: vi.fn(),
      child: vi.fn(),
    } as unknown as Logger
  })

  describe('基本動作', () => {
    it('createMetricsReporter がレポーターインスタンスを返す', () => {
      // Act
      const reporter = createMetricsReporter({ logger: mockLogger })

      // Assert
      expect(reporter).toBeDefined()
      expect(reporter.report).toBeDefined()
      expect(typeof reporter.report).toBe('function')
    })

    it('report() がログを出力する', () => {
      // Arrange
      const reporter = createMetricsReporter({ logger: mockLogger })
      const executionId = 'exec-123-abc'
      const metrics: ExecutionMetrics = {
        fetchedRecords: 100,
        transformedRecords: 95,
        sendSuccess: 90,
        sendFailed: 5,
        spoolSaved: 3,
        spoolResendSuccess: 2,
        failedMoved: 1,
      }
      const durationMs = 5000

      // Act
      reporter.report(executionId, metrics, durationMs)

      // Assert
      expect(mockLogger.info).toHaveBeenCalled()
    })
  })

  describe('ログ形式', () => {
    it('JSON Lines形式で出力される', () => {
      // Arrange
      const reporter = createMetricsReporter({ logger: mockLogger })
      const executionId = 'exec-123-abc'
      const metrics: ExecutionMetrics = {
        fetchedRecords: 100,
        transformedRecords: 95,
        sendSuccess: 90,
        sendFailed: 5,
        spoolSaved: 3,
        spoolResendSuccess: 2,
        failedMoved: 1,
      }
      const durationMs = 5000

      // Act
      reporter.report(executionId, metrics, durationMs)

      // Assert
      expect(mockLogger.info).toHaveBeenCalledTimes(1)
      expect(logInfoCalls[0].meta).toBeDefined()
    })

    it('message フィールドに "ジョブ完了メトリクス" が含まれる', () => {
      // Arrange
      const reporter = createMetricsReporter({ logger: mockLogger })
      const executionId = 'exec-123-abc'
      const metrics: ExecutionMetrics = {
        fetchedRecords: 100,
        transformedRecords: 95,
        sendSuccess: 90,
        sendFailed: 5,
        spoolSaved: 3,
        spoolResendSuccess: 2,
        failedMoved: 1,
      }
      const durationMs = 5000

      // Act
      reporter.report(executionId, metrics, durationMs)

      // Assert
      expect(logInfoCalls[0].message).toBe('ジョブ完了メトリクス')
    })

    it('executionId が含まれる', () => {
      // Arrange
      const reporter = createMetricsReporter({ logger: mockLogger })
      const executionId = 'exec-123-abc'
      const metrics: ExecutionMetrics = {
        fetchedRecords: 100,
        transformedRecords: 95,
        sendSuccess: 90,
        sendFailed: 5,
        spoolSaved: 3,
        spoolResendSuccess: 2,
        failedMoved: 1,
      }
      const durationMs = 5000

      // Act
      reporter.report(executionId, metrics, durationMs)

      // Assert
      expect(logInfoCalls[0].meta?.executionId).toBe(executionId)
    })

    it('metrics オブジェクトが含まれる', () => {
      // Arrange
      const reporter = createMetricsReporter({ logger: mockLogger })
      const executionId = 'exec-123-abc'
      const metrics: ExecutionMetrics = {
        fetchedRecords: 100,
        transformedRecords: 95,
        sendSuccess: 90,
        sendFailed: 5,
        spoolSaved: 3,
        spoolResendSuccess: 2,
        failedMoved: 1,
      }
      const durationMs = 5000

      // Act
      reporter.report(executionId, metrics, durationMs)

      // Assert
      expect(logInfoCalls[0].meta?.metrics).toEqual(metrics)
    })

    it('durationMs が含まれる', () => {
      // Arrange
      const reporter = createMetricsReporter({ logger: mockLogger })
      const executionId = 'exec-123-abc'
      const metrics: ExecutionMetrics = {
        fetchedRecords: 100,
        transformedRecords: 95,
        sendSuccess: 90,
        sendFailed: 5,
        spoolSaved: 3,
        spoolResendSuccess: 2,
        failedMoved: 1,
      }
      const durationMs = 5000

      // Act
      reporter.report(executionId, metrics, durationMs)

      // Assert
      expect(logInfoCalls[0].meta?.durationMs).toBe(durationMs)
    })

    it('recordsPerSecond が含まれる', () => {
      // Arrange
      const reporter = createMetricsReporter({ logger: mockLogger })
      const executionId = 'exec-123-abc'
      const metrics: ExecutionMetrics = {
        fetchedRecords: 100,
        transformedRecords: 95,
        sendSuccess: 90,
        sendFailed: 5,
        spoolSaved: 3,
        spoolResendSuccess: 2,
        failedMoved: 1,
      }
      const durationMs = 5000

      // Act
      reporter.report(executionId, metrics, durationMs)

      // Assert
      expect(logInfoCalls[0].meta?.recordsPerSecond).toBeDefined()
      expect(typeof logInfoCalls[0].meta?.recordsPerSecond).toBe('number')
    })
  })

  describe('計算', () => {
    it('recordsPerSecond が正しく計算される', () => {
      // Arrange
      const reporter = createMetricsReporter({ logger: mockLogger })
      const executionId = 'exec-123-abc'
      const metrics: ExecutionMetrics = {
        fetchedRecords: 100,
        transformedRecords: 95,
        sendSuccess: 100,
        sendFailed: 0,
        spoolSaved: 0,
        spoolResendSuccess: 0,
        failedMoved: 0,
      }
      const durationMs = 5000 // 5秒

      // Act
      reporter.report(executionId, metrics, durationMs)

      // Assert
      // 100 records / 5 seconds = 20 records/sec
      expect(logInfoCalls[0].meta?.recordsPerSecond).toBe(20)
    })

    it('durationMs が 0 の場合、recordsPerSecond は 0（ゼロ除算対策）', () => {
      // Arrange
      const reporter = createMetricsReporter({ logger: mockLogger })
      const executionId = 'exec-123-abc'
      const metrics: ExecutionMetrics = {
        fetchedRecords: 100,
        transformedRecords: 95,
        sendSuccess: 100,
        sendFailed: 0,
        spoolSaved: 0,
        spoolResendSuccess: 0,
        failedMoved: 0,
      }
      const durationMs = 0

      // Act
      reporter.report(executionId, metrics, durationMs)

      // Assert
      expect(logInfoCalls[0].meta?.recordsPerSecond).toBe(0)
    })

    it('sentRecords が 0 の場合、recordsPerSecond は 0', () => {
      // Arrange
      const reporter = createMetricsReporter({ logger: mockLogger })
      const executionId = 'exec-123-abc'
      const metrics: ExecutionMetrics = {
        fetchedRecords: 100,
        transformedRecords: 95,
        sendSuccess: 0,
        sendFailed: 0,
        spoolSaved: 0,
        spoolResendSuccess: 0,
        failedMoved: 0,
      }
      const durationMs = 5000

      // Act
      reporter.report(executionId, metrics, durationMs)

      // Assert
      expect(logInfoCalls[0].meta?.recordsPerSecond).toBe(0)
    })
  })

  describe('ロガー連携', () => {
    it('Logger.info() が呼ばれる', () => {
      // Arrange
      const reporter = createMetricsReporter({ logger: mockLogger })
      const executionId = 'exec-123-abc'
      const metrics: ExecutionMetrics = {
        fetchedRecords: 100,
        transformedRecords: 95,
        sendSuccess: 90,
        sendFailed: 5,
        spoolSaved: 3,
        spoolResendSuccess: 2,
        failedMoved: 1,
      }
      const durationMs = 5000

      // Act
      reporter.report(executionId, metrics, durationMs)

      // Assert
      expect(mockLogger.info).toHaveBeenCalledTimes(1)
    })

    it('構造化ログとして出力される', () => {
      // Arrange
      const reporter = createMetricsReporter({ logger: mockLogger })
      const executionId = 'exec-123-abc'
      const metrics: ExecutionMetrics = {
        fetchedRecords: 100,
        transformedRecords: 95,
        sendSuccess: 90,
        sendFailed: 5,
        spoolSaved: 3,
        spoolResendSuccess: 2,
        failedMoved: 1,
      }
      const durationMs = 5000

      // Act
      reporter.report(executionId, metrics, durationMs)

      // Assert
      const call = logInfoCalls[0]
      expect(call.meta).toEqual({
        executionId,
        metrics,
        durationMs,
        recordsPerSecond: 18, // 90 / 5 = 18
      })
    })
  })
})
