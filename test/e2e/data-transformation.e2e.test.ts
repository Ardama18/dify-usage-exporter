import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDataTransformer,
  type TokenCostInputRecord,
  type TransformerDeps,
} from '../../src/transformer/data-transformer.js'
import { externalApiRecordSchema } from '../../src/types/external-api.js'

describe('Data Transformation E2E Tests', () => {
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

  describe('E2E-1: 全体疎通', () => {
    it('should complete full transformation flow', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          app_name: 'Test App',
          token_count: 300,
          total_price: '0.003',
          currency: 'USD',
        },
      ]

      const result = transformer.transform(records)

      expect(result.records).toHaveLength(1)
      expect(result.records[0].date).toBe('2025-01-01')
      expect(result.records[0].app_id).toBe('app-123')
      expect(result.records[0].app_name).toBe('Test App')
      expect(result.records[0].token_count).toBe(300)
      expect(result.records[0].total_price).toBe('0.003')
      expect(result.records[0].currency).toBe('USD')
      expect(result.records[0].idempotency_key).toBeDefined()
      expect(result.records[0].transformed_at).toBeDefined()
      expect(result.batchIdempotencyKey).toBeDefined()
    })

    it('should handle empty input gracefully', () => {
      const result = transformer.transform([])

      expect(result.records).toHaveLength(0)
      expect(result.successCount).toBe(0)
      expect(result.errorCount).toBe(0)
      expect(result.batchIdempotencyKey).toBe('')
      expect(result.errors).toHaveLength(0)
    })

    it('should process mixed valid and invalid records', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-1',
          app_name: 'App 1',
          token_count: 300,
          total_price: '0.003',
          currency: 'USD',
        },
        {
          date: '2025-01-01',
          app_id: '', // invalid
          app_name: 'App 2',
          token_count: 300,
          total_price: '0.003',
          currency: 'USD',
        },
        {
          date: '2025-01-01',
          app_id: 'app-2',
          app_name: 'App 3',
          token_count: 150,
          total_price: '0.0015',
          currency: 'USD',
        },
      ]

      const result = transformer.transform(records)

      expect(result.successCount).toBe(2)
      expect(result.errorCount).toBe(1)
      expect(result.records).toHaveLength(2)
    })
  })

  describe('E2E-2: 冪等キー整合性', () => {
    it('should generate consistent record keys', () => {
      const record: TokenCostInputRecord = {
        date: '2025-01-01',
        app_id: 'app-123',
        app_name: 'Test App',
        token_count: 300,
        total_price: '0.003',
        currency: 'USD',
      }

      const result1 = transformer.transform([record])
      const result2 = transformer.transform([record])

      expect(result1.records[0].idempotency_key).toBe(result2.records[0].idempotency_key)
    })

    it('should generate consistent batch keys for same records', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-1',
          app_name: 'App 1',
          token_count: 300,
          total_price: '0.003',
          currency: 'USD',
        },
        {
          date: '2025-01-01',
          app_id: 'app-2',
          app_name: 'App 2',
          token_count: 150,
          total_price: '0.0015',
          currency: 'USD',
        },
      ]

      const result1 = transformer.transform(records)
      const result2 = transformer.transform(records)

      expect(result1.batchIdempotencyKey).toBe(result2.batchIdempotencyKey)
    })

    it('should generate order-independent batch keys', () => {
      const records1: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-1',
          app_name: 'App 1',
          token_count: 300,
          total_price: '0.003',
          currency: 'USD',
        },
        {
          date: '2025-01-01',
          app_id: 'app-2',
          app_name: 'App 2',
          token_count: 150,
          total_price: '0.0015',
          currency: 'USD',
        },
      ]
      const records2: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-2',
          app_name: 'App 2',
          token_count: 150,
          total_price: '0.0015',
          currency: 'USD',
        },
        {
          date: '2025-01-01',
          app_id: 'app-1',
          app_name: 'App 1',
          token_count: 300,
          total_price: '0.003',
          currency: 'USD',
        },
      ]

      const result1 = transformer.transform(records1)
      const result2 = transformer.transform(records2)

      expect(result1.batchIdempotencyKey).toBe(result2.batchIdempotencyKey)
    })
  })

  describe('E2E-3: エラーリカバリ', () => {
    it('should recover from validation errors', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: '',
          app_name: 'App 1',
          token_count: 300,
          total_price: '0.003',
          currency: 'USD',
        },
        {
          date: '2025-01-01',
          app_id: 'app-valid',
          app_name: 'App 2',
          token_count: 300,
          total_price: '0.003',
          currency: 'USD',
        },
      ]

      const result = transformer.transform(records)

      expect(result.successCount).toBe(1)
      expect(result.records[0].app_id).toBe('app-valid')
    })

    it('should provide detailed error information', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: '',
          app_name: 'Test App',
          token_count: 300,
          total_price: '0.003',
          currency: 'USD',
        },
      ]

      const result = transformer.transform(records)

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].recordIdentifier).toEqual({ date: '2025-01-01', app_id: '' })
      expect(result.errors[0].message).toBeDefined()
      expect(result.errors[0].details).toBeDefined()
    })

    it('should continue processing after errors', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: '',
          app_name: 'App 1',
          token_count: 300,
          total_price: '0.003',
          currency: 'USD',
        },
        {
          date: '2025-01-01',
          app_id: '',
          app_name: 'App 2',
          token_count: 300,
          total_price: '0.003',
          currency: 'USD',
        },
        {
          date: '2025-01-01',
          app_id: 'app-valid',
          app_name: 'App 3',
          token_count: 300,
          total_price: '0.003',
          currency: 'USD',
        },
      ]

      const result = transformer.transform(records)

      expect(result.errorCount).toBe(2)
      expect(result.successCount).toBe(1)
      expect(result.successCount + result.errorCount).toBe(3)
    })
  })

  describe('E2E-4: データ整合性', () => {
    it('should preserve all original data', () => {
      const record: TokenCostInputRecord = {
        date: '2025-12-31',
        app_id: 'app-xyz-789',
        app_name: 'Production App',
        token_count: 80235,
        total_price: '8.0235',
        currency: 'JPY',
      }

      const result = transformer.transform([record])

      expect(result.records[0].date).toBe('2025-12-31')
      expect(result.records[0].app_id).toBe('app-xyz-789')
      expect(result.records[0].app_name).toBe('Production App')
      expect(result.records[0].token_count).toBe(80235)
      expect(result.records[0].total_price).toBe('8.0235')
      expect(result.records[0].currency).toBe('JPY')
    })

    it('should correctly preserve currency', () => {
      const record: TokenCostInputRecord = {
        date: '2025-01-01',
        app_id: 'app-123',
        app_name: 'Test App',
        token_count: 300,
        total_price: '0.003',
        currency: 'EUR',
      }

      const result = transformer.transform([record])

      expect(result.records[0].currency).toBe('EUR')
    })

    it('should generate valid output records', () => {
      const records: TokenCostInputRecord[] = Array.from({ length: 10 }, (_, i) => ({
        date: '2025-01-01',
        app_id: `app-${i}`,
        app_name: `App ${i}`,
        token_count: 300,
        total_price: '0.003',
        currency: 'USD',
      }))

      const result = transformer.transform(records)

      for (const record of result.records) {
        const validation = externalApiRecordSchema.safeParse(record)
        expect(validation.success).toBe(true)
      }
    })
  })

  describe('E2E-5: 実運用シナリオ', () => {
    it('should handle typical daily batch', () => {
      const records: TokenCostInputRecord[] = Array.from({ length: 100 }, (_, i) => ({
        date: '2025-01-15',
        app_id: `app-${i % 10}`,
        app_name: `App ${i % 10}`,
        token_count: Math.floor(Math.random() * 3000),
        total_price: `${(Math.random() * 0.1).toFixed(6)}`,
        currency: 'USD',
      }))

      const result = transformer.transform(records)

      expect(result.successCount).toBe(100)
      expect(result.errorCount).toBe(0)
      expect(result.batchIdempotencyKey).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should handle multi-currency scenario', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-1',
          app_name: 'App 1',
          token_count: 300,
          total_price: '0.003',
          currency: 'USD',
        },
        {
          date: '2025-01-01',
          app_id: 'app-2',
          app_name: 'App 2',
          token_count: 400,
          total_price: '0.5',
          currency: 'JPY',
        },
        {
          date: '2025-01-01',
          app_id: 'app-3',
          app_name: 'App 3',
          token_count: 500,
          total_price: '0.004',
          currency: 'EUR',
        },
      ]

      const result = transformer.transform(records)

      expect(result.successCount).toBe(3)
      const currencies = result.records.map((r) => r.currency)
      expect(currencies).toContain('USD')
      expect(currencies).toContain('JPY')
      expect(currencies).toContain('EUR')
    })

    it('should handle records with various token counts', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-1',
          app_name: 'App 1',
          token_count: 0,
          total_price: '0',
          currency: 'USD',
        },
        {
          date: '2025-01-01',
          app_id: 'app-2',
          app_name: 'App 2',
          token_count: 1000000,
          total_price: '100.00',
          currency: 'USD',
        },
      ]

      const result = transformer.transform(records)

      expect(result.successCount).toBe(2)
      expect(result.records[0].token_count).toBe(0)
      expect(result.records[1].token_count).toBe(1000000)
    })
  })

  describe('E2E-6: ログ・モニタリング', () => {
    it('should log transformation completion', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-1',
          app_name: 'App 1',
          token_count: 300,
          total_price: '0.003',
          currency: 'USD',
        },
        {
          date: '2025-01-01',
          app_id: '',
          app_name: 'App 2',
          token_count: 300,
          total_price: '0.003',
          currency: 'USD',
        },
      ]

      transformer.transform(records)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Transform completed',
        expect.objectContaining({
          successCount: 1,
          errorCount: 1,
          batchIdempotencyKey: expect.any(String),
        }),
      )
    })

    it('should provide metrics for monitoring', () => {
      const records: TokenCostInputRecord[] = Array.from({ length: 50 }, (_, i) => ({
        date: '2025-01-01',
        app_id: i % 5 === 0 ? '' : `app-${i}`,
        app_name: `App ${i}`,
        token_count: 300,
        total_price: '0.003',
        currency: 'USD',
      }))

      const result = transformer.transform(records)

      expect(result.successCount).toBe(40)
      expect(result.errorCount).toBe(10)
      expect(result.successCount + result.errorCount).toBe(50)
      expect(result.errors).toHaveLength(10)
    })
  })
})
