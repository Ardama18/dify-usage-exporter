/**
 * MetricsCollector 単体テスト
 *
 * Design Doc: specs/stories/5-monitoring-logging-healthcheck/design.md
 * 対応AC: AC-MC-1, AC-MC-3, AC-MC-4, AC-LOG-2
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { createMetricsCollector, type MetricsCollector } from '../metrics-collector.js'

describe('MetricsCollector', () => {
  let collector: MetricsCollector

  beforeEach(() => {
    collector = createMetricsCollector()
  })

  describe('基本動作', () => {
    it('createMetricsCollector がコレクターインスタンスを返す', () => {
      expect(collector).toBeDefined()
      expect(typeof collector.startCollection).toBe('function')
      expect(typeof collector.stopCollection).toBe('function')
      expect(typeof collector.getExecutionId).toBe('function')
      expect(typeof collector.getExecutionDuration).toBe('function')
      expect(typeof collector.getMetrics).toBe('function')
    })

    it('startCollection() で収集開始し executionId を返す', () => {
      const executionId = collector.startCollection()
      expect(executionId).toBeDefined()
      expect(typeof executionId).toBe('string')
    })

    it('stopCollection() で収集停止', () => {
      collector.startCollection()
      expect(() => collector.stopCollection()).not.toThrow()
    })

    it('getExecutionId() が正しい形式を返す（exec-{timestamp}-{hex}）', () => {
      collector.startCollection()
      const executionId = collector.getExecutionId()

      // exec-{timestamp}-{hex} 形式を検証
      const pattern = /^exec-\d+-[a-f0-9]+$/
      expect(executionId).toMatch(pattern)
    })

    it('getExecutionDuration() が実行時間を返す', async () => {
      collector.startCollection()

      // 少し待機
      await new Promise((resolve) => setTimeout(resolve, 10))

      collector.stopCollection()
      const duration = collector.getExecutionDuration()

      // タイマー精度の関係で若干の誤差を許容
      expect(duration).toBeGreaterThanOrEqual(5)
      expect(typeof duration).toBe('number')
    })

    it('startCollection() が新しい executionId を生成する', () => {
      const id1 = collector.startCollection()
      collector.stopCollection()
      const id2 = collector.startCollection()

      expect(id1).not.toBe(id2)
    })
  })

  describe('メトリクス記録', () => {
    beforeEach(() => {
      collector.startCollection()
    })

    it('recordFetched(count) でフェッチ済みレコード数が加算', () => {
      collector.recordFetched(10)
      const metrics = collector.getMetrics()
      expect(metrics.fetchedRecords).toBe(10)

      collector.recordFetched(5)
      const updatedMetrics = collector.getMetrics()
      expect(updatedMetrics.fetchedRecords).toBe(15)
    })

    it('recordTransformed(count) で変換済みレコード数が加算', () => {
      collector.recordTransformed(8)
      const metrics = collector.getMetrics()
      expect(metrics.transformedRecords).toBe(8)

      collector.recordTransformed(3)
      const updatedMetrics = collector.getMetrics()
      expect(updatedMetrics.transformedRecords).toBe(11)
    })

    it('recordSendSuccess(count) で送信成功数が加算', () => {
      collector.recordSendSuccess(7)
      const metrics = collector.getMetrics()
      expect(metrics.sendSuccess).toBe(7)

      collector.recordSendSuccess(2)
      const updatedMetrics = collector.getMetrics()
      expect(updatedMetrics.sendSuccess).toBe(9)
    })

    it('recordSendFailed(count) で送信失敗数が加算', () => {
      collector.recordSendFailed(3)
      const metrics = collector.getMetrics()
      expect(metrics.sendFailed).toBe(3)

      collector.recordSendFailed(1)
      const updatedMetrics = collector.getMetrics()
      expect(updatedMetrics.sendFailed).toBe(4)
    })

    it('recordSpoolSaved(count) でスプール保存数が加算', () => {
      collector.recordSpoolSaved(2)
      const metrics = collector.getMetrics()
      expect(metrics.spoolSaved).toBe(2)

      collector.recordSpoolSaved(1)
      const updatedMetrics = collector.getMetrics()
      expect(updatedMetrics.spoolSaved).toBe(3)
    })

    it('recordSpoolResendSuccess(count) でスプール再送成功数が加算', () => {
      collector.recordSpoolResendSuccess(1)
      const metrics = collector.getMetrics()
      expect(metrics.spoolResendSuccess).toBe(1)

      collector.recordSpoolResendSuccess(2)
      const updatedMetrics = collector.getMetrics()
      expect(updatedMetrics.spoolResendSuccess).toBe(3)
    })

    it('recordFailedMoved(count) でfailed移動数が加算', () => {
      collector.recordFailedMoved(1)
      const metrics = collector.getMetrics()
      expect(metrics.failedMoved).toBe(1)

      collector.recordFailedMoved(1)
      const updatedMetrics = collector.getMetrics()
      expect(updatedMetrics.failedMoved).toBe(2)
    })
  })

  describe('メトリクス取得', () => {
    it('getMetrics() が全メトリクスを返す', () => {
      collector.startCollection()
      const metrics = collector.getMetrics()

      expect(metrics).toHaveProperty('fetchedRecords')
      expect(metrics).toHaveProperty('transformedRecords')
      expect(metrics).toHaveProperty('sendSuccess')
      expect(metrics).toHaveProperty('sendFailed')
      expect(metrics).toHaveProperty('spoolSaved')
      expect(metrics).toHaveProperty('spoolResendSuccess')
      expect(metrics).toHaveProperty('failedMoved')
    })

    it('初期値がすべて0である', () => {
      collector.startCollection()
      const metrics = collector.getMetrics()

      expect(metrics.fetchedRecords).toBe(0)
      expect(metrics.transformedRecords).toBe(0)
      expect(metrics.sendSuccess).toBe(0)
      expect(metrics.sendFailed).toBe(0)
      expect(metrics.spoolSaved).toBe(0)
      expect(metrics.spoolResendSuccess).toBe(0)
      expect(metrics.failedMoved).toBe(0)
    })

    it('複数回の記録が累積される', () => {
      collector.startCollection()

      collector.recordFetched(10)
      collector.recordTransformed(8)
      collector.recordSendSuccess(5)
      collector.recordSendFailed(2)
      collector.recordSpoolSaved(1)
      collector.recordSpoolResendSuccess(0)
      collector.recordFailedMoved(1)

      const metrics = collector.getMetrics()
      expect(metrics.fetchedRecords).toBe(10)
      expect(metrics.transformedRecords).toBe(8)
      expect(metrics.sendSuccess).toBe(5)
      expect(metrics.sendFailed).toBe(2)
      expect(metrics.spoolSaved).toBe(1)
      expect(metrics.spoolResendSuccess).toBe(0)
      expect(metrics.failedMoved).toBe(1)
    })
  })

  describe('エッジケース', () => {
    it('startCollection() を2回呼んでも問題ない', () => {
      const id1 = collector.startCollection()
      const id2 = collector.startCollection()

      // 2回目は新しいIDが生成される（リセット）
      expect(id1).not.toBe(id2)
    })

    it('stopCollection() を startCollection() なしで呼んでも問題ない', () => {
      expect(() => collector.stopCollection()).not.toThrow()
    })

    it('startCollection() 前の getExecutionId() が空文字を返す', () => {
      const executionId = collector.getExecutionId()
      expect(executionId).toBe('')
    })

    it('startCollection() 前の getExecutionDuration() が0を返す', () => {
      const duration = collector.getExecutionDuration()
      expect(duration).toBe(0)
    })

    it('stopCollection() 前の getExecutionDuration() が現在までの経過時間を返す', async () => {
      collector.startCollection()

      await new Promise((resolve) => setTimeout(resolve, 10))

      const duration = collector.getExecutionDuration()
      expect(duration).toBeGreaterThanOrEqual(10)
    })

    it('recordFetched(0) が正常に動作する', () => {
      collector.startCollection()
      collector.recordFetched(0)
      const metrics = collector.getMetrics()
      expect(metrics.fetchedRecords).toBe(0)
    })

    it('負の数値を引数として渡してもカウントされない', () => {
      collector.startCollection()
      collector.recordFetched(10)
      collector.recordFetched(-5)
      const metrics = collector.getMetrics()
      // 負の値は無視される
      expect(metrics.fetchedRecords).toBe(10)
    })

    it('状態がリセットされる（複数回のstartCollection）', () => {
      collector.startCollection()
      collector.recordFetched(100)
      collector.stopCollection()

      // 新しい収集を開始
      collector.startCollection()
      const metrics = collector.getMetrics()

      // メトリクスがリセットされている
      expect(metrics.fetchedRecords).toBe(0)
    })
  })
})
