import { describe, expect, it } from 'vitest'
import { legacySpoolFileSchema, spoolFileSchema } from '../../../src/types/spool.js'

describe('SpoolFile型定義', () => {
  describe('spoolFileSchema (v2.0.0)', () => {
    // 有効なAPI_Meterレコード
    const validApiMeterRecord = {
      usage_date: '2025-01-21',
      provider: 'openai',
      model: 'gpt-4',
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
      request_count: 1,
      cost_actual: 0.001,
      currency: 'USD',
      metadata: {
        source_system: 'dify' as const,
        source_event_id: 'test-event-id',
        source_app_id: 'test-app-id',
        source_app_name: 'Test App',
        aggregation_method: 'daily_sum',
      },
    }

    // 有効なスプールファイル (v2.0.0)
    const validSpoolFile = {
      version: '2.0.0' as const,
      data: {
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        export_metadata: {
          exporter_version: '1.1.0',
          export_timestamp: '2025-01-21T10:00:00.000Z',
          aggregation_period: 'daily' as const,
          source_system: 'dify' as const,
          date_range: {
            start: '2025-01-21T00:00:00.000Z',
            end: '2025-01-21T23:59:59.999Z',
          },
        },
        records: [validApiMeterRecord],
      },
      createdAt: '2025-01-21T10:00:00.000Z',
      retryCount: 0,
    }

    it('正常なSpoolFileをバリデーション成功すること', () => {
      const result = spoolFileSchema.safeParse(validSpoolFile)
      expect(result.success).toBe(true)
    })

    it('createdAtがISO 8601形式でない場合、バリデーション失敗すること', () => {
      const invalidSpoolFile = {
        ...validSpoolFile,
        createdAt: '2025-01-21 10:00:00', // 不正な形式
      }

      const result = spoolFileSchema.safeParse(invalidSpoolFile)
      expect(result.success).toBe(false)
    })

    it('retryCountが負の場合、バリデーション失敗すること', () => {
      const invalidSpoolFile = {
        ...validSpoolFile,
        retryCount: -1, // 負の値
      }

      const result = spoolFileSchema.safeParse(invalidSpoolFile)
      expect(result.success).toBe(false)
    })

    it('必須フィールドが欠けている場合、バリデーション失敗すること', () => {
      const invalidSpoolFile = {
        version: '2.0.0' as const,
        data: validSpoolFile.data,
        // createdAtがない
        retryCount: 0,
      }

      const result = spoolFileSchema.safeParse(invalidSpoolFile)
      expect(result.success).toBe(false)
    })

    it('versionが2.0.0以外の場合、バリデーション失敗すること', () => {
      const invalidSpoolFile = {
        ...validSpoolFile,
        version: '1.0.0', // 不正なバージョン
      }

      const result = spoolFileSchema.safeParse(invalidSpoolFile)
      expect(result.success).toBe(false)
    })

    it('recordsが空の場合、バリデーション失敗すること（min(1)制約）', () => {
      const invalidSpoolFile = {
        ...validSpoolFile,
        data: {
          ...validSpoolFile.data,
          records: [], // 空配列
        },
      }

      const result = spoolFileSchema.safeParse(invalidSpoolFile)
      expect(result.success).toBe(false)
    })
  })

  describe('legacySpoolFileSchema (v1.0.0)', () => {
    it('旧形式のSpoolFileをバリデーション成功すること', () => {
      const validLegacySpoolFile = {
        version: '1.0.0' as const,
        batchIdempotencyKey: 'test-batch-key-123',
        records: [
          {
            date: '2025-01-21',
            app_id: 'test-app-id',
            app_name: 'Test App',
            token_count: 100,
            total_price: '0.001',
            currency: 'USD',
            idempotency_key: 'test-key-1',
            transformed_at: '2025-01-21T10:00:00.000Z',
          },
        ],
        firstAttempt: '2025-01-21T10:00:00.000Z',
        createdAt: '2025-01-21T10:00:00.000Z',
        retryCount: 0,
        lastError: '',
      }

      const result = legacySpoolFileSchema.safeParse(validLegacySpoolFile)
      expect(result.success).toBe(true)
    })

    it('versionがない旧形式もバリデーション成功すること', () => {
      const validLegacySpoolFile = {
        batchIdempotencyKey: 'test-batch-key-123',
        createdAt: '2025-01-21T10:00:00.000Z',
        retryCount: 0,
      }

      const result = legacySpoolFileSchema.safeParse(validLegacySpoolFile)
      expect(result.success).toBe(true)
    })
  })
})
