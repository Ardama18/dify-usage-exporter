import { describe, expect, it } from 'vitest'
import { createModelNormalizer } from '../model-normalizer.js'

describe('ModelNormalizer', () => {
  it('正規化: claude-3-5-sonnet → claude-3-5-sonnet-20241022', () => {
    const normalizer = createModelNormalizer()
    expect(normalizer.normalize('claude-3-5-sonnet')).toBe('claude-3-5-sonnet-20241022')
  })

  it('不明なモデル: unknown-model → unknown-model（そのまま）', () => {
    const normalizer = createModelNormalizer()
    expect(normalizer.normalize('unknown-model')).toBe('unknown-model')
  })

  it('大文字小文字統一: CLAUDE-3-5-SONNET → claude-3-5-sonnet-20241022', () => {
    const normalizer = createModelNormalizer()
    expect(normalizer.normalize('CLAUDE-3-5-SONNET')).toBe('claude-3-5-sonnet-20241022')
  })

  it('GPT-4: gpt-4 → gpt-4-0613', () => {
    const normalizer = createModelNormalizer()
    expect(normalizer.normalize('gpt-4')).toBe('gpt-4-0613')
  })

  it('GPT-4 Turbo: gpt-4-turbo → gpt-4-turbo-2024-04-09', () => {
    const normalizer = createModelNormalizer()
    expect(normalizer.normalize('gpt-4-turbo')).toBe('gpt-4-turbo-2024-04-09')
  })

  it('Gemini Pro: gemini-pro → gemini-1.0-pro', () => {
    const normalizer = createModelNormalizer()
    expect(normalizer.normalize('gemini-pro')).toBe('gemini-1.0-pro')
  })

  it('前後空白除去: " claude-3-5-sonnet " → claude-3-5-sonnet-20241022', () => {
    const normalizer = createModelNormalizer()
    expect(normalizer.normalize(' claude-3-5-sonnet ')).toBe('claude-3-5-sonnet-20241022')
  })

  it('空文字: "" → ""（そのまま）', () => {
    const normalizer = createModelNormalizer()
    expect(normalizer.normalize('')).toBe('')
  })

  it('空白のみ: "   " → ""（空文字）', () => {
    const normalizer = createModelNormalizer()
    expect(normalizer.normalize('   ')).toBe('')
  })
})
