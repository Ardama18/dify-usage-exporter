import { describe, expect, it } from 'vitest'
import { type ExternalApiRecord, externalApiRecordSchema } from '../../../src/types/external-api.js'

describe('externalApiRecordSchema', () => {
  describe('正常系', () => {
    it('should validate a correct record', () => {
      const record: ExternalApiRecord = {
        date: '2025-01-01',
        app_id: 'app-123',
        app_name: 'Test App',
        token_count: 100,
        total_price: '0.001',
        currency: 'USD',
        idempotency_key: '2025-01-01_app-123',
        transformed_at: '2025-01-01T00:00:00.000Z',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(true)
    })

    it('should validate zero token_count', () => {
      const record = {
        date: '2025-01-01',
        app_id: 'app-123',
        app_name: 'Test App',
        token_count: 0,
        total_price: '0.000',
        currency: 'USD',
        idempotency_key: 'key',
        transformed_at: '2025-01-01T00:00:00.000Z',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(true)
    })

    it('should use default currency when not provided', () => {
      const record = {
        date: '2025-01-01',
        app_id: 'app-123',
        app_name: 'Test App',
        token_count: 100,
        total_price: '0.001',
        idempotency_key: 'key',
        transformed_at: '2025-01-01T00:00:00.000Z',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.currency).toBe('USD')
      }
    })
  })

  describe('異常系', () => {
    it('should reject invalid date format (YYYY/MM/DD)', () => {
      const record = {
        date: '2025/01/01',
        app_id: 'app-123',
        app_name: 'Test App',
        token_count: 100,
        total_price: '0.001',
        currency: 'USD',
        idempotency_key: 'key',
        transformed_at: '2025-01-01T00:00:00.000Z',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(false)
    })

    it('should reject invalid date format (DD-MM-YYYY)', () => {
      const record = {
        date: '01-01-2025',
        app_id: 'app-123',
        app_name: 'Test App',
        token_count: 100,
        total_price: '0.001',
        currency: 'USD',
        idempotency_key: 'key',
        transformed_at: '2025-01-01T00:00:00.000Z',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(false)
    })

    it('should reject negative token_count', () => {
      const record = {
        date: '2025-01-01',
        app_id: 'app-123',
        app_name: 'Test App',
        token_count: -1,
        total_price: '0.001',
        currency: 'USD',
        idempotency_key: 'key',
        transformed_at: '2025-01-01T00:00:00.000Z',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(false)
    })

    it('should reject empty app_id', () => {
      const record = {
        date: '2025-01-01',
        app_id: '',
        app_name: 'Test App',
        token_count: 100,
        total_price: '0.001',
        currency: 'USD',
        idempotency_key: 'key',
        transformed_at: '2025-01-01T00:00:00.000Z',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(false)
    })

    it('should reject empty app_name', () => {
      const record = {
        date: '2025-01-01',
        app_id: 'app-123',
        app_name: '',
        token_count: 100,
        total_price: '0.001',
        currency: 'USD',
        idempotency_key: 'key',
        transformed_at: '2025-01-01T00:00:00.000Z',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(false)
    })

    it('should reject empty idempotency_key', () => {
      const record = {
        date: '2025-01-01',
        app_id: 'app-123',
        app_name: 'Test App',
        token_count: 100,
        total_price: '0.001',
        currency: 'USD',
        idempotency_key: '',
        transformed_at: '2025-01-01T00:00:00.000Z',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(false)
    })

    it('should reject invalid transformed_at format', () => {
      const record = {
        date: '2025-01-01',
        app_id: 'app-123',
        app_name: 'Test App',
        token_count: 100,
        total_price: '0.001',
        currency: 'USD',
        idempotency_key: 'key',
        transformed_at: '2025-01-01 00:00:00',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(false)
    })

    it('should reject float token_count', () => {
      const record = {
        date: '2025-01-01',
        app_id: 'app-123',
        app_name: 'Test App',
        token_count: 100.5,
        total_price: '0.001',
        currency: 'USD',
        idempotency_key: 'key',
        transformed_at: '2025-01-01T00:00:00.000Z',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(false)
    })

    it('should reject missing required field', () => {
      const record = {
        date: '2025-01-01',
        app_id: 'app-123',
        app_name: 'Test App',
        // token_count is missing
        total_price: '0.001',
        currency: 'USD',
        idempotency_key: 'key',
        transformed_at: '2025-01-01T00:00:00.000Z',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(false)
    })
  })
})
