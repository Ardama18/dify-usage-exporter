import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatDateToISO, getCurrentISOTimestamp } from '../../../src/utils/date-utils.js'

describe('date-utils', () => {
  describe('getCurrentISOTimestamp', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return ISO 8601 formatted timestamp', () => {
      const mockDate = new Date('2025-01-15T10:30:00.000Z')
      vi.setSystemTime(mockDate)

      const result = getCurrentISOTimestamp()

      // ISO 8601形式であることを確認
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('should include timezone information', () => {
      const mockDate = new Date('2025-01-15T10:30:00.000Z')
      vi.setSystemTime(mockDate)

      const result = getCurrentISOTimestamp()

      // タイムゾーン情報（+00:00 or Z）が含まれることを確認
      expect(result).toMatch(/(\+\d{2}:\d{2}|Z)$/)
    })
  })

  describe('formatDateToISO', () => {
    it('should format Date object to ISO 8601 string', () => {
      const date = new Date('2025-01-15T10:30:00.000Z')

      const result = formatDateToISO(date)

      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('should handle different dates correctly', () => {
      const date1 = new Date('2025-06-01T12:00:00.000Z')
      const date2 = new Date('2025-12-15T12:00:00.000Z')

      const result1 = formatDateToISO(date1)
      const result2 = formatDateToISO(date2)

      // ISO 8601形式で異なる日付が正しく処理されることを確認
      expect(result1).toMatch(/2025-06-01/)
      expect(result2).toMatch(/2025-12-15/)
    })

    it('should return complete ISO format with time', () => {
      const date = new Date('2025-01-15T14:30:45.000Z')

      const result = formatDateToISO(date)

      // 時刻情報が含まれることを確認
      expect(result).toMatch(/T\d{2}:\d{2}:\d{2}/)
    })
  })
})
