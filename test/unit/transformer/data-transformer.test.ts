import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NormalizedModelRecord } from '../../../src/normalizer/normalizer.js'
import {
  createDataTransformer,
  type TransformerDeps,
} from '../../../src/transformer/data-transformer.js'

// loadConfigをモック
vi.mock('../../../src/config/env-config.js', () => ({
  loadConfig: vi.fn(() => ({
    DIFY_API_BASE_URL: 'https://api.dify.ai',
    DIFY_EMAIL: 'test@example.com',
    DIFY_PASSWORD: 'test-password',
    EXTERNAL_API_URL: 'https://external-api.example.com',
    EXTERNAL_API_TOKEN: 'external-token',
    API_METER_TENANT_ID: '550e8400-e29b-41d4-a716-446655440000',
    API_METER_TOKEN: 'test-api-meter-token',
    API_METER_URL: 'https://api-meter.example.com',
  })),
}))

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

  afterEach(() => {
    vi.clearAllMocks()
  })

  // 有効なNormalizedModelRecordを作成するヘルパー関数
  const createValidRecord = (
    overrides?: Partial<NormalizedModelRecord>,
  ): NormalizedModelRecord => ({
    usageDate: '2025-01-01',
    provider: 'openai',
    model: 'gpt-4',
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    costActual: 0.001,
    appId: 'app-123',
    ...overrides,
  })

  describe('正常系', () => {
    it('should transform a single record correctly', () => {
      const record = createValidRecord()
      const result = transformer.transform([record])

      expect(result.recordCount).toBe(1)
      expect(result.request.records).toHaveLength(1)
      expect(result.request.records[0].provider).toBe('openai')
      expect(result.request.records[0].model).toBe('gpt-4')
      expect(result.request.records[0].input_tokens).toBe(100)
      expect(result.request.records[0].output_tokens).toBe(50)
      expect(result.request.records[0].total_tokens).toBe(150)
    })

    it('should set correct export_metadata', () => {
      const record = createValidRecord()
      const result = transformer.transform([record])

      expect(result.request.export_metadata.exporter_version).toBe('1.1.0')
      expect(result.request.export_metadata.aggregation_period).toBe('daily')
      expect(result.request.export_metadata.export_timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('should generate source_event_id for each record', () => {
      const record = createValidRecord()
      const result = transformer.transform([record])

      expect(result.request.records[0].metadata.source_event_id).toBeDefined()
      expect(result.request.records[0].metadata.source_event_id.length).toBeGreaterThan(0)
    })

    it('should set correct tenant_id from config', () => {
      const record = createValidRecord()
      const result = transformer.transform([record])

      expect(result.request.tenant_id).toBe('550e8400-e29b-41d4-a716-446655440000')
    })

    it('should calculate date_range from records', () => {
      const records = [
        createValidRecord({ usageDate: '2025-01-01' }),
        createValidRecord({ usageDate: '2025-01-05' }),
        createValidRecord({ usageDate: '2025-01-03' }),
      ]

      const result = transformer.transform(records)

      expect(result.request.export_metadata.date_range.start).toContain('2025-01-01')
      expect(result.request.export_metadata.date_range.end).toContain('2025-01-05')
    })
  })

  describe('エラーハンドリング', () => {
    it('should throw error when records array is empty', () => {
      expect(() => transformer.transform([])).toThrow('No records to transform')
    })

    it('should throw error when token mismatch is detected', () => {
      const invalidRecord = createValidRecord({
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 200, // 不正な合計
      })

      expect(() => transformer.transform([invalidRecord])).toThrow('Token mismatch')
    })

    it('should round cost_actual to 7 decimal places', () => {
      const record = createValidRecord({
        costActual: 0.123456789, // 9桁の小数
      })

      const result = transformer.transform([record])

      // 7桁に丸められていることを確認
      expect(result.request.records[0].cost_actual).toBe(0.1234568)
    })
  })

  describe('バリデーション', () => {
    it('should validate output against apiMeterRequestSchema', () => {
      const record = createValidRecord()
      const result = transformer.transform([record])

      // zodスキーマによるバリデーションが成功していることを確認
      expect(result.request.tenant_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
      expect(result.request.records.length).toBeGreaterThan(0)
    })

    it('should set source_system to dify', () => {
      const record = createValidRecord()
      const result = transformer.transform([record])

      expect(result.request.records[0].metadata.source_system).toBe('dify')
    })

    it('should set aggregation_method to daily_sum', () => {
      const record = createValidRecord()
      const result = transformer.transform([record])

      expect(result.request.records[0].metadata.aggregation_method).toBe('daily_sum')
    })
  })
})
