/**
 * promptユーティリティ単体テスト
 * Design Doc: specs/stories/6-manual-resend-watermark/design.md
 * 生成日: 2025-11-22
 * テスト種別: Unit Test
 * ACトレーサビリティ: AC-WM-3, AC-WM-4, AC-WM-5
 */

import { Readable, Writable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { confirmPrompt } from '../../utils/prompt.js'

describe('confirmPrompt', () => {
  let originalStdin: typeof process.stdin
  let originalStdout: typeof process.stdout

  beforeEach(() => {
    originalStdin = process.stdin
    originalStdout = process.stdout
  })

  afterEach(() => {
    Object.defineProperty(process, 'stdin', { value: originalStdin })
    Object.defineProperty(process, 'stdout', { value: originalStdout })
  })

  /**
   * テスト用のstdinをモック
   */
  function mockStdin(input: string): void {
    const mockInput = new Readable({
      read() {
        this.push(input)
        this.push(null)
      },
    })
    Object.defineProperty(process, 'stdin', { value: mockInput })
  }

  /**
   * テスト用のstdoutをモック
   */
  function mockStdout(): Writable {
    const mockOutput = new Writable({
      write(_chunk, _encoding, callback) {
        callback()
      },
    })
    Object.defineProperty(process, 'stdout', { value: mockOutput })
    return mockOutput
  }

  // ======================
  // y/Y入力でtrue
  // ======================
  describe('y/Y入力でtrue', () => {
    it('小文字yの入力でtrueを返す', async () => {
      // Arrange
      mockStdin('y\n')
      mockStdout()

      // Act
      const result = await confirmPrompt('Continue?')

      // Assert
      expect(result).toBe(true)
    })

    it('大文字Yの入力でtrueを返す', async () => {
      // Arrange
      mockStdin('Y\n')
      mockStdout()

      // Act
      const result = await confirmPrompt('Continue?')

      // Assert
      expect(result).toBe(true)
    })
  })

  // ======================
  // n/N入力でfalse
  // ======================
  describe('n/N入力でfalse', () => {
    it('小文字nの入力でfalseを返す', async () => {
      // Arrange
      mockStdin('n\n')
      mockStdout()

      // Act
      const result = await confirmPrompt('Continue?')

      // Assert
      expect(result).toBe(false)
    })

    it('大文字Nの入力でfalseを返す', async () => {
      // Arrange
      mockStdin('N\n')
      mockStdout()

      // Act
      const result = await confirmPrompt('Continue?')

      // Assert
      expect(result).toBe(false)
    })
  })

  // ======================
  // 空入力でfalse（デフォルトN）
  // ======================
  describe('空入力でfalse', () => {
    it('空入力（Enter）でfalseを返す', async () => {
      // Arrange
      mockStdin('\n')
      mockStdout()

      // Act
      const result = await confirmPrompt('Continue?')

      // Assert
      expect(result).toBe(false)
    })
  })

  // ======================
  // その他の入力でfalse
  // ======================
  describe('その他の入力でfalse', () => {
    it('yesの入力でfalseを返す', async () => {
      // Arrange
      mockStdin('yes\n')
      mockStdout()

      // Act
      const result = await confirmPrompt('Continue?')

      // Assert
      expect(result).toBe(false)
    })

    it('任意の文字列入力でfalseを返す', async () => {
      // Arrange
      mockStdin('maybe\n')
      mockStdout()

      // Act
      const result = await confirmPrompt('Continue?')

      // Assert
      expect(result).toBe(false)
    })

    it('数字の入力でfalseを返す', async () => {
      // Arrange
      mockStdin('1\n')
      mockStdout()

      // Act
      const result = await confirmPrompt('Continue?')

      // Assert
      expect(result).toBe(false)
    })
  })

  // ======================
  // プロンプトメッセージ
  // ======================
  describe('プロンプトメッセージ', () => {
    it('指定されたメッセージが表示される', async () => {
      // Arrange
      mockStdin('y\n')
      const outputs: string[] = []
      const mockOutput = new Writable({
        write(chunk, _encoding, callback) {
          outputs.push(chunk.toString())
          callback()
        },
      })
      Object.defineProperty(process, 'stdout', { value: mockOutput })

      // Act
      await confirmPrompt('Reset watermark?')

      // Assert
      const fullOutput = outputs.join('')
      expect(fullOutput).toContain('Reset watermark?')
      expect(fullOutput).toContain('(y/N)')
    })
  })
})
