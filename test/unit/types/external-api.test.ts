import { describe, expect, it } from 'vitest'
import { type ExternalApiRecord, externalApiRecordSchema } from '../../../src/types/external-api.js'

describe('externalApiRecordSchema', () => {
  describe('正常系', () => {
    it('should validate a correct record', () => {
      const record: ExternalApiRecord = {
        date: '2025-01-01',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
        idempotency_key: '2025-01-01_app-123_openai_gpt-4',
        transformed_at: '2025-01-01T00:00:00.000Z',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(true)
    })

    it('should allow optional app_name', () => {
      const record = {
        date: '2025-01-01',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
        idempotency_key: 'key',
        app_name: 'Test App',
        transformed_at: '2025-01-01T00:00:00.000Z',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(true)
    })

    it('should allow optional user_id', () => {
      const record = {
        date: '2025-01-01',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
        idempotency_key: 'key',
        user_id: 'user-456',
        transformed_at: '2025-01-01T00:00:00.000Z',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(true)
    })

    it('should allow both optional fields', () => {
      const record = {
        date: '2025-01-01',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
        idempotency_key: 'key',
        app_name: 'Test App',
        user_id: 'user-456',
        transformed_at: '2025-01-01T00:00:00.000Z',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(true)
    })

    it('should validate zero tokens', () => {
      const record = {
        date: '2025-01-01',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        idempotency_key: 'key',
        transformed_at: '2025-01-01T00:00:00.000Z',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(true)
    })
  })

  describe('異常系', () => {
    it('should reject invalid date format (YYYY/MM/DD)', () => {
      const record = {
        date: '2025/01/01',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
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
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
        idempotency_key: 'key',
        transformed_at: '2025-01-01T00:00:00.000Z',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(false)
    })

    it('should reject negative input_tokens', () => {
      const record = {
        date: '2025-01-01',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: -1,
        output_tokens: 200,
        total_tokens: 300,
        idempotency_key: 'key',
        transformed_at: '2025-01-01T00:00:00.000Z',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(false)
    })

    it('should reject negative output_tokens', () => {
      const record = {
        date: '2025-01-01',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: -1,
        total_tokens: 300,
        idempotency_key: 'key',
        transformed_at: '2025-01-01T00:00:00.000Z',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(false)
    })

    it('should reject negative total_tokens', () => {
      const record = {
        date: '2025-01-01',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: -1,
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
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
        idempotency_key: 'key',
        transformed_at: '2025-01-01T00:00:00.000Z',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(false)
    })

    it('should reject empty provider', () => {
      const record = {
        date: '2025-01-01',
        app_id: 'app-123',
        provider: '',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
        idempotency_key: 'key',
        transformed_at: '2025-01-01T00:00:00.000Z',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(false)
    })

    it('should reject empty model', () => {
      const record = {
        date: '2025-01-01',
        app_id: 'app-123',
        provider: 'openai',
        model: '',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
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
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
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
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
        idempotency_key: 'key',
        transformed_at: '2025-01-01 00:00:00',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(false)
    })

    it('should reject float tokens', () => {
      const record = {
        date: '2025-01-01',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100.5,
        output_tokens: 200,
        total_tokens: 300,
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
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        // total_tokens is missing
        idempotency_key: 'key',
        transformed_at: '2025-01-01T00:00:00.000Z',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(false)
    })
  })
})
