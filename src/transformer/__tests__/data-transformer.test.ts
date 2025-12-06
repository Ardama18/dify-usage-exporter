import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Logger } from '../../logger/winston-logger.js'
import type { NormalizedModelRecord } from '../../normalizer/normalizer.js'
import { createDataTransformer } from '../data-transformer.js'

describe('DataTransformer - API_Meter新仕様対応', () => {
  let mockLogger: Logger
  let mockEnv: {
    API_METER_TENANT_ID: string
  }

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      child: vi.fn().mockReturnThis(),
    }

    mockEnv = {
      API_METER_TENANT_ID: '550e8400-e29b-41d4-a716-446655440000',
    }

    // 環境変数をモック（全必須環境変数）
    vi.stubEnv('API_METER_TENANT_ID', mockEnv.API_METER_TENANT_ID)
    vi.stubEnv('DIFY_API_BASE_URL', 'https://example.com')
    vi.stubEnv('DIFY_EMAIL', 'test@example.com')
    vi.stubEnv('DIFY_PASSWORD', 'password')
    vi.stubEnv('EXTERNAL_API_URL', 'https://api.example.com')
    vi.stubEnv('EXTERNAL_API_TOKEN', 'token')
    vi.stubEnv('API_METER_TOKEN', 'meter-token')
    vi.stubEnv('API_METER_URL', 'https://meter.example.com')
  })

  describe('NormalizedModelRecord → ApiMeterUsageRecord変換', () => {
    it('正常に変換できること', () => {
      const transformer = createDataTransformer({ logger: mockLogger })

      const normalizedRecords: NormalizedModelRecord[] = [
        {
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          costActual: 0.025,
          usageDate: '2025-12-01',
          appId: 'app-123',
          userId: 'user-456',
        },
      ]

      const result = transformer.transform(normalizedRecords)

      expect(result.request.records).toHaveLength(1)
      const record = result.request.records[0]

      expect(record.usage_date).toBe('2025-12-01')
      expect(record.provider).toBe('anthropic')
      expect(record.model).toBe('claude-3-5-sonnet-20241022')
      expect(record.input_tokens).toBe(1000)
      expect(record.output_tokens).toBe(500)
      expect(record.total_tokens).toBe(1500)
      expect(record.cost_actual).toBe(0.025)
      expect(record.metadata.source_app_id).toBe('app-123')
      expect(record.metadata.source_system).toBe('dify')
      expect(record.metadata.aggregation_method).toBe('daily_sum')
      expect(record.metadata.source_event_id).toBeDefined()
    })

    it('複数レコードを一括変換できること', () => {
      const transformer = createDataTransformer({ logger: mockLogger })

      const normalizedRecords: NormalizedModelRecord[] = [
        {
          provider: 'openai',
          model: 'gpt-4-0613',
          inputTokens: 2000,
          outputTokens: 1000,
          totalTokens: 3000,
          costActual: 0.12,
          usageDate: '2025-12-01',
          appId: 'app-1',
          userId: 'user-1',
        },
        {
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          inputTokens: 1500,
          outputTokens: 750,
          totalTokens: 2250,
          costActual: 0.05,
          usageDate: '2025-12-02',
          appId: 'app-2',
          userId: 'user-2',
        },
      ]

      const result = transformer.transform(normalizedRecords)

      expect(result.request.records).toHaveLength(2)
      expect(result.recordCount).toBe(2)
    })
  })

  describe('トークン計算検証', () => {
    it('total_tokens = input_tokens + output_tokensが成立すること', () => {
      const transformer = createDataTransformer({ logger: mockLogger })

      const normalizedRecords: NormalizedModelRecord[] = [
        {
          provider: 'openai',
          model: 'gpt-4',
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500, // 正しい合計
          costActual: 0.05,
          usageDate: '2025-12-01',
        },
      ]

      const result = transformer.transform(normalizedRecords)

      expect(result.request.records[0].total_tokens).toBe(1500)
      expect(result.request.records[0].input_tokens + result.request.records[0].output_tokens).toBe(
        1500,
      )
    })

    it('トークン不一致時にエラーを投げること', () => {
      const transformer = createDataTransformer({ logger: mockLogger })

      const normalizedRecords: NormalizedModelRecord[] = [
        {
          provider: 'openai',
          model: 'gpt-4',
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 2000, // 不正な合計（1000+500=1500のはず）
          costActual: 0.05,
          usageDate: '2025-12-01',
        },
      ]

      expect(() => transformer.transform(normalizedRecords)).toThrow(
        'Token mismatch: 2000 !== 1500 (1000 + 500)',
      )
    })
  })

  describe('日付範囲計算', () => {
    it('単一レコードの場合、start=endとなること', () => {
      const transformer = createDataTransformer({ logger: mockLogger })

      const normalizedRecords: NormalizedModelRecord[] = [
        {
          provider: 'openai',
          model: 'gpt-4',
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          costActual: 0.05,
          usageDate: '2025-12-01',
        },
      ]

      const result = transformer.transform(normalizedRecords)

      const exportMetadata = result.request.export_metadata
      expect(exportMetadata.date_range.start).toContain('2025-12-01')
      expect(exportMetadata.date_range.end).toContain('2025-12-01')
    })

    it('複数レコードの場合、正しい日付範囲が計算されること', () => {
      const transformer = createDataTransformer({ logger: mockLogger })

      const normalizedRecords: NormalizedModelRecord[] = [
        {
          provider: 'openai',
          model: 'gpt-4',
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          costActual: 0.05,
          usageDate: '2025-12-05', // 最新
        },
        {
          provider: 'anthropic',
          model: 'claude-3',
          inputTokens: 2000,
          outputTokens: 1000,
          totalTokens: 3000,
          costActual: 0.1,
          usageDate: '2025-12-01', // 最古
        },
        {
          provider: 'google',
          model: 'gemini-pro',
          inputTokens: 1500,
          outputTokens: 750,
          totalTokens: 2250,
          costActual: 0.075,
          usageDate: '2025-12-03', // 中間
        },
      ]

      const result = transformer.transform(normalizedRecords)

      const exportMetadata = result.request.export_metadata
      expect(exportMetadata.date_range.start).toContain('2025-12-01')
      expect(exportMetadata.date_range.end).toContain('2025-12-05')
    })
  })

  describe('ApiMeterRequest構築', () => {
    it('tenant_idが正しく設定されること', () => {
      const transformer = createDataTransformer({ logger: mockLogger })

      const normalizedRecords: NormalizedModelRecord[] = [
        {
          provider: 'openai',
          model: 'gpt-4',
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          costActual: 0.05,
          usageDate: '2025-12-01',
        },
      ]

      const result = transformer.transform(normalizedRecords)

      expect(result.request.tenant_id).toBe('550e8400-e29b-41d4-a716-446655440000')
    })

    it('export_metadataが正しく構築されること', () => {
      const transformer = createDataTransformer({ logger: mockLogger })

      const normalizedRecords: NormalizedModelRecord[] = [
        {
          provider: 'openai',
          model: 'gpt-4',
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          costActual: 0.05,
          usageDate: '2025-12-01',
        },
      ]

      const result = transformer.transform(normalizedRecords)

      const exportMetadata = result.request.export_metadata
      expect(exportMetadata.exporter_version).toBe('1.1.0')
      expect(exportMetadata.export_timestamp).toBeDefined()
      expect(exportMetadata.aggregation_period).toBe('daily')
      expect(exportMetadata.date_range.start).toBeDefined()
      expect(exportMetadata.date_range.end).toBeDefined()
    })
  })

  describe('異常系', () => {
    it('レコードが空配列の場合にエラーを投げること', () => {
      const transformer = createDataTransformer({ logger: mockLogger })

      const normalizedRecords: NormalizedModelRecord[] = []

      expect(() => transformer.transform(normalizedRecords)).toThrow('No records to transform')
    })

    it('zodスキーマでバリデーションエラー時に例外を投げること', () => {
      const transformer = createDataTransformer({ logger: mockLogger })

      const invalidRecords: NormalizedModelRecord[] = [
        {
          provider: '', // 空文字列は不正
          model: 'gpt-4',
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          costActual: 0.05,
          usageDate: '2025-12-01',
        },
      ]

      expect(() => transformer.transform(invalidRecords)).toThrow()
    })
  })
})
