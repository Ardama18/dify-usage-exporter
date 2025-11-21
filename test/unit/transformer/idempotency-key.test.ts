import { describe, expect, it } from 'vitest'
import {
  generateRecordIdempotencyKey,
  type RecordKeyParams,
} from '../../../src/transformer/idempotency-key.js'

describe('generateRecordIdempotencyKey', () => {
  describe('正常系', () => {
    it('should generate key in correct format', () => {
      const params: RecordKeyParams = {
        date: '2025-01-01',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
      }

      const result = generateRecordIdempotencyKey(params)

      expect(result).toBe('2025-01-01_app-123_openai_gpt-4')
    })

    it('should return same key for same input (idempotency)', () => {
      const params: RecordKeyParams = {
        date: '2025-01-01',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
      }

      const result1 = generateRecordIdempotencyKey(params)
      const result2 = generateRecordIdempotencyKey(params)

      expect(result1).toBe(result2)
    })

    it('should return different key for different input (uniqueness)', () => {
      const params1: RecordKeyParams = {
        date: '2025-01-01',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
      }
      const params2: RecordKeyParams = {
        date: '2025-01-02',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
      }

      const result1 = generateRecordIdempotencyKey(params1)
      const result2 = generateRecordIdempotencyKey(params2)

      expect(result1).not.toBe(result2)
    })

    it('should handle different providers correctly', () => {
      const params: RecordKeyParams = {
        date: '2025-01-01',
        app_id: 'app-456',
        provider: 'anthropic',
        model: 'claude-3',
      }

      const result = generateRecordIdempotencyKey(params)

      expect(result).toBe('2025-01-01_app-456_anthropic_claude-3')
    })
  })
})
