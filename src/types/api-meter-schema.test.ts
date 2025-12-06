import { describe, expect, it } from 'vitest'
import { apiMeterRequestSchema, apiMeterUsageRecordSchema } from './api-meter-schema.js'

describe('ApiMeterUsageRecord Schema', () => {
  describe('正常系', () => {
    it('正しいデータでバリデーション成功', () => {
      const validData = {
        usage_date: '2025-11-29',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        input_tokens: 10000,
        output_tokens: 5000,
        total_tokens: 15000,
        request_count: 25,
        cost_actual: 0.105,
        currency: 'USD',
        metadata: {
          source_system: 'dify' as const,
          source_event_id: 'dify-2025-11-29-anthropic-claude-3-5-sonnet-abc123',
          source_app_id: 'app-123',
          source_app_name: 'Test App',
          aggregation_method: 'daily_sum',
        },
      }

      const result = apiMeterUsageRecordSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.usage_date).toBe('2025-11-29')
        expect(result.data.provider).toBe('anthropic')
        expect(result.data.model).toBe('claude-3-5-sonnet-20241022')
        expect(result.data.total_tokens).toBe(15000)
      }
    })

    it('total_tokens = input_tokens + output_tokens の場合に成功', () => {
      const validData = {
        usage_date: '2025-12-05',
        provider: 'openai',
        model: 'gpt-4-0613',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
        request_count: 5,
        cost_actual: 0.015,
        currency: 'USD',
        metadata: {
          source_system: 'dify' as const,
          source_event_id: 'test-event-id',
          aggregation_method: 'daily_sum',
        },
      }

      const result = apiMeterUsageRecordSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('オプショナルフィールドを省略しても成功', () => {
      const minimalData = {
        usage_date: '2025-12-05',
        provider: 'google',
        model: 'gemini-1.0-pro',
        input_tokens: 50,
        output_tokens: 50,
        total_tokens: 100,
        request_count: 1,
        cost_actual: 0.001,
        currency: 'USD',
        metadata: {
          source_system: 'dify' as const,
          source_event_id: 'minimal-event-id',
          aggregation_method: 'daily_sum',
        },
      }

      const result = apiMeterUsageRecordSchema.safeParse(minimalData)
      expect(result.success).toBe(true)
    })
  })

  describe('異常系', () => {
    it('total_tokens ≠ input_tokens + output_tokens の場合にエラー', () => {
      const invalidData = {
        usage_date: '2025-12-05',
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 400, // 不一致: 100 + 200 = 300 ≠ 400
        request_count: 5,
        cost_actual: 0.02,
        currency: 'USD',
        metadata: {
          source_system: 'dify' as const,
          source_event_id: 'test-event-id',
          aggregation_method: 'daily_sum',
        },
      }

      const result = apiMeterUsageRecordSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('total_tokens')
      }
    })

    it('必須フィールド欠損時にエラー', () => {
      const incompleteData = {
        usage_date: '2025-12-05',
        // provider が欠損
        model: 'test-model',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
        request_count: 5,
        cost_actual: 0.02,
      }

      const result = apiMeterUsageRecordSchema.safeParse(incompleteData)
      expect(result.success).toBe(false)
    })

    it('usage_date が YYYY-MM-DD 形式でない場合にエラー', () => {
      const invalidDateData = {
        usage_date: '2025/12/05', // スラッシュ区切り（無効）
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
        request_count: 5,
        cost_actual: 0.02,
        currency: 'USD',
        metadata: {
          source_system: 'dify' as const,
          source_event_id: 'test-event-id',
          aggregation_method: 'daily_sum',
        },
      }

      const result = apiMeterUsageRecordSchema.safeParse(invalidDateData)
      expect(result.success).toBe(false)
    })

    it('負のトークン数でエラー', () => {
      const negativeTokenData = {
        usage_date: '2025-12-05',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: -10, // 負の値（無効）
        output_tokens: 200,
        total_tokens: 190,
        request_count: 5,
        cost_actual: 0.02,
        currency: 'USD',
        metadata: {
          source_system: 'dify' as const,
          source_event_id: 'test-event-id',
          aggregation_method: 'daily_sum',
        },
      }

      const result = apiMeterUsageRecordSchema.safeParse(negativeTokenData)
      expect(result.success).toBe(false)
    })
  })
})

describe('ApiMeterRequest Schema', () => {
  describe('正常系', () => {
    it('正しいリクエストデータでバリデーション成功', () => {
      const validRequest = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        export_metadata: {
          exporter_version: '1.1.0',
          export_timestamp: '2025-12-05T10:30:00.000Z',
          aggregation_period: 'daily' as const,
          date_range: {
            start: '2025-11-29T00:00:00.000Z',
            end: '2025-11-29T23:59:59.999Z',
          },
        },
        records: [
          {
            usage_date: '2025-11-29',
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            input_tokens: 10000,
            output_tokens: 5000,
            total_tokens: 15000,
            request_count: 25,
            cost_actual: 0.105,
            currency: 'USD',
            metadata: {
              source_system: 'dify' as const,
              source_event_id: 'test-event-id',
              source_app_id: 'app-123',
              source_app_name: 'Test App',
              aggregation_method: 'daily_sum',
            },
          },
        ],
      }

      const result = apiMeterRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.tenant_id).toBe('123e4567-e89b-12d3-a456-426614174000')
        expect(result.data.records).toHaveLength(1)
      }
    })

    it('複数レコードでバリデーション成功', () => {
      const multiRecordRequest = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        export_metadata: {
          exporter_version: '1.1.0',
          export_timestamp: '2025-12-05T10:30:00.000Z',
          aggregation_period: 'daily' as const,
          date_range: {
            start: '2025-11-29T00:00:00.000Z',
            end: '2025-11-29T23:59:59.999Z',
          },
        },
        records: [
          {
            usage_date: '2025-11-29',
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            input_tokens: 100,
            output_tokens: 50,
            total_tokens: 150,
            request_count: 5,
            cost_actual: 0.01,
            currency: 'USD',
            metadata: {
              source_system: 'dify' as const,
              source_event_id: 'event-1',
              aggregation_method: 'daily_sum',
            },
          },
          {
            usage_date: '2025-11-29',
            provider: 'openai',
            model: 'gpt-4-0613',
            input_tokens: 200,
            output_tokens: 100,
            total_tokens: 300,
            request_count: 10,
            cost_actual: 0.02,
            currency: 'USD',
            metadata: {
              source_system: 'dify' as const,
              source_event_id: 'event-2',
              aggregation_method: 'daily_sum',
            },
          },
        ],
      }

      const result = apiMeterRequestSchema.safeParse(multiRecordRequest)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.records).toHaveLength(2)
      }
    })
  })

  describe('異常系', () => {
    it('tenant_id が UUID 形式でない場合にエラー', () => {
      const invalidTenantRequest = {
        tenant_id: 'not-a-uuid', // UUID形式ではない
        export_metadata: {
          exporter_version: '1.1.0',
          export_timestamp: '2025-12-05T10:30:00.000Z',
          aggregation_period: 'daily' as const,
          date_range: {
            start: '2025-11-29T00:00:00.000Z',
            end: '2025-11-29T23:59:59.999Z',
          },
        },
        records: [
          {
            usage_date: '2025-11-29',
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            input_tokens: 100,
            output_tokens: 50,
            total_tokens: 150,
            request_count: 5,
            cost_actual: 0.01,
            currency: 'USD',
            metadata: {
              source_system: 'dify' as const,
              source_event_id: 'test-event-id',
              aggregation_method: 'daily_sum',
            },
          },
        ],
      }

      const result = apiMeterRequestSchema.safeParse(invalidTenantRequest)
      expect(result.success).toBe(false)
    })

    it('records が空配列の場合にエラー', () => {
      const emptyRecordsRequest = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        export_metadata: {
          exporter_version: '1.1.0',
          export_timestamp: '2025-12-05T10:30:00.000Z',
          aggregation_period: 'daily' as const,
          date_range: {
            start: '2025-11-29T00:00:00.000Z',
            end: '2025-11-29T23:59:59.999Z',
          },
        },
        records: [], // 空配列（無効）
      }

      const result = apiMeterRequestSchema.safeParse(emptyRecordsRequest)
      expect(result.success).toBe(false)
    })

    it('export_metadataのaggregation_periodが不正な値の場合にエラー', () => {
      const invalidPeriodRequest = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        export_metadata: {
          exporter_version: '1.1.0',
          export_timestamp: '2025-12-05T10:30:00.000Z',
          aggregation_period: 'invalid', // 無効な値
          date_range: {
            start: '2025-11-29T00:00:00.000Z',
            end: '2025-11-29T23:59:59.999Z',
          },
        },
        records: [
          {
            usage_date: '2025-11-29',
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            input_tokens: 100,
            output_tokens: 50,
            total_tokens: 150,
            request_count: 5,
            cost_actual: 0.01,
            currency: 'USD',
            metadata: {
              source_system: 'dify' as const,
              source_event_id: 'test-event-id',
              aggregation_method: 'daily_sum',
            },
          },
        ],
      }

      const result = apiMeterRequestSchema.safeParse(invalidPeriodRequest)
      expect(result.success).toBe(false)
    })
  })
})
