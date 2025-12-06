import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDataTransformer,
  type TokenCostInputRecord,
  type TransformerDeps,
} from '../../../src/transformer/data-transformer.js'

describe('createDataTransformer', () => {
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

  describe('正常系', () => {
    it('should transform a single record correctly', () => {
      const record: TokenCostInputRecord = {
        date: '2025-01-01',
        app_id: 'app-123',
        app_name: 'Test App',
        token_count: 100,
        total_price: '0.001',
        currency: 'USD',
      }

      const result = transformer.transform([record])

      expect(result.successCount).toBe(1)
      expect(result.errorCount).toBe(0)
      expect(result.records).toHaveLength(1)
      expect(result.records[0].app_id).toBe('app-123')
      expect(result.records[0].app_name).toBe('Test App')
      expect(result.records[0].token_count).toBe(100)
      expect(result.records[0].total_price).toBe('0.001')
      expect(result.records[0].currency).toBe('USD')
    })

    it('should add transformed_at to each record', () => {
      const record: TokenCostInputRecord = {
        date: '2025-01-01',
        app_id: 'app-123',
        app_name: 'Test App',
        token_count: 100,
        total_price: '0.001',
        currency: 'USD',
      }

      const result = transformer.transform([record])

      expect(result.records[0].transformed_at).toBeDefined()
      expect(result.records[0].transformed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('should generate idempotency_key for each record', () => {
      const record: TokenCostInputRecord = {
        date: '2025-01-01',
        app_id: 'app-123',
        app_name: 'Test App',
        token_count: 100,
        total_price: '0.001',
        currency: 'USD',
      }

      const result = transformer.transform([record])

      expect(result.records[0].idempotency_key).toBe('2025-01-01_app-123')
    })

    it('should generate batchIdempotencyKey', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          app_name: 'Test App 1',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
        },
        {
          date: '2025-01-01',
          app_id: 'app-456',
          app_name: 'Test App 2',
          token_count: 50,
          total_price: '0.0005',
          currency: 'USD',
        },
      ]

      const result = transformer.transform(records)

      expect(result.batchIdempotencyKey).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should return empty string for batchIdempotencyKey when no records', () => {
      const result = transformer.transform([])

      expect(result.batchIdempotencyKey).toBe('')
      expect(result.successCount).toBe(0)
      expect(result.errorCount).toBe(0)
    })
  })

  describe('エラーハンドリング', () => {
    it('should record validation errors in errors array', () => {
      const record: TokenCostInputRecord = {
        date: '2025-01-01',
        app_id: '', // 空文字列でバリデーションエラー
        app_name: 'Test App',
        token_count: 100,
        total_price: '0.001',
        currency: 'USD',
      }

      const result = transformer.transform([record])

      expect(result.errorCount).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toBe('出力バリデーションエラー')
    })

    it('should guarantee successCount + errorCount = input count', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          app_name: 'Test App 1',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
        },
        {
          date: '2025-01-01',
          app_id: '', // エラー
          app_name: 'Test App 2',
          token_count: 50,
          total_price: '0.0005',
          currency: 'USD',
        },
      ]

      const result = transformer.transform(records)

      expect(result.successCount + result.errorCount).toBe(records.length)
    })

    it('should not throw exceptions', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: '',
          app_name: 'Test App',
          token_count: -1, // 複数エラー
          total_price: '0.001',
          currency: 'USD',
        },
      ]

      expect(() => transformer.transform(records)).not.toThrow()
    })

    it('should only return successful records', () => {
      const records: TokenCostInputRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          app_name: 'Test App 1',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
        },
        {
          date: '2025-01-01',
          app_id: '', // エラー
          app_name: 'Test App 2',
          token_count: 50,
          total_price: '0.0005',
          currency: 'USD',
        },
      ]

      const result = transformer.transform(records)

      expect(result.records).toHaveLength(1)
      expect(result.records[0].app_id).toBe('app-123')
    })
  })
})
