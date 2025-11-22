/**
 * MetricsReporter - 収集したメトリクスをJSON Lines形式でログ出力
 *
 * Design Doc: specs/stories/5-monitoring-logging-healthcheck/design.md
 * 対応AC: AC-MC-2, AC-MC-5, AC-LOG-1, AC-LOG-2
 */

import type { Logger } from '../logger/winston-logger.js'
import type { ExecutionMetrics } from '../types/metrics.js'

/**
 * メトリクスレポーターのオプション
 */
export interface MetricsReporterOptions {
  logger: Logger
}

/**
 * メトリクスレポーターインターフェース
 */
export interface MetricsReporter {
  /**
   * メトリクスをログ出力する
   *
   * @param executionId - 実行ID
   * @param metrics - 実行メトリクス
   * @param durationMs - 実行時間（ミリ秒）
   */
  report(executionId: string, metrics: ExecutionMetrics, durationMs: number): void
}

/**
 * メトリクスレポーターを作成する
 *
 * @param options - レポーターオプション（ロガーを含む）
 * @returns MetricsReporterインスタンス
 */
export function createMetricsReporter(options: MetricsReporterOptions): MetricsReporter {
  const { logger } = options

  /**
   * レコード/秒を計算する
   *
   * @param sentRecords - 送信成功レコード数
   * @param durationMs - 実行時間（ミリ秒）
   * @returns レコード/秒
   */
  function calculateRecordsPerSecond(sentRecords: number, durationMs: number): number {
    if (durationMs === 0 || sentRecords === 0) {
      return 0
    }
    return sentRecords / (durationMs / 1000)
  }

  return {
    report(executionId: string, metrics: ExecutionMetrics, durationMs: number): void {
      const recordsPerSecond = calculateRecordsPerSecond(metrics.sendSuccess, durationMs)

      logger.info('ジョブ完了メトリクス', {
        executionId,
        metrics,
        durationMs,
        recordsPerSecond,
      })
    },
  }
}
