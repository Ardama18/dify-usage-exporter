import { describe, expect, it } from 'vitest'
import { type Watermark, watermarkSchema } from '../../../src/types/watermark.js'

describe('watermarkSchema', () => {
  describe('正常系', () => {
    it('正常なWatermarkデータのバリデーションに成功する', () => {
      const validWatermark = {
        last_fetched_date: '2024-01-15T10:30:00.000Z',
        last_updated_at: '2024-01-15T10:30:00.000Z',
      }

      const result = watermarkSchema.safeParse(validWatermark)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.last_fetched_date).toBe('2024-01-15T10:30:00.000Z')
        expect(result.data.last_updated_at).toBe('2024-01-15T10:30:00.000Z')
      }
    })

    it('異なる日時でもバリデーションに成功する', () => {
      const watermark = {
        last_fetched_date: '2024-01-10T00:00:00.000Z',
        last_updated_at: '2024-01-15T23:59:59.999Z',
      }

      const result = watermarkSchema.safeParse(watermark)
      expect(result.success).toBe(true)
    })

    it('タイムゾーンオフセット付きISO8601はデフォルトでエラーになる', () => {
      // zodのdatetime()はデフォルトでUTC形式（末尾Z）のみ許可
      // 実運用ではnew Date().toISOString()を使用するためUTC形式で十分
      const watermark = {
        last_fetched_date: '2024-01-15T10:30:00+09:00',
        last_updated_at: '2024-01-15T01:30:00-05:00',
      }

      const result = watermarkSchema.safeParse(watermark)
      expect(result.success).toBe(false)
    })
  })

  describe('ISO8601日時形式の検証', () => {
    it('Zで終わるUTC形式でバリデーションに成功する', () => {
      const watermark = {
        last_fetched_date: '2024-12-31T23:59:59Z',
        last_updated_at: '2025-01-01T00:00:00Z',
      }

      const result = watermarkSchema.safeParse(watermark)
      expect(result.success).toBe(true)
    })

    it('ミリ秒付きISO8601でバリデーションに成功する', () => {
      const watermark = {
        last_fetched_date: '2024-01-15T10:30:00.123Z',
        last_updated_at: '2024-01-15T10:30:00.456Z',
      }

      const result = watermarkSchema.safeParse(watermark)
      expect(result.success).toBe(true)
    })

    it('日付のみの形式でエラーになる', () => {
      const invalidWatermark = {
        last_fetched_date: '2024-01-15',
        last_updated_at: '2024-01-15T10:30:00.000Z',
      }

      const result = watermarkSchema.safeParse(invalidWatermark)
      expect(result.success).toBe(false)
    })

    it('時刻のみの形式でエラーになる', () => {
      const invalidWatermark = {
        last_fetched_date: '10:30:00',
        last_updated_at: '2024-01-15T10:30:00.000Z',
      }

      const result = watermarkSchema.safeParse(invalidWatermark)
      expect(result.success).toBe(false)
    })

    it('不正な日時形式でエラーになる', () => {
      const invalidWatermark = {
        last_fetched_date: '2024/01/15 10:30:00',
        last_updated_at: '2024-01-15T10:30:00.000Z',
      }

      const result = watermarkSchema.safeParse(invalidWatermark)
      expect(result.success).toBe(false)
    })

    it('文字列でない値でエラーになる', () => {
      const invalidWatermark = {
        last_fetched_date: new Date('2024-01-15T10:30:00.000Z'),
        last_updated_at: '2024-01-15T10:30:00.000Z',
      }

      const result = watermarkSchema.safeParse(invalidWatermark)
      expect(result.success).toBe(false)
    })

    it('タイムスタンプ（数値）でエラーになる', () => {
      const invalidWatermark = {
        last_fetched_date: 1705315800000,
        last_updated_at: '2024-01-15T10:30:00.000Z',
      }

      const result = watermarkSchema.safeParse(invalidWatermark)
      expect(result.success).toBe(false)
    })
  })

  describe('必須フィールドの検証', () => {
    it('last_fetched_dateが欠落している場合エラーになる', () => {
      const invalidWatermark = {
        last_updated_at: '2024-01-15T10:30:00.000Z',
      }

      const result = watermarkSchema.safeParse(invalidWatermark)
      expect(result.success).toBe(false)
    })

    it('last_updated_atが欠落している場合エラーになる', () => {
      const invalidWatermark = {
        last_fetched_date: '2024-01-15T10:30:00.000Z',
      }

      const result = watermarkSchema.safeParse(invalidWatermark)
      expect(result.success).toBe(false)
    })

    it('空オブジェクトでエラーになる', () => {
      const result = watermarkSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('nullでエラーになる', () => {
      const result = watermarkSchema.safeParse(null)
      expect(result.success).toBe(false)
    })

    it('undefinedでエラーになる', () => {
      const result = watermarkSchema.safeParse(undefined)
      expect(result.success).toBe(false)
    })
  })
})

describe('型エクスポートの確認', () => {
  it('Watermark型が正しくエクスポートされている', () => {
    const watermark: Watermark = {
      last_fetched_date: '2024-01-15T10:30:00.000Z',
      last_updated_at: '2024-01-15T10:30:00.000Z',
    }

    expect(watermark.last_fetched_date).toBe('2024-01-15T10:30:00.000Z')
    expect(watermark.last_updated_at).toBe('2024-01-15T10:30:00.000Z')
  })
})
