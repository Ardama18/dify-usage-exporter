import { describe, expect, it } from 'vitest'
import type { AggregatedModelRecord } from '../../aggregator/usage-aggregator.js'
import { createNormalizer } from '../normalizer.js'

describe('Normalizer', () => {
  it('AggregatedModelRecord → NormalizedModelRecord 変換（クレンジングのみ）', () => {
    const normalizer = createNormalizer()

    const input: AggregatedModelRecord[] = [
      {
        period: '2025-11-29',
        period_type: 'daily',
        user_id: 'user001',
        user_type: 'end_user',
        app_id: 'app123',
        app_name: 'Test App',
        model_provider: 'AWS-BEDROCK', // 大文字
        model_name: 'Claude-3-5-Sonnet', // 大文字混在
        prompt_tokens: 10000,
        completion_tokens: 5000,
        total_tokens: 15000,
        prompt_price: '0.0100000',
        completion_price: '0.0050000',
        total_price: '0.0150000',
        currency: 'USD',
        execution_count: 10,
      },
    ]

    const result = normalizer.normalize(input)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      provider: 'aws-bedrock', // 小文字化のみ（マッピングなし）
      model: 'claude-3-5-sonnet', // 小文字化のみ（マッピングなし）
      inputTokens: 10000,
      outputTokens: 5000,
      totalTokens: 15000,
      costActual: 0.015,
      usageDate: '2025-11-29',
      appId: 'app123',
      appName: 'Test App',
      userId: 'user001',
    })
  })

  it('複数レコードの一括変換', () => {
    const normalizer = createNormalizer()

    const input: AggregatedModelRecord[] = [
      {
        period: '2025-11-29',
        period_type: 'daily',
        user_id: 'user001',
        user_type: 'end_user',
        app_id: 'app123',
        app_name: 'Test App',
        model_provider: 'openai',
        model_name: 'gpt-4',
        prompt_tokens: 5000,
        completion_tokens: 2500,
        total_tokens: 7500,
        prompt_price: '0.0200000',
        completion_price: '0.0100000',
        total_price: '0.0300000',
        currency: 'USD',
        execution_count: 5,
      },
      {
        period: '2025-11-29',
        period_type: 'daily',
        user_id: 'user002',
        user_type: 'account',
        app_id: 'app456',
        app_name: 'Another App',
        model_provider: 'google',
        model_name: 'gemini-pro',
        prompt_tokens: 8000,
        completion_tokens: 4000,
        total_tokens: 12000,
        prompt_price: '0.0080000',
        completion_price: '0.0040000',
        total_price: '0.0120000',
        currency: 'USD',
        execution_count: 8,
      },
    ]

    const result = normalizer.normalize(input)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      provider: 'openai',
      model: 'gpt-4', // そのまま（マッピングなし）
      inputTokens: 5000,
      outputTokens: 2500,
      totalTokens: 7500,
      costActual: 0.03,
      usageDate: '2025-11-29',
      appId: 'app123',
      appName: 'Test App',
      userId: 'user001',
    })
    expect(result[1]).toEqual({
      provider: 'google',
      model: 'gemini-pro', // そのまま（マッピングなし）
      inputTokens: 8000,
      outputTokens: 4000,
      totalTokens: 12000,
      costActual: 0.012,
      usageDate: '2025-11-29',
      appId: 'app456',
      appName: 'Another App',
      userId: 'user002',
    })
  })

  it('appId/userId の optional フィールド処理', () => {
    const normalizer = createNormalizer()

    const input: AggregatedModelRecord[] = [
      {
        period: '2025-11-29',
        period_type: 'daily',
        user_id: 'user001',
        user_type: 'end_user',
        app_id: 'app123',
        app_name: 'Test App',
        model_provider: 'anthropic',
        model_name: 'claude-3-5-sonnet',
        prompt_tokens: 1000,
        completion_tokens: 500,
        total_tokens: 1500,
        prompt_price: '0.0010000',
        completion_price: '0.0005000',
        total_price: '0.0015000',
        currency: 'USD',
        execution_count: 1,
      },
    ]

    const result = normalizer.normalize(input)

    expect(result).toHaveLength(1)
    expect(result[0].appId).toBe('app123')
    expect(result[0].userId).toBe('user001')
  })

  it('未知のプロバイダー/モデルもそのまま転送', () => {
    const normalizer = createNormalizer()

    const input: AggregatedModelRecord[] = [
      {
        period: '2025-11-29',
        period_type: 'daily',
        user_id: 'user001',
        user_type: 'end_user',
        app_id: 'app123',
        app_name: 'Test App',
        model_provider: 'custom-provider',
        model_name: 'custom-model-v1',
        prompt_tokens: 1000,
        completion_tokens: 500,
        total_tokens: 1500,
        prompt_price: '0.0010000',
        completion_price: '0.0005000',
        total_price: '0.0015000',
        currency: 'USD',
        execution_count: 1,
      },
    ]

    const result = normalizer.normalize(input)

    expect(result).toHaveLength(1)
    expect(result[0].provider).toBe('custom-provider') // そのまま（unknownにしない）
    expect(result[0].model).toBe('custom-model-v1') // そのまま
  })

  it('空のプロバイダー/モデルはunknownに変換', () => {
    const normalizer = createNormalizer()

    const input: AggregatedModelRecord[] = [
      {
        period: '2025-11-29',
        period_type: 'daily',
        user_id: 'user001',
        user_type: 'end_user',
        app_id: 'app123',
        app_name: 'Test App',
        model_provider: '',
        model_name: '   ',
        prompt_tokens: 1000,
        completion_tokens: 500,
        total_tokens: 1500,
        prompt_price: '0.0010000',
        completion_price: '0.0005000',
        total_price: '0.0015000',
        currency: 'USD',
        execution_count: 1,
      },
    ]

    const result = normalizer.normalize(input)

    expect(result).toHaveLength(1)
    expect(result[0].provider).toBe('unknown')
    expect(result[0].model).toBe('unknown')
  })
})
