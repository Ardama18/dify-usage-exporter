import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDataTransformer,
  type TransformerDeps,
} from '../../src/transformer/data-transformer.js'
import type { DifyUsageRecord } from '../../src/types/dify-usage.js'
import { externalApiRecordSchema } from '../../src/types/external-api.js'

describe('Data Transformation Integration Tests', () => {
  let mockLogger: TransformerDeps['logger']
  let transformer: ReturnType<typeof createDataTransformer>

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    } as unknown as TransformerDeps['logger']

    transformer = createDataTransformer({ logger: mockLogger })
  })

  describe('AC1: Dify API形式から外部API形式への変換', () => {
    it('AC1-1: should transform DifyUsageRecord[] to ExternalApiRecord[]', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
      ]

      const result = transformer.transform(records)

      expect(result.records).toHaveLength(1)
      expect(result.successCount).toBe(1)
    })

    it('AC1-2: should add transformed_at in ISO 8601 format', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
      ]

      const result = transformer.transform(records)

      expect(result.records[0].transformed_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('AC1-3: should normalize provider to lowercase and trim whitespace', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          provider: '  OpenAI  ',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
      ]

      const result = transformer.transform(records)

      expect(result.records[0].provider).toBe('openai')
    })

    it('AC1-4: should normalize model to lowercase and trim whitespace', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          provider: 'openai',
          model: '  GPT-4  ',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
      ]

      const result = transformer.transform(records)

      expect(result.records[0].model).toBe('gpt-4')
    })

    it('should preserve optional fields', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          app_name: 'Test App',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
          user_id: 'user-456',
        },
      ]

      const result = transformer.transform(records)

      expect(result.records[0].app_name).toBe('Test App')
      expect(result.records[0].user_id).toBe('user-456')
    })

    it('should handle multiple records', () => {
      const records: DifyUsageRecord[] = Array.from({ length: 5 }, (_, i) => ({
        date: '2025-01-01',
        app_id: `app-${i}`,
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
      }))

      const result = transformer.transform(records)

      expect(result.records).toHaveLength(5)
      expect(result.successCount).toBe(5)
    })

    it('should handle empty array', () => {
      const result = transformer.transform([])

      expect(result.records).toHaveLength(0)
      expect(result.successCount).toBe(0)
      expect(result.errorCount).toBe(0)
    })

    it('should validate output with zod schema', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
      ]

      const result = transformer.transform(records)

      const validation = externalApiRecordSchema.safeParse(result.records[0])
      expect(validation.success).toBe(true)
    })
  })

  describe('AC2: レコード単位冪等キー生成', () => {
    it('AC2-1: should generate key in {date}_{app_id}_{provider}_{model} format', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
      ]

      const result = transformer.transform(records)

      expect(result.records[0].idempotency_key).toBe('2025-01-01_app-123_openai_gpt-4')
    })

    it('AC2-2: should use normalized provider/model in key', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          provider: '  OpenAI  ',
          model: '  GPT-4  ',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
      ]

      const result = transformer.transform(records)

      expect(result.records[0].idempotency_key).toBe('2025-01-01_app-123_openai_gpt-4')
    })

    it('should generate unique keys for different records', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
        {
          date: '2025-01-02',
          app_id: 'app-123',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 50,
          output_tokens: 100,
          total_tokens: 150,
        },
      ]

      const result = transformer.transform(records)

      expect(result.records[0].idempotency_key).not.toBe(result.records[1].idempotency_key)
    })

    it('should generate same key for same input (idempotency)', () => {
      const record: DifyUsageRecord = {
        date: '2025-01-01',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
      }

      const result1 = transformer.transform([record])
      const result2 = transformer.transform([record])

      expect(result1.records[0].idempotency_key).toBe(result2.records[0].idempotency_key)
    })
  })

  describe('AC3: バッチ単位冪等キー生成', () => {
    it('AC3-1: should generate SHA256 hash of sorted record keys', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
      ]

      const result = transformer.transform(records)

      expect(result.batchIdempotencyKey).toMatch(/^[a-f0-9]{64}$/)
    })

    it('AC3-2: should return empty string for empty array', () => {
      const result = transformer.transform([])

      expect(result.batchIdempotencyKey).toBe('')
    })

    it('AC3-3: should generate same key regardless of order', () => {
      const records1: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-1',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
        {
          date: '2025-01-01',
          app_id: 'app-2',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 50,
          output_tokens: 100,
          total_tokens: 150,
        },
      ]
      const records2: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-2',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 50,
          output_tokens: 100,
          total_tokens: 150,
        },
        {
          date: '2025-01-01',
          app_id: 'app-1',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
      ]

      const result1 = transformer.transform(records1)
      const result2 = transformer.transform(records2)

      expect(result1.batchIdempotencyKey).toBe(result2.batchIdempotencyKey)
    })

    it('should generate different keys for different batches', () => {
      const records1: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-1',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
      ]
      const records2: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-2',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
      ]

      const result1 = transformer.transform(records1)
      const result2 = transformer.transform(records2)

      expect(result1.batchIdempotencyKey).not.toBe(result2.batchIdempotencyKey)
    })

    it('should handle large batches (100 records)', () => {
      const records = Array.from({ length: 100 }, (_, i) => ({
        date: '2025-01-01',
        app_id: `app-${i}`,
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
      }))

      const result = transformer.transform(records)

      expect(result.batchIdempotencyKey).toMatch(/^[a-f0-9]{64}$/)
      expect(result.successCount).toBe(100)
    })

    it('should only include successful records in batch key', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-1',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
        {
          date: '2025-01-01',
          app_id: '',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        }, // エラー
      ]

      const result = transformer.transform(records)

      expect(result.successCount).toBe(1)
      expect(result.batchIdempotencyKey).toMatch(/^[a-f0-9]{64}$/)
    })
  })

  describe('AC4: zodによるバリデーション', () => {
    it('AC4-1: should validate each transformed record with zod', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
      ]

      const result = transformer.transform(records)

      expect(result.records).toHaveLength(1)
      expect(result.errorCount).toBe(0)
    })

    it('AC4-2: should record validation failures in errors array', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: '', // 空文字列でバリデーションエラー
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
      ]

      const result = transformer.transform(records)

      expect(result.errorCount).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toContain('バリデーション')
    })

    it('should reject negative token values', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: -1,
          output_tokens: 200,
          total_tokens: 300,
        },
      ]

      const result = transformer.transform(records)

      expect(result.errorCount).toBe(1)
    })

    it('should reject empty provider', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          provider: '',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
      ]

      const result = transformer.transform(records)

      expect(result.errorCount).toBe(1)
    })

    it('should reject whitespace-only provider after normalization', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          provider: '   ', // 空白のみ → 正規化後は空文字列
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
      ]

      const result = transformer.transform(records)

      expect(result.errorCount).toBe(1)
    })
  })

  describe('AC5: エラーハンドリング', () => {
    it('AC5-1: should record errors and continue processing', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: '',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
        {
          date: '2025-01-01',
          app_id: 'app-123',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
      ]

      const result = transformer.transform(records)

      expect(result.successCount).toBe(1)
      expect(result.errorCount).toBe(1)
      expect(result.records).toHaveLength(1)
    })

    it('AC5-2: should guarantee successCount + errorCount = input count', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: '',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
        {
          date: '2025-01-01',
          app_id: 'app-123',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
        {
          date: '2025-01-01',
          app_id: '',
          provider: 'anthropic',
          model: 'claude-3',
          input_tokens: 50,
          output_tokens: 100,
          total_tokens: 150,
        },
      ]

      const result = transformer.transform(records)

      expect(result.successCount + result.errorCount).toBe(records.length)
    })

    it('AC5-3: should not throw exceptions', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: '',
          provider: '',
          model: '',
          input_tokens: -1,
          output_tokens: -1,
          total_tokens: -1,
        },
      ]

      expect(() => transformer.transform(records)).not.toThrow()
    })

    it('should include error details in TransformError', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: '',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
      ]

      const result = transformer.transform(records)

      expect(result.errors[0].recordIdentifier).toEqual({ date: '2025-01-01', app_id: '' })
      expect(result.errors[0].details).toBeDefined()
    })

    it('should handle multiple errors in single record', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: '',
          provider: '',
          model: 'gpt-4',
          input_tokens: -1,
          output_tokens: 200,
          total_tokens: 300,
        },
      ]

      const result = transformer.transform(records)

      expect(result.errorCount).toBe(1)
      // 最初のバリデーションエラーで失敗
    })

    it('should log transform completion', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
      ]

      transformer.transform(records)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Transform completed',
        expect.objectContaining({
          successCount: 1,
          errorCount: 0,
        }),
      )
    })
  })

  describe('AC6: パフォーマンス', () => {
    it('AC6-1: should transform 10,000 records within 5 seconds', () => {
      // テストデータ生成
      const records: DifyUsageRecord[] = Array.from({ length: 10000 }, (_, i) => ({
        date: `2025-01-${String((i % 28) + 1).padStart(2, '0')}`,
        app_id: `app-${i}`,
        app_name: `Test App ${i}`,
        provider: i % 2 === 0 ? 'openai' : 'anthropic',
        model: i % 2 === 0 ? 'gpt-4' : 'claude-3',
        input_tokens: Math.floor(Math.random() * 1000),
        output_tokens: Math.floor(Math.random() * 2000),
        total_tokens: Math.floor(Math.random() * 3000),
        user_id: `user-${i % 100}`,
      }))

      // 変換実行・時間計測
      const start = Date.now()
      const result = transformer.transform(records)
      const duration = Date.now() - start

      // 検証
      expect(duration).toBeLessThan(5000)
      expect(result.successCount).toBe(10000)
      expect(result.errorCount).toBe(0)
      expect(result.records).toHaveLength(10000)
      expect(result.batchIdempotencyKey).toMatch(/^[a-f0-9]{64}$/)

      console.log(`Performance: 10,000 records transformed in ${duration}ms`)
    })

    it('should handle 1,000 records efficiently', () => {
      const records: DifyUsageRecord[] = Array.from({ length: 1000 }, (_, i) => ({
        date: '2025-01-01',
        app_id: `app-${i}`,
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
      }))

      const start = Date.now()
      const result = transformer.transform(records)
      const duration = Date.now() - start

      expect(duration).toBeLessThan(500) // 1,000件は500ms以内
      expect(result.successCount).toBe(1000)

      console.log(`Performance: 1,000 records transformed in ${duration}ms`)
    })

    it('should maintain consistent performance across multiple runs', () => {
      const records: DifyUsageRecord[] = Array.from({ length: 5000 }, (_, i) => ({
        date: '2025-01-01',
        app_id: `app-${i}`,
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
      }))

      const durations: number[] = []

      for (let run = 0; run < 3; run++) {
        const start = Date.now()
        transformer.transform(records)
        durations.push(Date.now() - start)
      }

      // 各実行が2.5秒以内（半分の件数なので）
      for (const duration of durations) {
        expect(duration).toBeLessThan(2500)
      }

      // 実行間の差が大きくないことを確認（メモリリーク等の検出）
      const maxDuration = Math.max(...durations)
      const minDuration = Math.min(...durations)
      expect(maxDuration - minDuration).toBeLessThan(1000)

      console.log(`Performance consistency: ${durations.join('ms, ')}ms`)
    })
  })
})
