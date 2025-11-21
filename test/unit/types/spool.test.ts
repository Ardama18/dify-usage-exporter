import { describe, expect, it } from 'vitest'
import { spoolFileSchema } from '../../../src/types/spool.js'

describe('SpoolFile型定義', () => {
  describe('spoolFileSchema', () => {
    it('正常なSpoolFileをバリデーション成功すること', () => {
      const validSpoolFile = {
        batchIdempotencyKey: 'test-batch-key-123',
        records: [
          {
            date: '2025-01-21',
            app_id: 'test-app-id',
            provider: 'openai',
            model: 'gpt-4',
            input_tokens: 100,
            output_tokens: 50,
            total_tokens: 150,
            idempotency_key: 'test-key-1',
            transformed_at: '2025-01-21T10:00:00.000Z',
          },
        ],
        firstAttempt: '2025-01-21T10:00:00.000Z',
        retryCount: 0,
        lastError: '',
      }

      const result = spoolFileSchema.safeParse(validSpoolFile)
      expect(result.success).toBe(true)
    })

    it('batchIdempotencyKeyが空文字列の場合、バリデーション成功すること', () => {
      const validSpoolFile = {
        batchIdempotencyKey: '',
        records: [],
        firstAttempt: '2025-01-21T10:00:00.000Z',
        retryCount: 0,
        lastError: '',
      }

      const result = spoolFileSchema.safeParse(validSpoolFile)
      expect(result.success).toBe(true)
    })

    it('firstAttemptがISO 8601形式でない場合、バリデーション失敗すること', () => {
      const invalidSpoolFile = {
        batchIdempotencyKey: 'test-batch-key',
        records: [],
        firstAttempt: '2025-01-21 10:00:00', // 不正な形式
        retryCount: 0,
        lastError: '',
      }

      const result = spoolFileSchema.safeParse(invalidSpoolFile)
      expect(result.success).toBe(false)
    })

    it('retryCountが負の場合、バリデーション失敗すること', () => {
      const invalidSpoolFile = {
        batchIdempotencyKey: 'test-batch-key',
        records: [],
        firstAttempt: '2025-01-21T10:00:00.000Z',
        retryCount: -1, // 負の値
        lastError: '',
      }

      const result = spoolFileSchema.safeParse(invalidSpoolFile)
      expect(result.success).toBe(false)
    })

    it('必須フィールドが欠けている場合、バリデーション失敗すること', () => {
      const invalidSpoolFile = {
        batchIdempotencyKey: 'test-batch-key',
        records: [],
        // firstAttemptがない
        retryCount: 0,
        lastError: '',
      }

      const result = spoolFileSchema.safeParse(invalidSpoolFile)
      expect(result.success).toBe(false)
    })
  })
})
