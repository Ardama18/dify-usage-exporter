import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadConfig } from '../env-config.js'

describe('loadConfig - Story 4 Extensions', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // 既存必須環境変数を設定
    process.env = {
      ...originalEnv,
      DIFY_API_BASE_URL: 'https://api.dify.ai',
      DIFY_EMAIL: 'test@example.com',
      DIFY_PASSWORD: 'test-password',
      EXTERNAL_API_URL: 'https://api.example.com',
      EXTERNAL_API_TOKEN: 'test-token',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('HTTPS必須チェック', () => {
    it('should reject EXTERNAL_API_URL starting with http://', () => {
      process.env.EXTERNAL_API_URL = 'http://api.example.com'

      expect(() => loadConfig()).toThrow()
    })

    it('should accept EXTERNAL_API_URL starting with https://', () => {
      process.env.EXTERNAL_API_URL = 'https://api.example.com'

      const config = loadConfig()
      expect(config.EXTERNAL_API_URL).toBe('https://api.example.com')
    })
  })

  describe('デフォルト値', () => {
    it('should use default value for EXTERNAL_API_TIMEOUT_MS', () => {
      const config = loadConfig()
      expect(config.EXTERNAL_API_TIMEOUT_MS).toBe(30000)
    })

    it('should use default value for MAX_RETRIES', () => {
      const config = loadConfig()
      expect(config.MAX_RETRIES).toBe(3)
    })

    it('should use default value for MAX_SPOOL_RETRIES', () => {
      const config = loadConfig()
      expect(config.MAX_SPOOL_RETRIES).toBe(10)
    })

    it('should use default value for BATCH_SIZE', () => {
      const config = loadConfig()
      expect(config.BATCH_SIZE).toBe(100)
    })
  })

  describe('カスタム値', () => {
    it('should use custom value for EXTERNAL_API_TIMEOUT_MS', () => {
      process.env.EXTERNAL_API_TIMEOUT_MS = '60000'

      const config = loadConfig()
      expect(config.EXTERNAL_API_TIMEOUT_MS).toBe(60000)
    })

    it('should use custom value for MAX_RETRIES', () => {
      process.env.MAX_RETRIES = '5'

      const config = loadConfig()
      expect(config.MAX_RETRIES).toBe(5)
    })

    it('should use custom value for MAX_SPOOL_RETRIES', () => {
      process.env.MAX_SPOOL_RETRIES = '20'

      const config = loadConfig()
      expect(config.MAX_SPOOL_RETRIES).toBe(20)
    })

    it('should use custom value for BATCH_SIZE', () => {
      process.env.BATCH_SIZE = '200'

      const config = loadConfig()
      expect(config.BATCH_SIZE).toBe(200)
    })
  })

  describe('バリデーション', () => {
    it('should reject negative EXTERNAL_API_TIMEOUT_MS', () => {
      process.env.EXTERNAL_API_TIMEOUT_MS = '-1000'

      expect(() => loadConfig()).toThrow()
    })

    it('should reject negative MAX_RETRIES', () => {
      process.env.MAX_RETRIES = '-1'

      expect(() => loadConfig()).toThrow()
    })

    it('should reject negative MAX_SPOOL_RETRIES', () => {
      process.env.MAX_SPOOL_RETRIES = '-1'

      expect(() => loadConfig()).toThrow()
    })

    it('should reject negative BATCH_SIZE', () => {
      process.env.BATCH_SIZE = '-1'

      expect(() => loadConfig()).toThrow()
    })
  })
})
