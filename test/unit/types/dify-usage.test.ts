import { describe, expect, it } from 'vitest'
import {
  type DifyUsageRecord,
  type DifyUsageResponse,
  difyUsageRecordSchema,
  difyUsageResponseSchema,
} from '../../../src/types/dify-usage.js'

describe('difyUsageRecordSchema', () => {
  describe('正常系', () => {
    it('正常なデータのバリデーションに成功する', () => {
      const validRecord = {
        date: '2024-01-15',
        app_id: 'app-123',
        app_name: 'Test App',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
        user_id: 'user-456',
      }

      const result = difyUsageRecordSchema.safeParse(validRecord)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validRecord)
      }
    })

    it('オプションフィールドなしでもバリデーションに成功する', () => {
      const minimalRecord = {
        date: '2024-01-15',
        app_id: 'app-123',
        provider: 'anthropic',
        model: 'claude-3',
        input_tokens: 200,
        output_tokens: 100,
        total_tokens: 300,
      }

      const result = difyUsageRecordSchema.safeParse(minimalRecord)
      expect(result.success).toBe(true)
    })

    it('トークン数が0でもバリデーションに成功する', () => {
      const zeroTokenRecord = {
        date: '2024-01-15',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      }

      const result = difyUsageRecordSchema.safeParse(zeroTokenRecord)
      expect(result.success).toBe(true)
    })
  })

  describe('必須フィールド欠落時のエラー検出', () => {
    it('dateが欠落している場合エラーになる', () => {
      const invalidRecord = {
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
      }

      const result = difyUsageRecordSchema.safeParse(invalidRecord)
      expect(result.success).toBe(false)
    })

    it('app_idが欠落している場合エラーになる', () => {
      const invalidRecord = {
        date: '2024-01-15',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
      }

      const result = difyUsageRecordSchema.safeParse(invalidRecord)
      expect(result.success).toBe(false)
    })

    it('providerが欠落している場合エラーになる', () => {
      const invalidRecord = {
        date: '2024-01-15',
        app_id: 'app-123',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
      }

      const result = difyUsageRecordSchema.safeParse(invalidRecord)
      expect(result.success).toBe(false)
    })

    it('modelが欠落している場合エラーになる', () => {
      const invalidRecord = {
        date: '2024-01-15',
        app_id: 'app-123',
        provider: 'openai',
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
      }

      const result = difyUsageRecordSchema.safeParse(invalidRecord)
      expect(result.success).toBe(false)
    })

    it('total_tokensが欠落している場合エラーになる', () => {
      const invalidRecord = {
        date: '2024-01-15',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 50,
      }

      const result = difyUsageRecordSchema.safeParse(invalidRecord)
      expect(result.success).toBe(false)
    })
  })

  describe('日付形式（YYYY-MM-DD）のバリデーション', () => {
    it('正しい日付形式でバリデーションに成功する', () => {
      const record = {
        date: '2024-12-31',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
      }

      const result = difyUsageRecordSchema.safeParse(record)
      expect(result.success).toBe(true)
    })

    it('不正な日付形式（スラッシュ区切り）でエラーになる', () => {
      const record = {
        date: '2024/01/15',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
      }

      const result = difyUsageRecordSchema.safeParse(record)
      expect(result.success).toBe(false)
    })

    it('不正な日付形式（日-月-年）でエラーになる', () => {
      const record = {
        date: '15-01-2024',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
      }

      const result = difyUsageRecordSchema.safeParse(record)
      expect(result.success).toBe(false)
    })

    it('不正な日付形式（ISO 8601）でエラーになる', () => {
      const record = {
        date: '2024-01-15T10:30:00Z',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
      }

      const result = difyUsageRecordSchema.safeParse(record)
      expect(result.success).toBe(false)
    })
  })

  describe('トークン数の範囲チェック（0以上の整数）', () => {
    it('大きなトークン数でもバリデーションに成功する', () => {
      const record = {
        date: '2024-01-15',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 1000000,
        output_tokens: 500000,
        total_tokens: 1500000,
      }

      const result = difyUsageRecordSchema.safeParse(record)
      expect(result.success).toBe(true)
    })

    it('負のトークン数でエラーになる', () => {
      const record = {
        date: '2024-01-15',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: -1,
        output_tokens: 50,
        total_tokens: 150,
      }

      const result = difyUsageRecordSchema.safeParse(record)
      expect(result.success).toBe(false)
    })

    it('小数のトークン数でエラーになる', () => {
      const record = {
        date: '2024-01-15',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100.5,
        output_tokens: 50,
        total_tokens: 150,
      }

      const result = difyUsageRecordSchema.safeParse(record)
      expect(result.success).toBe(false)
    })

    it('文字列のトークン数でエラーになる', () => {
      const record = {
        date: '2024-01-15',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: '100',
        output_tokens: 50,
        total_tokens: 150,
      }

      const result = difyUsageRecordSchema.safeParse(record)
      expect(result.success).toBe(false)
    })
  })

  describe('文字列フィールドのバリデーション', () => {
    it('空文字のapp_idでエラーになる', () => {
      const record = {
        date: '2024-01-15',
        app_id: '',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
      }

      const result = difyUsageRecordSchema.safeParse(record)
      expect(result.success).toBe(false)
    })

    it('空文字のproviderでエラーになる', () => {
      const record = {
        date: '2024-01-15',
        app_id: 'app-123',
        provider: '',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
      }

      const result = difyUsageRecordSchema.safeParse(record)
      expect(result.success).toBe(false)
    })

    it('空文字のmodelでエラーになる', () => {
      const record = {
        date: '2024-01-15',
        app_id: 'app-123',
        provider: 'openai',
        model: '',
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
      }

      const result = difyUsageRecordSchema.safeParse(record)
      expect(result.success).toBe(false)
    })
  })
})

describe('difyUsageResponseSchema', () => {
  describe('全体バリデーション', () => {
    it('正常なレスポンスデータのバリデーションに成功する', () => {
      const validResponse: DifyUsageResponse = {
        data: [
          {
            date: '2024-01-15',
            app_id: 'app-123',
            provider: 'openai',
            model: 'gpt-4',
            input_tokens: 100,
            output_tokens: 50,
            total_tokens: 150,
          },
          {
            date: '2024-01-16',
            app_id: 'app-456',
            app_name: 'Another App',
            provider: 'anthropic',
            model: 'claude-3',
            input_tokens: 200,
            output_tokens: 100,
            total_tokens: 300,
            user_id: 'user-789',
          },
        ],
        total: 100,
        page: 1,
        limit: 10,
        has_more: true,
      }

      const result = difyUsageResponseSchema.safeParse(validResponse)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.data).toHaveLength(2)
        expect(result.data.total).toBe(100)
        expect(result.data.has_more).toBe(true)
      }
    })

    it('空の配列でもバリデーションに成功する', () => {
      const emptyResponse = {
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        has_more: false,
      }

      const result = difyUsageResponseSchema.safeParse(emptyResponse)
      expect(result.success).toBe(true)
    })

    it('pageが0の場合エラーになる', () => {
      const invalidResponse = {
        data: [],
        total: 0,
        page: 0,
        limit: 10,
        has_more: false,
      }

      const result = difyUsageResponseSchema.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })

    it('limitが0の場合エラーになる', () => {
      const invalidResponse = {
        data: [],
        total: 0,
        page: 1,
        limit: 0,
        has_more: false,
      }

      const result = difyUsageResponseSchema.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })

    it('totalが負の場合エラーになる', () => {
      const invalidResponse = {
        data: [],
        total: -1,
        page: 1,
        limit: 10,
        has_more: false,
      }

      const result = difyUsageResponseSchema.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })

    it('has_moreが真偽値でない場合エラーになる', () => {
      const invalidResponse = {
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        has_more: 'true',
      }

      const result = difyUsageResponseSchema.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })

    it('dataが配列でない場合エラーになる', () => {
      const invalidResponse = {
        data: 'not an array',
        total: 0,
        page: 1,
        limit: 10,
        has_more: false,
      }

      const result = difyUsageResponseSchema.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })

    it('不正なレコードを含む場合エラーになる', () => {
      const invalidResponse = {
        data: [
          {
            date: '2024-01-15',
            // app_idが欠落
            provider: 'openai',
            model: 'gpt-4',
            input_tokens: 100,
            output_tokens: 50,
            total_tokens: 150,
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        has_more: false,
      }

      const result = difyUsageResponseSchema.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })
  })
})

describe('型エクスポートの確認', () => {
  it('DifyUsageRecord型が正しくエクスポートされている', () => {
    const record: DifyUsageRecord = {
      date: '2024-01-15',
      app_id: 'app-123',
      provider: 'openai',
      model: 'gpt-4',
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
    }

    expect(record.date).toBe('2024-01-15')
    expect(record.app_id).toBe('app-123')
  })

  it('DifyUsageResponse型が正しくエクスポートされている', () => {
    const response: DifyUsageResponse = {
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      has_more: false,
    }

    expect(response.data).toEqual([])
    expect(response.has_more).toBe(false)
  })
})
