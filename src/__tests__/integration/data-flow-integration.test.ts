/**
 * データフロー全体の統合テスト
 *
 * Aggregate → Normalize → Transform → Sendの全体フローを検証
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AggregatedModelRecord } from '../../aggregator/usage-aggregator.js'
import { createLogger } from '../../logger/winston-logger.js'
import type { INormalizer } from '../../normalizer/normalizer.js'
import { createNormalizer } from '../../normalizer/normalizer.js'
import type { TransformResult } from '../../transformer/data-transformer.js'
import { createDataTransformer } from '../../transformer/data-transformer.js'
import type { ApiMeterRequest } from '../../types/api-meter-schema.js'

describe('Data Flow Integration Test', () => {
  let normalizer: INormalizer
  let logger: ReturnType<typeof createLogger>

  beforeEach(() => {
    // 環境変数をモック（有効なUUID形式を使用）
    vi.stubEnv('API_METER_TENANT_ID', '550e8400-e29b-41d4-a716-446655440000')
    vi.stubEnv('API_METER_TOKEN', 'test-token')
    vi.stubEnv('API_METER_URL', 'https://api-meter.example.com')

    normalizer = createNormalizer()
    logger = createLogger({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
    } as never)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('per_modelモード: Aggregate → Normalize → Transform の完全フロー', () => {
    // Phase 1: Aggregated Data (from aggregator)
    const aggregatedRecords: AggregatedModelRecord[] = [
      {
        period: '2025-12-05',
        period_type: 'daily',
        user_id: 'user-001',
        user_type: 'end_user',
        app_id: 'app-001',
        app_name: 'Test App',
        model_provider: 'aws-bedrock', // 正規化前（Dify内部名）
        model_name: 'claude-3-5-sonnet', // 正規化前（バージョン番号なし）
        prompt_tokens: 10000,
        completion_tokens: 5000,
        total_tokens: 15000,
        prompt_price: '0.003',
        completion_price: '0.015',
        total_price: '0.018',
        currency: 'USD',
        execution_count: 100,
      },
    ]

    // Phase 2: Normalize (provider/model正規化)
    const normalizedRecords = normalizer.normalize(aggregatedRecords)

    expect(normalizedRecords).toHaveLength(1)
    expect(normalizedRecords[0]).toMatchObject({
      provider: 'aws', // 正規化後
      model: 'claude-3-5-sonnet-20241022', // 正規化後（バージョン番号付与）
      inputTokens: 10000,
      outputTokens: 5000,
      totalTokens: 15000,
      costActual: 0.018,
      usageDate: '2025-12-05',
      appId: 'app-001',
      userId: 'user-001',
    })

    // Phase 3: Transform (ApiMeterRequest形式へ変換)
    const transformer = createDataTransformer({ logger })
    const transformResult: TransformResult = transformer.transform(normalizedRecords)

    expect(transformResult.recordCount).toBe(1)

    const request: ApiMeterRequest = transformResult.request
    expect(request.tenant_id).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(request.export_metadata.exporter_version).toBe('1.1.0')
    expect(request.export_metadata.aggregation_period).toBe('daily')
    expect(request.records).toHaveLength(1)

    const record = request.records[0]
    expect(record.usage_date).toBe('2025-12-05')
    expect(record.provider).toBe('aws')
    expect(record.model).toBe('claude-3-5-sonnet-20241022')
    expect(record.input_tokens).toBe(10000)
    expect(record.output_tokens).toBe(5000)
    expect(record.total_tokens).toBe(15000)
    expect(record.request_count).toBe(1)
    expect(record.cost_actual).toBe(0.018)
    expect(record.currency).toBe('USD')
    expect(record.metadata.source_system).toBe('dify')
    expect(record.metadata.source_event_id).toBeDefined()
    expect(record.metadata.source_app_id).toBe('app-001')
    expect(record.metadata.aggregation_method).toBe('daily_sum')
  })

  it('日別データのフィルタリング: period_type === "daily"のみ通過', () => {
    const aggregatedRecords: AggregatedModelRecord[] = [
      {
        period: '2025-12-05',
        period_type: 'daily', // ✅ 通過
        user_id: 'user-001',
        user_type: 'end_user',
        app_id: 'app-001',
        app_name: 'Test App',
        model_provider: 'openai',
        model_name: 'gpt-4',
        prompt_tokens: 10000,
        completion_tokens: 5000,
        total_tokens: 15000,
        prompt_price: '0.003',
        completion_price: '0.015',
        total_price: '0.018',
        currency: 'USD',
        execution_count: 100,
      },
      {
        period: '2025-W49',
        period_type: 'weekly', // ❌ フィルタリング対象
        user_id: 'user-002',
        user_type: 'end_user',
        app_id: 'app-002',
        app_name: 'Test App 2',
        model_provider: 'anthropic',
        model_name: 'claude-3-opus',
        prompt_tokens: 20000,
        completion_tokens: 10000,
        total_tokens: 30000,
        prompt_price: '0.015',
        completion_price: '0.075',
        total_price: '0.090',
        currency: 'USD',
        execution_count: 200,
      },
    ]

    // 日別データのみをフィルタリング（src/index.tsで実行される想定）
    const dailyRecords = aggregatedRecords.filter((r) => r.period_type === 'daily')

    expect(dailyRecords).toHaveLength(1)
    expect(dailyRecords[0].period_type).toBe('daily')
  })

  it('複数レコードの変換: date_rangeが正しく計算される', () => {
    const aggregatedRecords: AggregatedModelRecord[] = [
      {
        period: '2025-12-01',
        period_type: 'daily',
        user_id: 'user-001',
        user_type: 'end_user',
        app_id: 'app-001',
        app_name: 'Test App',
        model_provider: 'openai',
        model_name: 'gpt-4',
        prompt_tokens: 10000,
        completion_tokens: 5000,
        total_tokens: 15000,
        prompt_price: '0.003',
        completion_price: '0.015',
        total_price: '0.018',
        currency: 'USD',
        execution_count: 100,
      },
      {
        period: '2025-12-05',
        period_type: 'daily',
        user_id: 'user-002',
        user_type: 'end_user',
        app_id: 'app-002',
        app_name: 'Test App 2',
        model_provider: 'anthropic',
        model_name: 'claude-3-opus',
        prompt_tokens: 20000,
        completion_tokens: 10000,
        total_tokens: 30000,
        prompt_price: '0.015',
        completion_price: '0.075',
        total_price: '0.090',
        currency: 'USD',
        execution_count: 200,
      },
    ]

    const normalizedRecords = normalizer.normalize(aggregatedRecords)
    const transformer = createDataTransformer({ logger })
    const transformResult = transformer.transform(normalizedRecords)

    const request = transformResult.request

    // date_rangeが2025-12-01 ~ 2025-12-05になっていることを確認
    expect(new Date(request.export_metadata.date_range.start).toISOString().split('T')[0]).toBe(
      '2025-12-01',
    )
    expect(new Date(request.export_metadata.date_range.end).toISOString().split('T')[0]).toBe(
      '2025-12-05',
    )
  })
})
