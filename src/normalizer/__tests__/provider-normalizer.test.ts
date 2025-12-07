import { describe, expect, it } from 'vitest'
import { createProviderNormalizer } from '../provider-normalizer.js'

describe('ProviderNormalizer', () => {
  describe('クレンジング処理', () => {
    it('小文字化: OpenAI → openai', () => {
      const normalizer = createProviderNormalizer()
      expect(normalizer.normalize('OpenAI')).toBe('openai')
    })

    it('小文字化: ANTHROPIC → anthropic', () => {
      const normalizer = createProviderNormalizer()
      expect(normalizer.normalize('ANTHROPIC')).toBe('anthropic')
    })

    it('前後空白除去: " openai " → openai', () => {
      const normalizer = createProviderNormalizer()
      expect(normalizer.normalize(' openai ')).toBe('openai')
    })

    it('そのまま返す: openai → openai', () => {
      const normalizer = createProviderNormalizer()
      expect(normalizer.normalize('openai')).toBe('openai')
    })

    it('そのまま返す: anthropic → anthropic', () => {
      const normalizer = createProviderNormalizer()
      expect(normalizer.normalize('anthropic')).toBe('anthropic')
    })
  })

  describe('空文字・不正値の処理', () => {
    it('空文字: "" → unknown', () => {
      const normalizer = createProviderNormalizer()
      expect(normalizer.normalize('')).toBe('unknown')
    })

    it('空白のみ: "   " → unknown', () => {
      const normalizer = createProviderNormalizer()
      expect(normalizer.normalize('   ')).toBe('unknown')
    })
  })

  describe('Difyデータの忠実な転送', () => {
    it('aws-bedrockもそのまま: aws-bedrock → aws-bedrock', () => {
      const normalizer = createProviderNormalizer()
      expect(normalizer.normalize('aws-bedrock')).toBe('aws-bedrock')
    })

    it('claudeもそのまま: claude → claude', () => {
      const normalizer = createProviderNormalizer()
      expect(normalizer.normalize('claude')).toBe('claude')
    })

    it('geminiもそのまま: gemini → gemini', () => {
      const normalizer = createProviderNormalizer()
      expect(normalizer.normalize('gemini')).toBe('gemini')
    })

    it('grokもそのまま: grok → grok', () => {
      const normalizer = createProviderNormalizer()
      expect(normalizer.normalize('grok')).toBe('grok')
    })

    it('x-aiもそのまま: x-ai → x-ai', () => {
      const normalizer = createProviderNormalizer()
      expect(normalizer.normalize('x-ai')).toBe('x-ai')
    })

    it('未知のプロバイダーもそのまま: custom-provider → custom-provider', () => {
      const normalizer = createProviderNormalizer()
      expect(normalizer.normalize('custom-provider')).toBe('custom-provider')
    })
  })
})
