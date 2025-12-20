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

describe('Data Transformation Integration Tests', () => {
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

  describe('AC1: NormalizedModelRecord[] から ApiMeterRequest への変換', () => {
    it('AC1-1: should transform NormalizedModelRecord[] to ApiMeterRequest', () => {
      const records: NormalizedModelRecord[] = [createNormalizedRecord()]

      const result = transformer.transform(records)

      expect(result.recordCount).toBe(1)
      expect(result.request.records).toHaveLength(1)
      expect(result.request.tenant_id).toBe('550e8400-e29b-41d4-a716-446655440000')
    })

    it('AC1-2: should include export_metadata with timestamp', () => {
      const records: NormalizedModelRecord[] = [createNormalizedRecord()]

      const result = transformer.transform(records)

      expect(result.request.export_metadata.export_timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      )
      expect(result.request.export_metadata.exporter_version).toBe('1.1.0')
      expect(result.request.export_metadata.aggregation_period).toBe('daily')
    })

    it('AC1-3: should preserve provider and model correctly', () => {
      const records: NormalizedModelRecord[] = [
        createNormalizedRecord({ provider: 'openai', model: 'gpt-4' }),
      ]

      const result = transformer.transform(records)

      expect(result.request.records[0].provider).toBe('openai')
      expect(result.request.records[0].model).toBe('gpt-4')
    })

    it('AC1-4: should preserve source_app_id in metadata', () => {
      const records: NormalizedModelRecord[] = [
        createNormalizedRecord({ appId: 'my-test-app-123' }),
      ]

      const result = transformer.transform(records)

      expect(result.request.records[0].metadata.source_app_id).toBe('my-test-app-123')
    })

    it('should preserve token counts correctly', () => {
      const records: NormalizedModelRecord[] = [
        createNormalizedRecord({
          inputTokens: 500,
          outputTokens: 200,
          totalTokens: 700,
        }),
      ]

      const result = transformer.transform(records)

      expect(result.request.records[0].input_tokens).toBe(500)
      expect(result.request.records[0].output_tokens).toBe(200)
      expect(result.request.records[0].total_tokens).toBe(700)
    })

    it('should handle cost_actual with proper precision', () => {
      const records: NormalizedModelRecord[] = [createNormalizedRecord({ costActual: 1.2345678 })]

      const result = transformer.transform(records)

      // 7桁精度で丸められる
      expect(result.request.records[0].cost_actual).toBe(1.2345678)
    })

    it('should handle multiple records', () => {
      const records: NormalizedModelRecord[] = Array.from({ length: 5 }, (_, i) =>
        createNormalizedRecord({
          appId: `app-${i}`,
          inputTokens: 50 + i * 10,
          outputTokens: 50,
          totalTokens: 100 + i * 10,
        }),
      )

      const result = transformer.transform(records)

      expect(result.request.records).toHaveLength(5)
      expect(result.recordCount).toBe(5)
    })

    it('should throw error for empty array', () => {
      expect(() => transformer.transform([])).toThrow('No records to transform')
    })

    it('should validate output with zod schema', () => {
      const records: NormalizedModelRecord[] = [createNormalizedRecord()]

      const result = transformer.transform(records)

      const validation = apiMeterRequestSchema.safeParse(result.request)
      expect(validation.success).toBe(true)
    })

    it('should validate each record with zod schema', () => {
      const records: NormalizedModelRecord[] = [createNormalizedRecord()]

      const result = transformer.transform(records)

      const recordValidation = apiMeterUsageRecordSchema.safeParse(result.request.records[0])
      expect(recordValidation.success).toBe(true)
    })
  })

  describe('AC2: source_event_id生成（冪等キー）', () => {
    it('AC2-1: should generate source_event_id for each record', () => {
      const records: NormalizedModelRecord[] = [createNormalizedRecord()]

      const result = transformer.transform(records)

      expect(result.request.records[0].metadata.source_event_id).toBeDefined()
      expect(result.request.records[0].metadata.source_event_id.length).toBeGreaterThan(0)
    })

    it('AC2-2: should generate unique source_event_ids for different dates', () => {
      const records: NormalizedModelRecord[] = [
        createNormalizedRecord({ usageDate: '2025-01-01' }),
        createNormalizedRecord({ usageDate: '2025-01-02' }),
      ]

      const result = transformer.transform(records)

      expect(result.request.records[0].metadata.source_event_id).not.toBe(
        result.request.records[1].metadata.source_event_id,
      )
    })

    it('should generate unique source_event_ids for different providers', () => {
      const records: NormalizedModelRecord[] = [
        createNormalizedRecord({ provider: 'anthropic' }),
        createNormalizedRecord({ provider: 'openai' }),
      ]

      const result = transformer.transform(records)

      expect(result.request.records[0].metadata.source_event_id).not.toBe(
        result.request.records[1].metadata.source_event_id,
      )
    })

    it('should generate same source_event_id for same input (idempotency)', () => {
      const record = createNormalizedRecord()

      const result1 = transformer.transform([record])
      const result2 = transformer.transform([record])

      expect(result1.request.records[0].metadata.source_event_id).toBe(
        result2.request.records[0].metadata.source_event_id,
      )
    })
  })

  describe('AC3: date_range計算', () => {
    it('AC3-1: should calculate date_range from records', () => {
      const records: NormalizedModelRecord[] = [createNormalizedRecord({ usageDate: '2025-01-15' })]

      const result = transformer.transform(records)

      expect(result.request.export_metadata.date_range.start).toBeDefined()
      expect(result.request.export_metadata.date_range.end).toBeDefined()
    })

    it('AC3-2: should handle multiple dates correctly', () => {
      const records: NormalizedModelRecord[] = [
        createNormalizedRecord({ usageDate: '2025-01-01' }),
        createNormalizedRecord({ usageDate: '2025-01-15', provider: 'openai' }),
        createNormalizedRecord({ usageDate: '2025-01-10', provider: 'google' }),
      ]

      const result = transformer.transform(records)

      // 最も古い日付がstart、最も新しい日付がend
      expect(result.request.export_metadata.date_range.start).toContain('2025-01-01')
      expect(result.request.export_metadata.date_range.end).toContain('2025-01-15')
    })

    it('should handle single date correctly', () => {
      const records: NormalizedModelRecord[] = [createNormalizedRecord({ usageDate: '2025-01-10' })]

      const result = transformer.transform(records)

      expect(result.request.export_metadata.date_range.start).toContain('2025-01-10')
      expect(result.request.export_metadata.date_range.end).toContain('2025-01-10')
    })
  })

  describe('AC4: トークン計算検証', () => {
    it('AC4-1: should validate total_tokens = input_tokens + output_tokens', () => {
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

    it('AC4-2: should throw error for token mismatch', () => {
      const records: NormalizedModelRecord[] = [
        createNormalizedRecord({
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 200, // 不整合: 100 + 50 ≠ 200
        }),
      ]

      expect(() => transformer.transform(records)).toThrow(/Token mismatch/)
    })

    it('should handle zero tokens', () => {
      const records: NormalizedModelRecord[] = [
        createNormalizedRecord({
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        }),
      ]

      const result = transformer.transform(records)

      expect(result.request.records[0].total_tokens).toBe(0)
    })
  })

  describe('AC5: request_count固定値', () => {
    it('should set request_count to 1 for all records', () => {
      const records: NormalizedModelRecord[] = [
        createNormalizedRecord(),
        createNormalizedRecord({ provider: 'openai' }),
        createNormalizedRecord({ provider: 'google' }),
      ]

      const result = transformer.transform(records)

      for (const record of result.request.records) {
        expect(record.request_count).toBe(1)
      }
    })
  })

  describe('AC6: metadata構造', () => {
    it('should include source_system as "dify"', () => {
      const records: NormalizedModelRecord[] = [createNormalizedRecord()]

      const result = transformer.transform(records)

      expect(result.request.records[0].metadata.source_system).toBe('dify')
    })

    it('should include aggregation_method', () => {
      const records: NormalizedModelRecord[] = [createNormalizedRecord()]

      const result = transformer.transform(records)

      expect(result.request.records[0].metadata.aggregation_method).toBe('daily_sum')
    })

    it('should include source_app_id when provided', () => {
      const records: NormalizedModelRecord[] = [createNormalizedRecord({ appId: 'my-app-123' })]

      const result = transformer.transform(records)

      expect(result.request.records[0].metadata.source_app_id).toBe('my-app-123')
    })
  })

  describe('AC7: ログ出力', () => {
    it('should log transform completion', () => {
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

    it('should include date_range in log', () => {
      const records: NormalizedModelRecord[] = [createNormalizedRecord({ usageDate: '2025-01-15' })]

      transformer.transform(records)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Transform completed',
        expect.objectContaining({
          date_range: expect.objectContaining({
            start: expect.any(String),
            end: expect.any(String),
          }),
        }),
      )
    })
  })

  describe('AC8: パフォーマンス', () => {
    it('AC8-1: should transform 10,000 records within 5 seconds', () => {
      // テストデータ生成
      const records: NormalizedModelRecord[] = Array.from({ length: 10000 }, (_, i) =>
        createNormalizedRecord({
          usageDate: `2025-01-${String((i % 28) + 1).padStart(2, '0')}`,
          provider: ['anthropic', 'openai', 'google'][i % 3],
          model: `model-${i % 10}`,
          appId: `app-${i}`,
          inputTokens: Math.floor(Math.random() * 500),
          outputTokens: Math.floor(Math.random() * 500),
          totalTokens: 0, // 後で計算
          costActual: Math.random() * 0.01,
        }),
      )
      // totalTokensを正しく設定
      for (const record of records) {
        record.totalTokens = record.inputTokens + record.outputTokens
      }

      // 変換実行・時間計測
      const start = Date.now()
      const result = transformer.transform(records)
      const duration = Date.now() - start

      // 検証
      expect(duration).toBeLessThan(5000)
      expect(result.recordCount).toBe(10000)
      expect(result.request.records).toHaveLength(10000)

      console.log(`Performance: 10,000 records transformed in ${duration}ms`)
    })

    it('should handle 1,000 records efficiently', () => {
      const records: NormalizedModelRecord[] = Array.from({ length: 1000 }, (_, i) =>
        createNormalizedRecord({
          appId: `app-${i}`,
          inputTokens: 50,
          outputTokens: 50,
          totalTokens: 100,
        }),
      )

      const start = Date.now()
      const result = transformer.transform(records)
      const duration = Date.now() - start

      expect(duration).toBeLessThan(500) // 1,000件は500ms以内
      expect(result.recordCount).toBe(1000)

      console.log(`Performance: 1,000 records transformed in ${duration}ms`)
    })

    it('should maintain consistent performance across multiple runs', () => {
      const records: NormalizedModelRecord[] = Array.from({ length: 5000 }, (_, i) =>
        createNormalizedRecord({
          appId: `app-${i}`,
          inputTokens: 50,
          outputTokens: 50,
          totalTokens: 100,
        }),
      )

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
