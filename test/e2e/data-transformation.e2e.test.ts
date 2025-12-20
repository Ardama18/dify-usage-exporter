import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NormalizedModelRecord } from '../../src/normalizer/normalizer.js'
import {
  apiMeterRequestSchema,
  apiMeterUsageRecordSchema,
} from '../../src/types/api-meter-schema.js'

type TransformerDeps = {
  logger: {
    info: ReturnType<typeof vi.fn>
    error: ReturnType<typeof vi.fn>
    warn: ReturnType<typeof vi.fn>
    debug: ReturnType<typeof vi.fn>
  }
}

/**
 * NormalizedModelRecordテストデータ作成ヘルパー
 */
function createNormalizedRecord(
  overrides: Partial<NormalizedModelRecord> = {},
): NormalizedModelRecord {
  return {
    usageDate: '2025-01-01',
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
    inputTokens: 70,
    outputTokens: 30,
    totalTokens: 100,
    costActual: 0.001,
    appId: 'app-123',
    appName: 'Test App',
    ...overrides,
  }
}

describe('Data Transformation E2E Tests', () => {
  let mockLogger: TransformerDeps['logger']
  let transformer: ReturnType<
    Awaited<typeof import('../../src/transformer/data-transformer.js')>['createDataTransformer']
  >

  beforeEach(async () => {
    // モジュールキャッシュをリセット
    vi.resetModules()

    // API_Meter新仕様対応（SPEC-CHANGE-001）- 環境変数設定
    process.env.DIFY_API_BASE_URL = 'https://api.dify.ai'
    process.env.DIFY_EMAIL = 'test@example.com'
    process.env.DIFY_PASSWORD = 'test-password'
    process.env.EXTERNAL_API_URL = 'https://external-api.example.com'
    process.env.EXTERNAL_API_TOKEN = 'test-external-token'
    process.env.API_METER_TENANT_ID = '550e8400-e29b-41d4-a716-446655440000'
    process.env.API_METER_TOKEN = 'test-api-meter-token'
    process.env.API_METER_URL = 'https://api-meter.example.com'

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    } as unknown as TransformerDeps['logger']

    // 動的インポートで環境変数設定後にモジュールを読み込む
    const { createDataTransformer } = await import('../../src/transformer/data-transformer.js')
    transformer = createDataTransformer({ logger: mockLogger })
  })

  describe('E2E-1: 全体疎通', () => {
    it('should complete full transformation flow', () => {
      const records: NormalizedModelRecord[] = [
        createNormalizedRecord({
          usageDate: '2025-01-01',
          provider: 'anthropic',
          model: 'claude-3-5-sonnet',
          inputTokens: 200,
          outputTokens: 100,
          totalTokens: 300,
          costActual: 0.003,
          appId: 'app-123',
          appName: 'Test App',
        }),
      ]

      const result = transformer.transform(records)

      expect(result.recordCount).toBe(1)
      expect(result.request.records).toHaveLength(1)
      expect(result.request.records[0].usage_date).toBe('2025-01-01')
      expect(result.request.records[0].provider).toBe('anthropic')
      expect(result.request.records[0].model).toBe('claude-3-5-sonnet')
      expect(result.request.records[0].input_tokens).toBe(200)
      expect(result.request.records[0].output_tokens).toBe(100)
      expect(result.request.records[0].total_tokens).toBe(300)
      expect(result.request.records[0].cost_actual).toBe(0.003)
      expect(result.request.records[0].metadata.source_event_id).toBeDefined()
      expect(result.request.export_metadata.export_timestamp).toBeDefined()
    })

    it('should throw error for empty input', () => {
      expect(() => transformer.transform([])).toThrow('No records to transform')
    })

    it('should process multiple records correctly', () => {
      const records: NormalizedModelRecord[] = [
        createNormalizedRecord({ appId: 'app-1', provider: 'anthropic' }),
        createNormalizedRecord({ appId: 'app-2', provider: 'openai', model: 'gpt-4' }),
        createNormalizedRecord({ appId: 'app-3', provider: 'google', model: 'gemini-pro' }),
      ]

      const result = transformer.transform(records)

      expect(result.recordCount).toBe(3)
      expect(result.request.records).toHaveLength(3)
    })
  })

  describe('E2E-2: 冪等キー整合性', () => {
    it('should generate consistent source_event_ids', () => {
      const record = createNormalizedRecord()

      const result1 = transformer.transform([record])
      const result2 = transformer.transform([record])

      expect(result1.request.records[0].metadata.source_event_id).toBe(
        result2.request.records[0].metadata.source_event_id,
      )
    })

    it('should generate unique source_event_ids for different records', () => {
      const records: NormalizedModelRecord[] = [
        createNormalizedRecord({ usageDate: '2025-01-01', provider: 'anthropic' }),
        createNormalizedRecord({ usageDate: '2025-01-01', provider: 'openai' }),
      ]

      const result = transformer.transform(records)

      expect(result.request.records[0].metadata.source_event_id).not.toBe(
        result.request.records[1].metadata.source_event_id,
      )
    })

    it('should generate unique source_event_ids for different dates', () => {
      const records: NormalizedModelRecord[] = [
        createNormalizedRecord({ usageDate: '2025-01-01' }),
        createNormalizedRecord({ usageDate: '2025-01-02' }),
      ]

      const result = transformer.transform(records)

      expect(result.request.records[0].metadata.source_event_id).not.toBe(
        result.request.records[1].metadata.source_event_id,
      )
    })
  })

  describe('E2E-3: トークン検証', () => {
    it('should validate token consistency', () => {
      const records: NormalizedModelRecord[] = [
        createNormalizedRecord({
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
        }),
      ]

      const result = transformer.transform(records)

      expect(result.request.records[0].total_tokens).toBe(150)
    })

    it('should throw error for invalid token totals', () => {
      const records: NormalizedModelRecord[] = [
        createNormalizedRecord({
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 200, // Invalid: 100 + 50 ≠ 200
        }),
      ]

      expect(() => transformer.transform(records)).toThrow(/Token mismatch/)
    })

    it('should continue processing after token validation succeeds', () => {
      const records: NormalizedModelRecord[] = [
        createNormalizedRecord({
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        }),
        createNormalizedRecord({
          inputTokens: 500,
          outputTokens: 500,
          totalTokens: 1000,
        }),
      ]

      const result = transformer.transform(records)

      expect(result.recordCount).toBe(2)
    })
  })

  describe('E2E-4: データ整合性', () => {
    it('should preserve all original data', () => {
      const record = createNormalizedRecord({
        usageDate: '2025-12-31',
        provider: 'openai',
        model: 'gpt-4-turbo',
        inputTokens: 50000,
        outputTokens: 30235,
        totalTokens: 80235,
        costActual: 8.0235,
        appId: 'app-xyz-789',
        appName: 'Production App',
      })

      const result = transformer.transform([record])

      expect(result.request.records[0].usage_date).toBe('2025-12-31')
      expect(result.request.records[0].provider).toBe('openai')
      expect(result.request.records[0].model).toBe('gpt-4-turbo')
      expect(result.request.records[0].input_tokens).toBe(50000)
      expect(result.request.records[0].output_tokens).toBe(30235)
      expect(result.request.records[0].total_tokens).toBe(80235)
      expect(result.request.records[0].cost_actual).toBe(8.0235)
      expect(result.request.records[0].metadata.source_app_id).toBe('app-xyz-789')
    })

    it('should correctly set currency to USD', () => {
      const record = createNormalizedRecord()

      const result = transformer.transform([record])

      expect(result.request.records[0].currency).toBe('USD')
    })

    it('should generate valid output records', () => {
      const records: NormalizedModelRecord[] = Array.from({ length: 10 }, (_, i) =>
        createNormalizedRecord({
          appId: `app-${i}`,
          inputTokens: 50 + i * 10,
          outputTokens: 50,
          totalTokens: 100 + i * 10,
        }),
      )

      const result = transformer.transform(records)

      for (const record of result.request.records) {
        const validation = apiMeterUsageRecordSchema.safeParse(record)
        expect(validation.success).toBe(true)
      }
    })
  })

  describe('E2E-5: 実運用シナリオ', () => {
    it('should handle typical daily batch', () => {
      const records: NormalizedModelRecord[] = Array.from({ length: 100 }, (_, i) => {
        const inputTokens = Math.floor(Math.random() * 1500)
        const outputTokens = Math.floor(Math.random() * 1500)
        return createNormalizedRecord({
          usageDate: '2025-01-15',
          provider: ['anthropic', 'openai', 'google'][i % 3],
          model: `model-${i % 10}`,
          appId: `app-${i % 10}`,
          appName: `App ${i % 10}`,
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          costActual: Number.parseFloat((Math.random() * 0.1).toFixed(6)),
        })
      })

      const result = transformer.transform(records)

      expect(result.recordCount).toBe(100)
      expect(result.request.records).toHaveLength(100)
      // Validate entire request
      const validation = apiMeterRequestSchema.safeParse(result.request)
      expect(validation.success).toBe(true)
    })

    it('should handle multi-provider scenario', () => {
      const records: NormalizedModelRecord[] = [
        createNormalizedRecord({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet',
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
        }),
        createNormalizedRecord({
          provider: 'openai',
          model: 'gpt-4',
          inputTokens: 200,
          outputTokens: 100,
          totalTokens: 300,
        }),
        createNormalizedRecord({
          provider: 'google',
          model: 'gemini-pro',
          inputTokens: 300,
          outputTokens: 150,
          totalTokens: 450,
        }),
      ]

      const result = transformer.transform(records)

      expect(result.recordCount).toBe(3)
      const providers = result.request.records.map((r) => r.provider)
      expect(providers).toContain('anthropic')
      expect(providers).toContain('openai')
      expect(providers).toContain('google')
    })

    it('should handle records with various token counts', () => {
      const records: NormalizedModelRecord[] = [
        createNormalizedRecord({
          appId: 'app-zero',
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          costActual: 0,
        }),
        createNormalizedRecord({
          appId: 'app-million',
          inputTokens: 500000,
          outputTokens: 500000,
          totalTokens: 1000000,
          costActual: 100.0,
        }),
      ]

      const result = transformer.transform(records)

      expect(result.recordCount).toBe(2)
      expect(result.request.records[0].total_tokens).toBe(0)
      expect(result.request.records[1].total_tokens).toBe(1000000)
    })
  })

  describe('E2E-6: ログ・モニタリング', () => {
    it('should log transformation completion', () => {
      const records: NormalizedModelRecord[] = [createNormalizedRecord()]

      transformer.transform(records)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Transform completed',
        expect.objectContaining({
          recordCount: 1,
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      )
    })

    it('should provide metrics for monitoring', () => {
      const records: NormalizedModelRecord[] = Array.from({ length: 50 }, (_, i) =>
        createNormalizedRecord({
          appId: `app-${i}`,
          inputTokens: 50,
          outputTokens: 50,
          totalTokens: 100,
        }),
      )

      const result = transformer.transform(records)

      expect(result.recordCount).toBe(50)
      expect(result.request.records).toHaveLength(50)
    })
  })

  describe('E2E-7: export_metadata検証', () => {
    it('should include correct exporter_version', () => {
      const records: NormalizedModelRecord[] = [createNormalizedRecord()]

      const result = transformer.transform(records)

      expect(result.request.export_metadata.exporter_version).toBe('1.1.0')
    })

    it('should include aggregation_period as daily', () => {
      const records: NormalizedModelRecord[] = [createNormalizedRecord()]

      const result = transformer.transform(records)

      expect(result.request.export_metadata.aggregation_period).toBe('daily')
    })

    it('should calculate date_range correctly', () => {
      const records: NormalizedModelRecord[] = [
        createNormalizedRecord({ usageDate: '2025-01-05' }),
        createNormalizedRecord({ usageDate: '2025-01-01', provider: 'openai' }),
        createNormalizedRecord({ usageDate: '2025-01-15', provider: 'google' }),
      ]

      const result = transformer.transform(records)

      expect(result.request.export_metadata.date_range.start).toContain('2025-01-01')
      expect(result.request.export_metadata.date_range.end).toContain('2025-01-15')
    })
  })
})
