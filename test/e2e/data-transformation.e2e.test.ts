import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDataTransformer,
  type TransformerDeps,
} from '../../src/transformer/data-transformer.js'
import type { DifyUsageRecord } from '../../src/types/dify-usage.js'
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
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          app_name: 'Test App',
          provider: 'OpenAI',
          model: 'GPT-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
          user_id: 'user-456',
        },
      ]

      const result = transformer.transform(records)

      expect(result.records).toHaveLength(1)
      expect(result.records[0].date).toBe('2025-01-01')
      expect(result.records[0].app_id).toBe('app-123')
      expect(result.records[0].app_name).toBe('Test App')
      expect(result.records[0].provider).toBe('openai')
      expect(result.records[0].model).toBe('gpt-4')
      expect(result.records[0].input_tokens).toBe(100)
      expect(result.records[0].output_tokens).toBe(200)
      expect(result.records[0].total_tokens).toBe(300)
      expect(result.records[0].user_id).toBe('user-456')
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
        },
        {
          date: '2025-01-01',
          app_id: 'app-2',
          provider: 'anthropic',
          model: 'claude-3',
          input_tokens: 50,
          output_tokens: 100,
          total_tokens: 150,
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

    it('should generate consistent batch keys for same records', () => {
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
          app_id: 'app-2',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 50,
          output_tokens: 100,
          total_tokens: 150,
        },
      ]

      const result1 = transformer.transform(records)
      const result2 = transformer.transform(records)

      expect(result1.batchIdempotencyKey).toBe(result2.batchIdempotencyKey)
    })

    it('should generate order-independent batch keys', () => {
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
          provider: 'anthropic',
          model: 'claude-3',
          input_tokens: 50,
          output_tokens: 100,
          total_tokens: 150,
        },
      ]
      const records2: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-2',
          provider: 'anthropic',
          model: 'claude-3',
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
  })

  describe('E2E-3: エラーリカバリ', () => {
    it('should recover from validation errors', () => {
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
          app_id: 'app-valid',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
      ]

      const result = transformer.transform(records)

      expect(result.successCount).toBe(1)
      expect(result.records[0].app_id).toBe('app-valid')
    })

    it('should provide detailed error information', () => {
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

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].recordIdentifier).toEqual({ date: '2025-01-01', app_id: '' })
      expect(result.errors[0].message).toBeDefined()
      expect(result.errors[0].details).toBeDefined()
    })

    it('should continue processing after errors', () => {
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
          app_id: '',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
        {
          date: '2025-01-01',
          app_id: 'app-valid',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
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
      const record: DifyUsageRecord = {
        date: '2025-12-31',
        app_id: 'app-xyz-789',
        app_name: 'Production App',
        provider: 'ANTHROPIC',
        model: 'CLAUDE-3-OPUS',
        input_tokens: 12345,
        output_tokens: 67890,
        total_tokens: 80235,
        user_id: 'user-abc-123',
      }

      const result = transformer.transform([record])

      expect(result.records[0].date).toBe('2025-12-31')
      expect(result.records[0].app_id).toBe('app-xyz-789')
      expect(result.records[0].app_name).toBe('Production App')
      expect(result.records[0].input_tokens).toBe(12345)
      expect(result.records[0].output_tokens).toBe(67890)
      expect(result.records[0].total_tokens).toBe(80235)
      expect(result.records[0].user_id).toBe('user-abc-123')
    })

    it('should correctly normalize provider and model', () => {
      const record: DifyUsageRecord = {
        date: '2025-01-01',
        app_id: 'app-123',
        provider: '  OpenAI  ',
        model: '  GPT-4-Turbo  ',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
      }

      const result = transformer.transform([record])

      expect(result.records[0].provider).toBe('openai')
      expect(result.records[0].model).toBe('gpt-4-turbo')
    })

    it('should generate valid output records', () => {
      const records: DifyUsageRecord[] = Array.from({ length: 10 }, (_, i) => ({
        date: '2025-01-01',
        app_id: `app-${i}`,
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
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
      const records: DifyUsageRecord[] = Array.from({ length: 100 }, (_, i) => ({
        date: '2025-01-15',
        app_id: `app-${i % 10}`,
        app_name: `App ${i % 10}`,
        provider: i % 3 === 0 ? 'openai' : i % 3 === 1 ? 'anthropic' : 'google',
        model: i % 3 === 0 ? 'gpt-4' : i % 3 === 1 ? 'claude-3' : 'gemini-pro',
        input_tokens: Math.floor(Math.random() * 1000),
        output_tokens: Math.floor(Math.random() * 2000),
        total_tokens: Math.floor(Math.random() * 3000),
        user_id: `user-${i % 20}`,
      }))

      const result = transformer.transform(records)

      expect(result.successCount).toBe(100)
      expect(result.errorCount).toBe(0)
      expect(result.batchIdempotencyKey).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should handle multi-provider scenario', () => {
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
          app_id: 'app-1',
          provider: 'anthropic',
          model: 'claude-3',
          input_tokens: 150,
          output_tokens: 250,
          total_tokens: 400,
        },
        {
          date: '2025-01-01',
          app_id: 'app-1',
          provider: 'google',
          model: 'gemini-pro',
          input_tokens: 200,
          output_tokens: 300,
          total_tokens: 500,
        },
      ]

      const result = transformer.transform(records)

      expect(result.successCount).toBe(3)
      const providers = result.records.map((r) => r.provider)
      expect(providers).toContain('openai')
      expect(providers).toContain('anthropic')
      expect(providers).toContain('google')
    })

    it('should handle records with missing optional fields', () => {
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
      ]

      const result = transformer.transform(records)

      expect(result.successCount).toBe(1)
      expect(result.records[0].app_name).toBeUndefined()
      expect(result.records[0].user_id).toBeUndefined()
    })
  })

  describe('E2E-6: ログ・モニタリング', () => {
    it('should log transformation completion', () => {
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
      const records: DifyUsageRecord[] = Array.from({ length: 50 }, (_, i) => ({
        date: '2025-01-01',
        app_id: i % 5 === 0 ? '' : `app-${i}`,
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
      }))

      const result = transformer.transform(records)

      expect(result.successCount).toBe(40)
      expect(result.errorCount).toBe(10)
      expect(result.successCount + result.errorCount).toBe(50)
      expect(result.errors).toHaveLength(10)
    })
  })
})
