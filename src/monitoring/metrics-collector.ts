/**
 * MetricsCollector - ジョブ実行中のメトリクス収集
 *
 * Design Doc: specs/stories/5-monitoring-logging-healthcheck/design.md
 * 対応AC: AC-MC-1, AC-MC-3, AC-MC-4, AC-LOG-2
 */

import { randomBytes } from 'node:crypto'
import type { ExecutionMetrics } from '../types/metrics.js'

/**
 * メトリクスコレクターインターフェース
 */
export interface MetricsCollector {
  /**
   * メトリクス収集を開始する
   * - executionIdを生成（パターン: exec-${timestamp}-${randomSuffix}）
   * - 開始時刻を記録
   * @returns 生成されたexecutionId
   */
  startCollection(): string

  /**
   * メトリクス収集を停止する
   * - 終了時刻を記録
   */
  stopCollection(): void

  recordFetched(count: number): void
  recordTransformed(count: number): void
  recordSendSuccess(count: number): void
  recordSendFailed(count: number): void
  recordSpoolSaved(count: number): void
  recordSpoolResendSuccess(count: number): void
  recordFailedMoved(count: number): void

  getMetrics(): ExecutionMetrics
  getExecutionDuration(): number
  getExecutionId(): string
}

/**
 * メトリクスコレクターを作成する
 *
 * @returns MetricsCollectorインスタンス
 */
export function createMetricsCollector(): MetricsCollector {
  let executionId = ''
  let startTime: number | null = null
  let endTime: number | null = null
  let metrics: ExecutionMetrics = createInitialMetrics()

  /**
   * 初期メトリクスを作成
   */
  function createInitialMetrics(): ExecutionMetrics {
    return {
      fetchedRecords: 0,
      transformedRecords: 0,
      sendSuccess: 0,
      sendFailed: 0,
      spoolSaved: 0,
      spoolResendSuccess: 0,
      failedMoved: 0,
    }
  }

  /**
   * executionIdを生成
   * パターン: exec-${timestamp}-${randomHex}
   */
  function generateExecutionId(): string {
    const timestamp = Date.now()
    const randomHex = randomBytes(4).toString('hex')
    return `exec-${timestamp}-${randomHex}`
  }

  /**
   * 正の数値のみ加算するヘルパー
   */
  function addPositive(current: number, value: number): number {
    if (value < 0) {
      return current
    }
    return current + value
  }

  return {
    startCollection(): string {
      executionId = generateExecutionId()
      startTime = Date.now()
      endTime = null
      metrics = createInitialMetrics()
      return executionId
    },

    stopCollection(): void {
      endTime = Date.now()
    },

    recordFetched(count: number): void {
      metrics.fetchedRecords = addPositive(metrics.fetchedRecords, count)
    },

    recordTransformed(count: number): void {
      metrics.transformedRecords = addPositive(metrics.transformedRecords, count)
    },

    recordSendSuccess(count: number): void {
      metrics.sendSuccess = addPositive(metrics.sendSuccess, count)
    },

    recordSendFailed(count: number): void {
      metrics.sendFailed = addPositive(metrics.sendFailed, count)
    },

    recordSpoolSaved(count: number): void {
      metrics.spoolSaved = addPositive(metrics.spoolSaved, count)
    },

    recordSpoolResendSuccess(count: number): void {
      metrics.spoolResendSuccess = addPositive(metrics.spoolResendSuccess, count)
    },

    recordFailedMoved(count: number): void {
      metrics.failedMoved = addPositive(metrics.failedMoved, count)
    },

    getMetrics(): ExecutionMetrics {
      return { ...metrics }
    },

    getExecutionDuration(): number {
      if (startTime === null) {
        return 0
      }
      const end = endTime ?? Date.now()
      return end - startTime
    },

    getExecutionId(): string {
      return executionId
    },
  }
}
