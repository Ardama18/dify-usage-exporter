/**
 * period-calculator のユニットテスト
 */

import { describe, expect, it } from 'vitest'
import { calculateDateRange, formatDate } from '../../../src/utils/period-calculator.js'

describe('calculateDateRange', () => {
  describe('today', () => {
    it('今日の日付範囲を返す', () => {
      const result = calculateDateRange('today')
      const today = new Date()

      expect(formatDate(result.startDate)).toBe(formatDate(today))
      expect(formatDate(result.endDate)).toBe(formatDate(today))
    })

    it('開始日と終了日が同じ日', () => {
      const result = calculateDateRange('today')

      expect(result.startDate.getDate()).toBe(result.endDate.getDate())
      expect(result.startDate.getMonth()).toBe(result.endDate.getMonth())
      expect(result.startDate.getFullYear()).toBe(result.endDate.getFullYear())
    })
  })

  describe('yesterday', () => {
    it('昨日の日付範囲を返す', () => {
      const result = calculateDateRange('yesterday')
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      expect(formatDate(result.startDate)).toBe(formatDate(yesterday))
      expect(formatDate(result.endDate)).toBe(formatDate(yesterday))
    })

    it('開始日と終了日が同じ日', () => {
      const result = calculateDateRange('yesterday')

      expect(result.startDate.getDate()).toBe(result.endDate.getDate())
      expect(result.startDate.getMonth()).toBe(result.endDate.getMonth())
      expect(result.startDate.getFullYear()).toBe(result.endDate.getFullYear())
    })
  })

  describe('current_month', () => {
    it('今月の日付範囲を返す', () => {
      const result = calculateDateRange('current_month')
      const now = new Date()

      // 開始日は月初
      expect(result.startDate.getDate()).toBe(1)
      expect(result.startDate.getMonth()).toBe(now.getMonth())

      // 終了日は月末
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      expect(result.endDate.getDate()).toBe(lastDay)
    })
  })

  describe('last_month', () => {
    it('先月の日付範囲を返す', () => {
      const result = calculateDateRange('last_month')
      const now = new Date()
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

      // 開始日は先月1日
      expect(result.startDate.getDate()).toBe(1)
      expect(result.startDate.getMonth()).toBe(lastMonth.getMonth())

      // 終了日は先月末
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate()
      expect(result.endDate.getDate()).toBe(lastDay)
    })
  })

  describe('current_week', () => {
    it('今週の日付範囲を返す（月曜始まり）', () => {
      const result = calculateDateRange('current_week')

      // 開始日は月曜日
      const startDayOfWeek = result.startDate.getDay()
      expect(startDayOfWeek).toBe(1) // 月曜日

      // 終了日は日曜日
      const endDayOfWeek = result.endDate.getDay()
      expect(endDayOfWeek).toBe(0) // 日曜日
    })
  })

  describe('last_week', () => {
    it('先週の日付範囲を返す（月曜始まり）', () => {
      const result = calculateDateRange('last_week')

      // 開始日は月曜日
      const startDayOfWeek = result.startDate.getDay()
      expect(startDayOfWeek).toBe(1) // 月曜日

      // 終了日は日曜日
      const endDayOfWeek = result.endDate.getDay()
      expect(endDayOfWeek).toBe(0) // 日曜日

      // 先週なので今週より前
      const currentWeek = calculateDateRange('current_week')
      expect(result.endDate < currentWeek.startDate).toBe(true)
    })
  })

  describe('custom', () => {
    it('カスタム期間を返す', () => {
      const result = calculateDateRange('custom', '2025-01-01', '2025-01-31')

      expect(formatDate(result.startDate)).toBe('2025-01-01')
      expect(formatDate(result.endDate)).toBe('2025-01-31')
    })

    it('開始日・終了日未指定でエラー', () => {
      expect(() => calculateDateRange('custom')).toThrow()
      expect(() => calculateDateRange('custom', '2025-01-01')).toThrow()
    })

    it('開始日が終了日より後でエラー', () => {
      expect(() => calculateDateRange('custom', '2025-01-31', '2025-01-01')).toThrow()
    })
  })
})
