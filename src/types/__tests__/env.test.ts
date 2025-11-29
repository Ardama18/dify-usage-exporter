/**
 * 環境変数スキーマのテスト
 *
 * ヘルスチェック関連の環境変数の検証
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { envSchema } from '../env.js'

describe('envSchema - Healthcheck Extensions', () => {
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

  describe('HEALTHCHECK_PORT', () => {
    it('should use default value 8080', () => {
      const result = envSchema.parse(process.env)
      expect(result.HEALTHCHECK_PORT).toBe(8080)
    })

    it('should use custom value when provided', () => {
      process.env.HEALTHCHECK_PORT = '9090'

      const result = envSchema.parse(process.env)
      expect(result.HEALTHCHECK_PORT).toBe(9090)
    })

    it('should coerce string to number', () => {
      process.env.HEALTHCHECK_PORT = '3000'

      const result = envSchema.parse(process.env)
      expect(result.HEALTHCHECK_PORT).toBe(3000)
      expect(typeof result.HEALTHCHECK_PORT).toBe('number')
    })

    it('should reject non-numeric value', () => {
      process.env.HEALTHCHECK_PORT = 'invalid'

      expect(() => envSchema.parse(process.env)).toThrow()
    })
  })

  describe('HEALTHCHECK_ENABLED', () => {
    it('should use default value true', () => {
      const result = envSchema.parse(process.env)
      expect(result.HEALTHCHECK_ENABLED).toBe(true)
    })

    it('should accept false value', () => {
      process.env.HEALTHCHECK_ENABLED = 'false'

      const result = envSchema.parse(process.env)
      expect(result.HEALTHCHECK_ENABLED).toBe(false)
    })

    it('should accept true value', () => {
      process.env.HEALTHCHECK_ENABLED = 'true'

      const result = envSchema.parse(process.env)
      expect(result.HEALTHCHECK_ENABLED).toBe(true)
    })

    it('should coerce string to boolean', () => {
      process.env.HEALTHCHECK_ENABLED = 'false'

      const result = envSchema.parse(process.env)
      expect(result.HEALTHCHECK_ENABLED).toBe(false)
      expect(typeof result.HEALTHCHECK_ENABLED).toBe('boolean')
    })
  })
})
