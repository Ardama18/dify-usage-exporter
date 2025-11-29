import { describe, expect, it } from 'vitest'
import {
  type DifyAppTokenCost,
  type DifyAppTokenCostsResponse,
  difyAppTokenCostSchema,
  difyAppTokenCostsResponseSchema,
} from '../../../src/types/dify-usage.js'

describe('difyAppTokenCostSchema', () => {
  describe('正常系', () => {
    it('正常なデータのバリデーションに成功する', () => {
      const validRecord = {
        date: '2024-01-15',
        token_count: 100,
        total_price: '0.001',
        currency: 'USD',
      }

      const result = difyAppTokenCostSchema.safeParse(validRecord)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validRecord)
      }
    })

    it('currencyがなくてもデフォルト値USDでバリデーションに成功する', () => {
      const minimalRecord = {
        date: '2024-01-15',
        token_count: 200,
        total_price: '0.002',
      }

      const result = difyAppTokenCostSchema.safeParse(minimalRecord)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.currency).toBe('USD')
      }
    })

    it('token_countが0でもバリデーションに成功する', () => {
      const zeroTokenRecord = {
        date: '2024-01-15',
        token_count: 0,
        total_price: '0.000',
        currency: 'USD',
      }

      const result = difyAppTokenCostSchema.safeParse(zeroTokenRecord)
      expect(result.success).toBe(true)
    })
  })

  describe('必須フィールド欠落時のエラー検出', () => {
    it('dateが欠落している場合エラーになる', () => {
      const invalidRecord = {
        token_count: 100,
        total_price: '0.001',
        currency: 'USD',
      }

      const result = difyAppTokenCostSchema.safeParse(invalidRecord)
      expect(result.success).toBe(false)
    })

    it('token_countが欠落している場合エラーになる', () => {
      const invalidRecord = {
        date: '2024-01-15',
        total_price: '0.001',
        currency: 'USD',
      }

      const result = difyAppTokenCostSchema.safeParse(invalidRecord)
      expect(result.success).toBe(false)
    })

    it('total_priceが欠落している場合エラーになる', () => {
      const invalidRecord = {
        date: '2024-01-15',
        token_count: 100,
        currency: 'USD',
      }

      const result = difyAppTokenCostSchema.safeParse(invalidRecord)
      expect(result.success).toBe(false)
    })
  })

  describe('日付形式（YYYY-MM-DD）のバリデーション', () => {
    it('正しい日付形式でバリデーションに成功する', () => {
      const record = {
        date: '2024-12-31',
        token_count: 100,
        total_price: '0.001',
        currency: 'USD',
      }

      const result = difyAppTokenCostSchema.safeParse(record)
      expect(result.success).toBe(true)
    })

    it('不正な日付形式（スラッシュ区切り）でエラーになる', () => {
      const record = {
        date: '2024/01/15',
        token_count: 100,
        total_price: '0.001',
        currency: 'USD',
      }

      const result = difyAppTokenCostSchema.safeParse(record)
      expect(result.success).toBe(false)
    })

    it('不正な日付形式（日-月-年）でエラーになる', () => {
      const record = {
        date: '15-01-2024',
        token_count: 100,
        total_price: '0.001',
        currency: 'USD',
      }

      const result = difyAppTokenCostSchema.safeParse(record)
      expect(result.success).toBe(false)
    })

    it('不正な日付形式（ISO 8601）でエラーになる', () => {
      const record = {
        date: '2024-01-15T10:30:00Z',
        token_count: 100,
        total_price: '0.001',
        currency: 'USD',
      }

      const result = difyAppTokenCostSchema.safeParse(record)
      expect(result.success).toBe(false)
    })
  })

  describe('token_countの範囲チェック（0以上の整数）', () => {
    it('大きなtoken_countでもバリデーションに成功する', () => {
      const record = {
        date: '2024-01-15',
        token_count: 1000000,
        total_price: '100.00',
        currency: 'USD',
      }

      const result = difyAppTokenCostSchema.safeParse(record)
      expect(result.success).toBe(true)
    })

    it('負のtoken_countでエラーになる', () => {
      const record = {
        date: '2024-01-15',
        token_count: -1,
        total_price: '0.001',
        currency: 'USD',
      }

      const result = difyAppTokenCostSchema.safeParse(record)
      expect(result.success).toBe(false)
    })

    it('小数のtoken_countでエラーになる', () => {
      const record = {
        date: '2024-01-15',
        token_count: 100.5,
        total_price: '0.001',
        currency: 'USD',
      }

      const result = difyAppTokenCostSchema.safeParse(record)
      expect(result.success).toBe(false)
    })

    it('文字列のtoken_countでエラーになる', () => {
      const record = {
        date: '2024-01-15',
        token_count: '100',
        total_price: '0.001',
        currency: 'USD',
      }

      const result = difyAppTokenCostSchema.safeParse(record)
      expect(result.success).toBe(false)
    })
  })
})

describe('difyAppTokenCostsResponseSchema', () => {
  describe('全体バリデーション', () => {
    it('正常なレスポンスデータのバリデーションに成功する', () => {
      const validResponse: DifyAppTokenCostsResponse = {
        data: [
          {
            date: '2024-01-15',
            token_count: 100,
            total_price: '0.001',
            currency: 'USD',
          },
          {
            date: '2024-01-16',
            token_count: 200,
            total_price: '0.002',
            currency: 'USD',
          },
        ],
      }

      const result = difyAppTokenCostsResponseSchema.safeParse(validResponse)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.data).toHaveLength(2)
      }
    })

    it('空の配列でもバリデーションに成功する', () => {
      const emptyResponse = {
        data: [],
      }

      const result = difyAppTokenCostsResponseSchema.safeParse(emptyResponse)
      expect(result.success).toBe(true)
    })

    it('dataが配列でない場合エラーになる', () => {
      const invalidResponse = {
        data: 'not an array',
      }

      const result = difyAppTokenCostsResponseSchema.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })

    it('不正なレコードを含む場合エラーになる', () => {
      const invalidResponse = {
        data: [
          {
            date: '2024-01-15',
            // token_countが欠落
            total_price: '0.001',
            currency: 'USD',
          },
        ],
      }

      const result = difyAppTokenCostsResponseSchema.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })
  })
})

describe('型エクスポートの確認', () => {
  it('DifyAppTokenCost型が正しくエクスポートされている', () => {
    const record: DifyAppTokenCost = {
      date: '2024-01-15',
      token_count: 100,
      total_price: '0.001',
      currency: 'USD',
    }

    expect(record.date).toBe('2024-01-15')
    expect(record.token_count).toBe(100)
  })

  it('DifyAppTokenCostsResponse型が正しくエクスポートされている', () => {
    const response: DifyAppTokenCostsResponse = {
      data: [],
    }

    expect(response.data).toEqual([])
  })
})
