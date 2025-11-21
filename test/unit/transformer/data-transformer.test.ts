import { describe, expect, it } from 'vitest'
import { normalizeModel, normalizeProvider } from '../../../src/transformer/data-transformer.js'

describe('normalizeProvider', () => {
  it('should convert uppercase to lowercase', () => {
    expect(normalizeProvider('OpenAI')).toBe('openai')
    expect(normalizeProvider('ANTHROPIC')).toBe('anthropic')
  })

  it('should trim leading and trailing whitespace', () => {
    expect(normalizeProvider('  openai  ')).toBe('openai')
    expect(normalizeProvider('\topenai\t')).toBe('openai')
  })

  it('should handle special characters (tab, newline)', () => {
    expect(normalizeProvider('\n openai \n')).toBe('openai')
    expect(normalizeProvider(' OpenAI \t')).toBe('openai')
  })

  it('should handle already normalized input', () => {
    expect(normalizeProvider('openai')).toBe('openai')
  })
})

describe('normalizeModel', () => {
  it('should convert uppercase to lowercase', () => {
    expect(normalizeModel('GPT-4')).toBe('gpt-4')
    expect(normalizeModel('Claude-3-OPUS')).toBe('claude-3-opus')
  })

  it('should trim leading and trailing whitespace', () => {
    expect(normalizeModel('  gpt-4  ')).toBe('gpt-4')
    expect(normalizeModel('\tgpt-4\t')).toBe('gpt-4')
  })

  it('should handle special characters (tab, newline)', () => {
    expect(normalizeModel('\n gpt-4 \n')).toBe('gpt-4')
    expect(normalizeModel(' GPT-4 \t')).toBe('gpt-4')
  })

  it('should handle already normalized input', () => {
    expect(normalizeModel('gpt-4')).toBe('gpt-4')
  })

  it('should preserve hyphens and dots', () => {
    expect(normalizeModel('gpt-4-turbo')).toBe('gpt-4-turbo')
    expect(normalizeModel('claude-3.5-sonnet')).toBe('claude-3.5-sonnet')
  })
})
