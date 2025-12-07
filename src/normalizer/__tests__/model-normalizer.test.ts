import { describe, expect, it } from 'vitest'
import { createModelNormalizer } from '../model-normalizer.js'

describe('ModelNormalizer', () => {
  describe('クレンジング処理', () => {
    it('小文字化: GPT-4O → gpt-4o', () => {
      const normalizer = createModelNormalizer()
      expect(normalizer.normalize('GPT-4O')).toBe('gpt-4o')
    })

    it('小文字化: Claude-3-5-Sonnet → claude-3-5-sonnet', () => {
      const normalizer = createModelNormalizer()
      expect(normalizer.normalize('Claude-3-5-Sonnet')).toBe('claude-3-5-sonnet')
    })

    it('前後空白除去: " gpt-4o " → gpt-4o', () => {
      const normalizer = createModelNormalizer()
      expect(normalizer.normalize(' gpt-4o ')).toBe('gpt-4o')
    })

    it('そのまま返す: gpt-4o → gpt-4o', () => {
      const normalizer = createModelNormalizer()
      expect(normalizer.normalize('gpt-4o')).toBe('gpt-4o')
    })

    it('そのまま返す: claude-3-5-sonnet-20241022 → claude-3-5-sonnet-20241022', () => {
      const normalizer = createModelNormalizer()
      expect(normalizer.normalize('claude-3-5-sonnet-20241022')).toBe('claude-3-5-sonnet-20241022')
    })
  })

  describe('空文字・不正値の処理', () => {
    it('空文字: "" → unknown', () => {
      const normalizer = createModelNormalizer()
      expect(normalizer.normalize('')).toBe('unknown')
    })

    it('空白のみ: "   " → unknown', () => {
      const normalizer = createModelNormalizer()
      expect(normalizer.normalize('   ')).toBe('unknown')
    })
  })

  describe('Difyデータの忠実な転送', () => {
    it('aws-bedrockのモデル名もそのまま: claude-3-5-sonnet → claude-3-5-sonnet', () => {
      const normalizer = createModelNormalizer()
      expect(normalizer.normalize('claude-3-5-sonnet')).toBe('claude-3-5-sonnet')
    })

    it('ARN形式もそのまま: anthropic.claude-3-5-sonnet-20241022-v2:0', () => {
      const normalizer = createModelNormalizer()
      expect(normalizer.normalize('anthropic.claude-3-5-sonnet-20241022-v2:0')).toBe(
        'anthropic.claude-3-5-sonnet-20241022-v2:0',
      )
    })

    it('未知のモデル名もそのまま: custom-model-v1 → custom-model-v1', () => {
      const normalizer = createModelNormalizer()
      expect(normalizer.normalize('custom-model-v1')).toBe('custom-model-v1')
    })
  })
})
