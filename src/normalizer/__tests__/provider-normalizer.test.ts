import { describe, expect, it } from 'vitest'
import { createProviderNormalizer } from '../provider-normalizer.js'

describe('ProviderNormalizer', () => {
  it('正規化: aws-bedrock → aws', () => {
    const normalizer = createProviderNormalizer()
    expect(normalizer.normalize('aws-bedrock')).toBe('aws')
  })

  it('大文字小文字統一: AWS-BEDROCK → aws', () => {
    const normalizer = createProviderNormalizer()
    expect(normalizer.normalize('AWS-BEDROCK')).toBe('aws')
  })

  it('前後空白除去: " aws-bedrock " → aws', () => {
    const normalizer = createProviderNormalizer()
    expect(normalizer.normalize(' aws-bedrock ')).toBe('aws')
  })

  it('不明なプロバイダー: unknown-provider → unknown', () => {
    const normalizer = createProviderNormalizer()
    expect(normalizer.normalize('unknown-provider')).toBe('unknown')
  })

  it('OpenAI: openai → openai', () => {
    const normalizer = createProviderNormalizer()
    expect(normalizer.normalize('openai')).toBe('openai')
  })

  it('Anthropic: anthropic → anthropic', () => {
    const normalizer = createProviderNormalizer()
    expect(normalizer.normalize('anthropic')).toBe('anthropic')
  })

  it('Google: google → google', () => {
    const normalizer = createProviderNormalizer()
    expect(normalizer.normalize('google')).toBe('google')
  })

  it('XAI統一: x-ai → xai', () => {
    const normalizer = createProviderNormalizer()
    expect(normalizer.normalize('x-ai')).toBe('xai')
  })

  it('XAI統一: xai → xai', () => {
    const normalizer = createProviderNormalizer()
    expect(normalizer.normalize('xai')).toBe('xai')
  })

  it('空文字: "" → unknown', () => {
    const normalizer = createProviderNormalizer()
    expect(normalizer.normalize('')).toBe('unknown')
  })

  it('空白のみ: "   " → unknown', () => {
    const normalizer = createProviderNormalizer()
    expect(normalizer.normalize('   ')).toBe('unknown')
  })
})
