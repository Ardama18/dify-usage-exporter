import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDataTransformer,
  normalizeModel,
  normalizeProvider,
  type TransformerDeps,
} from '../../../src/transformer/data-transformer.js'
import type { DifyUsageRecord } from '../../../src/types/dify-usage.js'

describe('normalizeProvider', () => {
  it('should convert uppercase to lowercase', () => {
    expect(normalizeProvider('OpenAI')).toBe('openai')
    expect(normalizeProvider('ANTHROPIC')).toBe('anthropic')
  })

  it('should trim leading and trailing whitespace', () => {
    expect(normalizeProvider('  openai  ')).toBe('openai')
    expect(normalizeProvider('\topenai\t')).toBe('openai')
  })

  it('should handle special characters (tab, newline)', () => {
    expect(normalizeProvider('\n openai \n')).toBe('openai')
    expect(normalizeProvider(' OpenAI \t')).toBe('openai')
  })

  it('should handle already normalized input', () => {
    expect(normalizeProvider('openai')).toBe('openai')
  })
})

describe('normalizeModel', () => {
  it('should convert uppercase to lowercase', () => {
    expect(normalizeModel('GPT-4')).toBe('gpt-4')
    expect(normalizeModel('Claude-3-OPUS')).toBe('claude-3-opus')
  })

  it('should trim leading and trailing whitespace', () => {
    expect(normalizeModel('  gpt-4  ')).toBe('gpt-4')
    expect(normalizeModel('\tgpt-4\t')).toBe('gpt-4')
  })

  it('should handle special characters (tab, newline)', () => {
    expect(normalizeModel('\n gpt-4 \n')).toBe('gpt-4')
    expect(normalizeModel(' GPT-4 \t')).toBe('gpt-4')
  })

  it('should handle already normalized input', () => {
    expect(normalizeModel('gpt-4')).toBe('gpt-4')
  })

  it('should preserve hyphens and dots', () => {
    expect(normalizeModel('gpt-4-turbo')).toBe('gpt-4-turbo')
    expect(normalizeModel('claude-3.5-sonnet')).toBe('claude-3.5-sonnet')
  })
})

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
      const record: DifyUsageRecord = {
        date: '2025-01-01',
        app_id: 'app-123',
        app_name: 'Test App',
        provider: 'OpenAI',
        model: 'GPT-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
        user_id: 'user-456',
      }

      const result = transformer.transform([record])

      expect(result.successCount).toBe(1)
      expect(result.errorCount).toBe(0)
      expect(result.records).toHaveLength(1)
      expect(result.records[0].provider).toBe('openai')
      expect(result.records[0].model).toBe('gpt-4')
    })

    it('should add transformed_at to each record', () => {
      const record: DifyUsageRecord = {
        date: '2025-01-01',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
      }

      const result = transformer.transform([record])

      expect(result.records[0].transformed_at).toBeDefined()
      expect(result.records[0].transformed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('should generate idempotency_key for each record', () => {
      const record: DifyUsageRecord = {
        date: '2025-01-01',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
      }

      const result = transformer.transform([record])

      expect(result.records[0].idempotency_key).toBe('2025-01-01_app-123_openai_gpt-4')
    })

    it('should generate batchIdempotencyKey', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
        {
          date: '2025-01-01',
          app_id: 'app-456',
          provider: 'anthropic',
          model: 'claude-3',
          input_tokens: 50,
          output_tokens: 100,
          total_tokens: 150,
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
      const record: DifyUsageRecord = {
        date: '2025-01-01',
        app_id: '', // 空文字列でバリデーションエラー
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
      }

      const result = transformer.transform([record])

      expect(result.errorCount).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toBe('出力バリデーションエラー')
    })

    it('should guarantee successCount + errorCount = input count', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
        {
          date: '2025-01-01',
          app_id: '', // エラー
          provider: 'anthropic',
          model: 'claude-3',
          input_tokens: 50,
          output_tokens: 100,
          total_tokens: 150,
        },
      ]

      const result = transformer.transform(records)

      expect(result.successCount + result.errorCount).toBe(records.length)
    })

    it('should not throw exceptions', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: '',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: -1, // 複数エラー
          output_tokens: 200,
          total_tokens: 300,
        },
      ]

      expect(() => transformer.transform(records)).not.toThrow()
    })

    it('should only return successful records', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
        {
          date: '2025-01-01',
          app_id: '', // エラー
          provider: 'anthropic',
          model: 'claude-3',
          input_tokens: 50,
          output_tokens: 100,
          total_tokens: 150,
        },
      ]

      const result = transformer.transform(records)

      expect(result.records).toHaveLength(1)
      expect(result.records[0].app_id).toBe('app-123')
    })
  })
})
