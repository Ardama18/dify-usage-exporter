import { describe, expect, it } from 'vitest'
import {
  generateBatchIdempotencyKey,
  generateRecordIdempotencyKey,
  type RecordKeyParams,
} from '../../../src/transformer/idempotency-key.js'

describe('generateRecordIdempotencyKey', () => {
  describe('正常系', () => {
    it('should generate key in correct format', () => {
      const params: RecordKeyParams = {
        date: '2025-01-01',
        app_id: 'app-123',
      }

      const result = generateRecordIdempotencyKey(params)

      expect(result).toBe('2025-01-01_app-123')
    })

    it('should return same key for same input (idempotency)', () => {
      const params: RecordKeyParams = {
        date: '2025-01-01',
        app_id: 'app-123',
      }

      const result1 = generateRecordIdempotencyKey(params)
      const result2 = generateRecordIdempotencyKey(params)

      expect(result1).toBe(result2)
    })

    it('should return different key for different date', () => {
      const params1: RecordKeyParams = {
        date: '2025-01-01',
        app_id: 'app-123',
      }
      const params2: RecordKeyParams = {
        date: '2025-01-02',
        app_id: 'app-123',
      }

      const result1 = generateRecordIdempotencyKey(params1)
      const result2 = generateRecordIdempotencyKey(params2)

      expect(result1).not.toBe(result2)
    })

    it('should return different key for different app_id', () => {
      const params1: RecordKeyParams = {
        date: '2025-01-01',
        app_id: 'app-123',
      }
      const params2: RecordKeyParams = {
        date: '2025-01-01',
        app_id: 'app-456',
      }

      const result1 = generateRecordIdempotencyKey(params1)
      const result2 = generateRecordIdempotencyKey(params2)

      expect(result1).not.toBe(result2)
    })
  })
})

describe('generateBatchIdempotencyKey', () => {
  describe('正常系', () => {
    it('should return empty string for empty array', () => {
      const result = generateBatchIdempotencyKey([])

      expect(result).toBe('')
    })

    it('should generate SHA256 hash (64 hex characters)', () => {
      const keys = ['key1', 'key2', 'key3']

      const result = generateBatchIdempotencyKey(keys)

      expect(result).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should return same hash for same keys regardless of order', () => {
      const keys1 = ['key1', 'key2', 'key3']
      const keys2 = ['key3', 'key1', 'key2']

      const result1 = generateBatchIdempotencyKey(keys1)
      const result2 = generateBatchIdempotencyKey(keys2)

      expect(result1).toBe(result2)
    })

    it('should handle single record', () => {
      const keys = ['single-key']

      const result = generateBatchIdempotencyKey(keys)

      expect(result).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should handle large number of records (1000)', () => {
      const keys = Array.from({ length: 1000 }, (_, i) => `key-${i}`)

      const result = generateBatchIdempotencyKey(keys)

      expect(result).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should return deterministic result for duplicate keys', () => {
      const keys1 = ['key1', 'key1', 'key2']
      const keys2 = ['key1', 'key1', 'key2']

      const result1 = generateBatchIdempotencyKey(keys1)
      const result2 = generateBatchIdempotencyKey(keys2)

      expect(result1).toBe(result2)
    })

    it('should return different hash for different keys', () => {
      const keys1 = ['key1', 'key2']
      const keys2 = ['key1', 'key3']

      const result1 = generateBatchIdempotencyKey(keys1)
      const result2 = generateBatchIdempotencyKey(keys2)

      expect(result1).not.toBe(result2)
    })
  })
})
