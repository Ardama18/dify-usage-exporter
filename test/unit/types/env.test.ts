import { describe, expect, it } from 'vitest'
import { type EnvConfig, envSchema } from '../../../src/types/env.js'

describe('envSchema', () => {
  // 基本的な必須環境変数のテスト用ベースデータ
  const baseValidEnv = {
    DIFY_API_BASE_URL: 'https://api.dify.ai',
    DIFY_EMAIL: 'test@example.com',
    DIFY_PASSWORD: 'test-password',
    EXTERNAL_API_URL: 'https://external-api.example.com',
    EXTERNAL_API_TOKEN: 'external-token',
  }

  describe('既存環境変数の検証', () => {
    it('必須環境変数のみでバリデーションに成功する', () => {
      const result = envSchema.safeParse(baseValidEnv)
      expect(result.success).toBe(true)
    })

    it('オプション環境変数のデフォルト値が正しく設定される', () => {
      const result = envSchema.safeParse(baseValidEnv)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.CRON_SCHEDULE).toBe('0 0 * * *')
        expect(result.data.LOG_LEVEL).toBe('info')
        expect(result.data.GRACEFUL_SHUTDOWN_TIMEOUT).toBe(30)
        expect(result.data.MAX_RETRY).toBe(3)
        expect(result.data.NODE_ENV).toBe('production')
      }
    })
  })

  describe('Dify Fetcher関連環境変数の検証', () => {
    describe('DIFY_FETCH_PAGE_SIZE', () => {
      it('デフォルト値100が設定される', () => {
        const result = envSchema.safeParse(baseValidEnv)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.DIFY_FETCH_PAGE_SIZE).toBe(100)
        }
      })

      it('有効な値（1）でバリデーションに成功する', () => {
        const result = envSchema.safeParse({
          ...baseValidEnv,
          DIFY_FETCH_PAGE_SIZE: '1',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.DIFY_FETCH_PAGE_SIZE).toBe(1)
        }
      })

      it('有効な値（1000）でバリデーションに成功する', () => {
        const result = envSchema.safeParse({
          ...baseValidEnv,
          DIFY_FETCH_PAGE_SIZE: '1000',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.DIFY_FETCH_PAGE_SIZE).toBe(1000)
        }
      })

      it('最小値未満（0）でエラーになる', () => {
        const result = envSchema.safeParse({
          ...baseValidEnv,
          DIFY_FETCH_PAGE_SIZE: '0',
        })
        expect(result.success).toBe(false)
      })

      it('最大値超過（1001）でエラーになる', () => {
        const result = envSchema.safeParse({
          ...baseValidEnv,
          DIFY_FETCH_PAGE_SIZE: '1001',
        })
        expect(result.success).toBe(false)
      })
    })

    describe('DIFY_FETCH_DAYS', () => {
      it('デフォルト値30が設定される', () => {
        const result = envSchema.safeParse(baseValidEnv)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.DIFY_FETCH_DAYS).toBe(30)
        }
      })

      it('有効な値（1）でバリデーションに成功する', () => {
        const result = envSchema.safeParse({
          ...baseValidEnv,
          DIFY_FETCH_DAYS: '1',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.DIFY_FETCH_DAYS).toBe(1)
        }
      })

      it('有効な値（365）でバリデーションに成功する', () => {
        const result = envSchema.safeParse({
          ...baseValidEnv,
          DIFY_FETCH_DAYS: '365',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.DIFY_FETCH_DAYS).toBe(365)
        }
      })

      it('最小値未満（0）でエラーになる', () => {
        const result = envSchema.safeParse({
          ...baseValidEnv,
          DIFY_FETCH_DAYS: '0',
        })
        expect(result.success).toBe(false)
      })

      it('最大値超過（366）でエラーになる', () => {
        const result = envSchema.safeParse({
          ...baseValidEnv,
          DIFY_FETCH_DAYS: '366',
        })
        expect(result.success).toBe(false)
      })
    })

    describe('DIFY_FETCH_TIMEOUT_MS', () => {
      it('デフォルト値30000が設定される', () => {
        const result = envSchema.safeParse(baseValidEnv)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.DIFY_FETCH_TIMEOUT_MS).toBe(30000)
        }
      })

      it('有効な値（1000）でバリデーションに成功する', () => {
        const result = envSchema.safeParse({
          ...baseValidEnv,
          DIFY_FETCH_TIMEOUT_MS: '1000',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.DIFY_FETCH_TIMEOUT_MS).toBe(1000)
        }
      })

      it('有効な値（120000）でバリデーションに成功する', () => {
        const result = envSchema.safeParse({
          ...baseValidEnv,
          DIFY_FETCH_TIMEOUT_MS: '120000',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.DIFY_FETCH_TIMEOUT_MS).toBe(120000)
        }
      })

      it('最小値未満（999）でエラーになる', () => {
        const result = envSchema.safeParse({
          ...baseValidEnv,
          DIFY_FETCH_TIMEOUT_MS: '999',
        })
        expect(result.success).toBe(false)
      })

      it('最大値超過（120001）でエラーになる', () => {
        const result = envSchema.safeParse({
          ...baseValidEnv,
          DIFY_FETCH_TIMEOUT_MS: '120001',
        })
        expect(result.success).toBe(false)
      })
    })

    describe('DIFY_FETCH_RETRY_COUNT', () => {
      it('デフォルト値3が設定される', () => {
        const result = envSchema.safeParse(baseValidEnv)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.DIFY_FETCH_RETRY_COUNT).toBe(3)
        }
      })

      it('有効な値（1）でバリデーションに成功する', () => {
        const result = envSchema.safeParse({
          ...baseValidEnv,
          DIFY_FETCH_RETRY_COUNT: '1',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.DIFY_FETCH_RETRY_COUNT).toBe(1)
        }
      })

      it('有効な値（10）でバリデーションに成功する', () => {
        const result = envSchema.safeParse({
          ...baseValidEnv,
          DIFY_FETCH_RETRY_COUNT: '10',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.DIFY_FETCH_RETRY_COUNT).toBe(10)
        }
      })

      it('最小値未満（0）でエラーになる', () => {
        const result = envSchema.safeParse({
          ...baseValidEnv,
          DIFY_FETCH_RETRY_COUNT: '0',
        })
        expect(result.success).toBe(false)
      })

      it('最大値超過（11）でエラーになる', () => {
        const result = envSchema.safeParse({
          ...baseValidEnv,
          DIFY_FETCH_RETRY_COUNT: '11',
        })
        expect(result.success).toBe(false)
      })
    })

    describe('DIFY_FETCH_RETRY_DELAY_MS', () => {
      it('デフォルト値1000が設定される', () => {
        const result = envSchema.safeParse(baseValidEnv)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.DIFY_FETCH_RETRY_DELAY_MS).toBe(1000)
        }
      })

      it('有効な値（100）でバリデーションに成功する', () => {
        const result = envSchema.safeParse({
          ...baseValidEnv,
          DIFY_FETCH_RETRY_DELAY_MS: '100',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.DIFY_FETCH_RETRY_DELAY_MS).toBe(100)
        }
      })

      it('有効な値（10000）でバリデーションに成功する', () => {
        const result = envSchema.safeParse({
          ...baseValidEnv,
          DIFY_FETCH_RETRY_DELAY_MS: '10000',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.DIFY_FETCH_RETRY_DELAY_MS).toBe(10000)
        }
      })

      it('最小値未満（99）でエラーになる', () => {
        const result = envSchema.safeParse({
          ...baseValidEnv,
          DIFY_FETCH_RETRY_DELAY_MS: '99',
        })
        expect(result.success).toBe(false)
      })

      it('最大値超過（10001）でエラーになる', () => {
        const result = envSchema.safeParse({
          ...baseValidEnv,
          DIFY_FETCH_RETRY_DELAY_MS: '10001',
        })
        expect(result.success).toBe(false)
      })
    })

    describe('WATERMARK_FILE_PATH', () => {
      it("デフォルト値'data/watermark.json'が設定される", () => {
        const result = envSchema.safeParse(baseValidEnv)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.WATERMARK_FILE_PATH).toBe('data/watermark.json')
        }
      })

      it('カスタムパスでバリデーションに成功する', () => {
        const result = envSchema.safeParse({
          ...baseValidEnv,
          WATERMARK_FILE_PATH: '/custom/path/watermark.json',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.WATERMARK_FILE_PATH).toBe('/custom/path/watermark.json')
        }
      })

      it('相対パスでバリデーションに成功する', () => {
        const result = envSchema.safeParse({
          ...baseValidEnv,
          WATERMARK_FILE_PATH: './tmp/watermark.json',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.WATERMARK_FILE_PATH).toBe('./tmp/watermark.json')
        }
      })
    })
  })

  describe('全環境変数の組み合わせテスト', () => {
    it('すべてのDify Fetcher環境変数をカスタム値で設定できる', () => {
      const customEnv = {
        ...baseValidEnv,
        DIFY_FETCH_PAGE_SIZE: '500',
        DIFY_FETCH_DAYS: '60',
        DIFY_FETCH_TIMEOUT_MS: '60000',
        DIFY_FETCH_RETRY_COUNT: '5',
        DIFY_FETCH_RETRY_DELAY_MS: '2000',
        WATERMARK_FILE_PATH: '/var/data/watermark.json',
      }

      const result = envSchema.safeParse(customEnv)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.DIFY_FETCH_PAGE_SIZE).toBe(500)
        expect(result.data.DIFY_FETCH_DAYS).toBe(60)
        expect(result.data.DIFY_FETCH_TIMEOUT_MS).toBe(60000)
        expect(result.data.DIFY_FETCH_RETRY_COUNT).toBe(5)
        expect(result.data.DIFY_FETCH_RETRY_DELAY_MS).toBe(2000)
        expect(result.data.WATERMARK_FILE_PATH).toBe('/var/data/watermark.json')
      }
    })
  })

  describe('数値の型変換', () => {
    it('文字列から数値への変換が正しく行われる', () => {
      const result = envSchema.safeParse({
        ...baseValidEnv,
        DIFY_FETCH_PAGE_SIZE: '100',
        DIFY_FETCH_DAYS: '30',
        DIFY_FETCH_TIMEOUT_MS: '30000',
        DIFY_FETCH_RETRY_COUNT: '3',
        DIFY_FETCH_RETRY_DELAY_MS: '1000',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(typeof result.data.DIFY_FETCH_PAGE_SIZE).toBe('number')
        expect(typeof result.data.DIFY_FETCH_DAYS).toBe('number')
        expect(typeof result.data.DIFY_FETCH_TIMEOUT_MS).toBe('number')
        expect(typeof result.data.DIFY_FETCH_RETRY_COUNT).toBe('number')
        expect(typeof result.data.DIFY_FETCH_RETRY_DELAY_MS).toBe('number')
      }
    })
  })
})

describe('型エクスポートの確認', () => {
  it('EnvConfig型にDify Fetcher関連のフィールドが含まれている', () => {
    const config: EnvConfig = {
      DIFY_API_BASE_URL: 'https://api.dify.ai',
      DIFY_EMAIL: 'test@example.com',
      DIFY_PASSWORD: 'test-password',
      EXTERNAL_API_URL: 'https://external-api.example.com',
      EXTERNAL_API_TOKEN: 'external-token',
      CRON_SCHEDULE: '0 0 * * *',
      LOG_LEVEL: 'info',
      GRACEFUL_SHUTDOWN_TIMEOUT: 30,
      MAX_RETRY: 3,
      NODE_ENV: 'production',
      DIFY_FETCH_PAGE_SIZE: 100,
      DIFY_FETCH_DAYS: 30,
      DIFY_FETCH_TIMEOUT_MS: 30000,
      DIFY_FETCH_RETRY_COUNT: 3,
      DIFY_FETCH_RETRY_DELAY_MS: 1000,
      WATERMARK_FILE_PATH: 'data/watermark.json',
      WATERMARK_ENABLED: true,
    }

    expect(config.DIFY_FETCH_PAGE_SIZE).toBe(100)
    expect(config.DIFY_FETCH_DAYS).toBe(30)
    expect(config.DIFY_FETCH_TIMEOUT_MS).toBe(30000)
    expect(config.DIFY_FETCH_RETRY_COUNT).toBe(3)
    expect(config.DIFY_FETCH_RETRY_DELAY_MS).toBe(1000)
    expect(config.WATERMARK_FILE_PATH).toBe('data/watermark.json')
  })
})
