import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDataTransformer,
  type TokenCostInputRecord,
  type TransformerDeps,
} from '../../src/transformer/data-transformer.js'
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

  describe('AC1: トークンコスト形式から外部API形式への変換', () => {
    it('AC1-1: should transform TokenCostInputRecord[] to ExternalApiRecord[]', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          app_name: 'Test App',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
        },
      ]

      const result = transformer.transform(records)

      expect(result.records).toHaveLength(1)
      expect(result.successCount).toBe(1)
    })

    it('AC1-2: should add transformed_at in ISO 8601 format', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          app_name: 'Test App',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
        },
      ]

      const result = transformer.transform(records)

      expect(result.records[0].transformed_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('AC1-3: should preserve app_id correctly', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'my-test-app-123',
          app_name: 'Test App',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
        },
      ]

      const result = transformer.transform(records)

      expect(result.records[0].app_id).toBe('my-test-app-123')
    })

    it('AC1-4: should preserve app_name correctly', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          app_name: 'My Application Name',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
        },
      ]

      const result = transformer.transform(records)

      expect(result.records[0].app_name).toBe('My Application Name')
    })

    it('should preserve token_count and total_price', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          app_name: 'Test App',
          token_count: 12345,
          total_price: '1.23456',
          currency: 'JPY',
        },
      ]

      const result = transformer.transform(records)

      expect(result.records[0].token_count).toBe(12345)
      expect(result.records[0].total_price).toBe('1.23456')
      expect(result.records[0].currency).toBe('JPY')
    })

    it('should handle multiple records', () => {
      const records: TokenCostInputRecord[] = Array.from({ length: 5 }, (_, i) => ({
        date: '2025-01-01',
        app_id: `app-${i}`,
        app_name: `App ${i}`,
        token_count: 100 + i,
        total_price: `0.00${i}`,
        currency: 'USD',
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
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          app_name: 'Test App',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
        },
      ]

      const result = transformer.transform(records)

      const validation = externalApiRecordSchema.safeParse(result.records[0])
      expect(validation.success).toBe(true)
    })
  })

  describe('AC2: レコード単位冪等キー生成', () => {
    it('AC2-1: should generate key in {date}_{app_id} format', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          app_name: 'Test App',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
        },
      ]

      const result = transformer.transform(records)

      expect(result.records[0].idempotency_key).toBe('2025-01-01_app-123')
    })

    it('AC2-2: should generate unique keys for different dates', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          app_name: 'Test App',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
        },
        {
          date: '2025-01-02',
          app_id: 'app-123',
          app_name: 'Test App',
          token_count: 50,
          total_price: '0.0005',
          currency: 'USD',
        },
      ]

      const result = transformer.transform(records)

      expect(result.records[0].idempotency_key).not.toBe(result.records[1].idempotency_key)
    })

    it('should generate unique keys for different app_ids', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          app_name: 'App 1',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
        },
        {
          date: '2025-01-01',
          app_id: 'app-456',
          app_name: 'App 2',
          token_count: 50,
          total_price: '0.0005',
          currency: 'USD',
        },
      ]

      const result = transformer.transform(records)

      expect(result.records[0].idempotency_key).not.toBe(result.records[1].idempotency_key)
    })

    it('should generate same key for same input (idempotency)', () => {
      const record: TokenCostInputRecord = {
        date: '2025-01-01',
        app_id: 'app-123',
        app_name: 'Test App',
        token_count: 100,
        total_price: '0.001',
        currency: 'USD',
      }

      const result1 = transformer.transform([record])
      const result2 = transformer.transform([record])

      expect(result1.records[0].idempotency_key).toBe(result2.records[0].idempotency_key)
    })
  })

  describe('AC3: バッチ単位冪等キー生成', () => {
    it('AC3-1: should generate SHA256 hash of sorted record keys', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          app_name: 'Test App',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
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
      const records1: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-1',
          app_name: 'App 1',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
        },
        {
          date: '2025-01-01',
          app_id: 'app-2',
          app_name: 'App 2',
          token_count: 50,
          total_price: '0.0005',
          currency: 'USD',
        },
      ]
      const records2: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-2',
          app_name: 'App 2',
          token_count: 50,
          total_price: '0.0005',
          currency: 'USD',
        },
        {
          date: '2025-01-01',
          app_id: 'app-1',
          app_name: 'App 1',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
        },
      ]

      const result1 = transformer.transform(records1)
      const result2 = transformer.transform(records2)

      expect(result1.batchIdempotencyKey).toBe(result2.batchIdempotencyKey)
    })

    it('should generate different keys for different batches', () => {
      const records1: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-1',
          app_name: 'App 1',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
        },
      ]
      const records2: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-2',
          app_name: 'App 2',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
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
        app_name: `App ${i}`,
        token_count: 100,
        total_price: '0.001',
        currency: 'USD',
      }))

      const result = transformer.transform(records)

      expect(result.batchIdempotencyKey).toMatch(/^[a-f0-9]{64}$/)
      expect(result.successCount).toBe(100)
    })

    it('should only include successful records in batch key', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-1',
          app_name: 'App 1',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
        },
        {
          date: '2025-01-01',
          app_id: '', // エラー
          app_name: 'App 2',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
        },
      ]

      const result = transformer.transform(records)

      expect(result.successCount).toBe(1)
      expect(result.batchIdempotencyKey).toMatch(/^[a-f0-9]{64}$/)
    })
  })

  describe('AC4: zodによるバリデーション', () => {
    it('AC4-1: should validate each transformed record with zod', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          app_name: 'Test App',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
        },
      ]

      const result = transformer.transform(records)

      expect(result.records).toHaveLength(1)
      expect(result.errorCount).toBe(0)
    })

    it('AC4-2: should record validation failures in errors array', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: '', // 空文字列でバリデーションエラー
          app_name: 'Test App',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
        },
      ]

      const result = transformer.transform(records)

      expect(result.errorCount).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toContain('バリデーション')
    })

    it('should reject negative token_count', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          app_name: 'Test App',
          token_count: -1,
          total_price: '0.001',
          currency: 'USD',
        },
      ]

      const result = transformer.transform(records)

      expect(result.errorCount).toBe(1)
    })

    it('should reject empty app_id', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: '',
          app_name: 'Test App',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
        },
      ]

      const result = transformer.transform(records)

      expect(result.errorCount).toBe(1)
    })

    it('should reject empty app_name', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          app_name: '',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
        },
      ]

      const result = transformer.transform(records)

      expect(result.errorCount).toBe(1)
    })
  })

  describe('AC5: エラーハンドリング', () => {
    it('AC5-1: should record errors and continue processing', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: '', // エラー
          app_name: 'App 1',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
        },
        {
          date: '2025-01-01',
          app_id: 'app-123',
          app_name: 'App 2',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
        },
      ]

      const result = transformer.transform(records)

      expect(result.successCount).toBe(1)
      expect(result.errorCount).toBe(1)
      expect(result.records).toHaveLength(1)
    })

    it('AC5-2: should guarantee successCount + errorCount = input count', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: '', // エラー
          app_name: 'App 1',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
        },
        {
          date: '2025-01-01',
          app_id: 'app-123',
          app_name: 'App 2',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
        },
        {
          date: '2025-01-01',
          app_id: '', // エラー
          app_name: 'App 3',
          token_count: 50,
          total_price: '0.0005',
          currency: 'USD',
        },
      ]

      const result = transformer.transform(records)

      expect(result.successCount + result.errorCount).toBe(records.length)
    })

    it('AC5-3: should not throw exceptions', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: '',
          app_name: '',
          token_count: -1,
          total_price: '',
          currency: '',
        },
      ]

      expect(() => transformer.transform(records)).not.toThrow()
    })

    it('should include error details in TransformError', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: '',
          app_name: 'Test App',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
        },
      ]

      const result = transformer.transform(records)

      expect(result.errors[0].recordIdentifier).toEqual({ date: '2025-01-01', app_id: '' })
      expect(result.errors[0].details).toBeDefined()
    })

    it('should handle multiple errors in single record', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: '',
          app_name: '',
          token_count: -1,
          total_price: '0.001',
          currency: 'USD',
        },
      ]

      const result = transformer.transform(records)

      expect(result.errorCount).toBe(1)
    })

    it('should log transform completion', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          app_name: 'Test App',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
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
      const records: TokenCostInputRecord[] = Array.from({ length: 10000 }, (_, i) => ({
        date: `2025-01-${String((i % 28) + 1).padStart(2, '0')}`,
        app_id: `app-${i}`,
        app_name: `Test App ${i}`,
        token_count: Math.floor(Math.random() * 1000),
        total_price: `${(Math.random() * 0.01).toFixed(6)}`,
        currency: 'USD',
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
      const records: TokenCostInputRecord[] = Array.from({ length: 1000 }, (_, i) => ({
        date: '2025-01-01',
        app_id: `app-${i}`,
        app_name: `App ${i}`,
        token_count: 100,
        total_price: '0.001',
        currency: 'USD',
      }))

      const start = Date.now()
      const result = transformer.transform(records)
      const duration = Date.now() - start

      expect(duration).toBeLessThan(500) // 1,000件は500ms以内
      expect(result.successCount).toBe(1000)

      console.log(`Performance: 1,000 records transformed in ${duration}ms`)
    })

    it('should maintain consistent performance across multiple runs', () => {
      const records: TokenCostInputRecord[] = Array.from({ length: 5000 }, (_, i) => ({
        date: '2025-01-01',
        app_id: `app-${i}`,
        app_name: `App ${i}`,
        token_count: 100,
        total_price: '0.001',
        currency: 'USD',
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
