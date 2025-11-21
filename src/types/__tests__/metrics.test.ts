/**
 * ExecutionMetrics型のテスト
 *
 * Design Doc仕様に基づくExecutionMetrics型の検証
 */

import { describe, expect, it } from 'vitest'
import type { ExecutionMetrics } from '../metrics.js'

describe('ExecutionMetrics型', () => {
  it('すべての必須フィールドを持つこと', () => {
    // Arrange: Design Doc仕様に基づくメトリクスオブジェクト
    const metrics: ExecutionMetrics = {
      // Story 1, 2, 3の既存メトリクス
      fetchedRecords: 100,
      transformedRecords: 95,
      // Story 4で追加
      sendSuccess: 90,
      sendFailed: 5,
      spoolSaved: 3,
      spoolResendSuccess: 2,
      failedMoved: 1,
    }

    // Assert: 各フィールドが正しく型付けされている
    expect(metrics.fetchedRecords).toBe(100)
    expect(metrics.transformedRecords).toBe(95)
    expect(metrics.sendSuccess).toBe(90)
    expect(metrics.sendFailed).toBe(5)
    expect(metrics.spoolSaved).toBe(3)
    expect(metrics.spoolResendSuccess).toBe(2)
    expect(metrics.failedMoved).toBe(1)
  })

  it('数値型のフィールドのみを持つこと', () => {
    // Arrange
    const metrics: ExecutionMetrics = {
      fetchedRecords: 10,
      transformedRecords: 10,
      sendSuccess: 10,
      sendFailed: 0,
      spoolSaved: 0,
      spoolResendSuccess: 0,
      failedMoved: 0,
    }

    // Assert: すべてのフィールドがnumber型
    expect(typeof metrics.fetchedRecords).toBe('number')
    expect(typeof metrics.transformedRecords).toBe('number')
    expect(typeof metrics.sendSuccess).toBe('number')
    expect(typeof metrics.sendFailed).toBe('number')
    expect(typeof metrics.spoolSaved).toBe('number')
    expect(typeof metrics.spoolResendSuccess).toBe('number')
    expect(typeof metrics.failedMoved).toBe('number')
  })

  it('初期状態として0を設定できること', () => {
    // Arrange: 初期化時のメトリクス
    const metrics: ExecutionMetrics = {
      fetchedRecords: 0,
      transformedRecords: 0,
      sendSuccess: 0,
      sendFailed: 0,
      spoolSaved: 0,
      spoolResendSuccess: 0,
      failedMoved: 0,
    }

    // Assert: すべて0で初期化可能
    expect(metrics.fetchedRecords).toBe(0)
    expect(metrics.transformedRecords).toBe(0)
    expect(metrics.sendSuccess).toBe(0)
    expect(metrics.sendFailed).toBe(0)
    expect(metrics.spoolSaved).toBe(0)
    expect(metrics.spoolResendSuccess).toBe(0)
    expect(metrics.failedMoved).toBe(0)
  })

  it('Story 4の送信メトリクスフィールドを持つこと', () => {
    // Arrange: Story 4のメトリクスのみ
    const metrics: ExecutionMetrics = {
      fetchedRecords: 0,
      transformedRecords: 0,
      // Story 4の追加フィールド
      sendSuccess: 100,
      sendFailed: 5,
      spoolSaved: 3,
      spoolResendSuccess: 2,
      failedMoved: 1,
    }

    // Assert: Story 4の追加フィールドが正しく設定されている
    expect(metrics.sendSuccess).toBe(100)
    expect(metrics.sendFailed).toBe(5)
    expect(metrics.spoolSaved).toBe(3)
    expect(metrics.spoolResendSuccess).toBe(2)
    expect(metrics.failedMoved).toBe(1)
  })
})
