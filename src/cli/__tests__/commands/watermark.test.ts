/**
 * watermarkコマンド単体テスト
 *
 * createWatermarkCommand()関数の単体テスト。
 * WatermarkManagerをモックしてテストする。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Watermark } from '../../../types/watermark.js'
import type { CliDependencies } from '../../bootstrap.js'
import { createWatermarkCommand } from '../../commands/watermark.js'

// promptモジュールをモック
vi.mock('../../utils/prompt.js', () => ({
  confirmPrompt: vi.fn(),
}))

import { confirmPrompt } from '../../utils/prompt.js'

describe('createWatermarkCommand', () => {
  let mockDeps: CliDependencies
  let consoleSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let processExitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // モック依存関係
    mockDeps = {
      config: {} as CliDependencies['config'],
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      } as unknown as CliDependencies['logger'],
      spoolManager: {} as unknown as CliDependencies['spoolManager'],
      watermarkManager: {
        load: vi.fn(),
        update: vi.fn(),
      } as unknown as CliDependencies['watermarkManager'],
      externalApiSender: {} as unknown as CliDependencies['externalApiSender'],
    }

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('createWatermarkCommand()がCommandを返す', () => {
    const command = createWatermarkCommand(mockDeps)

    expect(command.name()).toBe('watermark')
    expect(command.description()).toBe('Manage watermark (last_fetched_date)')
  })

  describe('showサブコマンド', () => {
    it('WatermarkManager.load()を呼び出す', async () => {
      const mockWatermark: Watermark = {
        last_fetched_date: '2025-01-22T10:30:00.000Z',
        last_updated_at: '2025-01-22T11:00:00.000Z',
      }
      vi.mocked(mockDeps.watermarkManager.load).mockResolvedValue(mockWatermark)

      const command = createWatermarkCommand(mockDeps)
      await command.parseAsync(['show'], { from: 'user' })

      expect(mockDeps.watermarkManager.load).toHaveBeenCalledTimes(1)
    })

    it('last_fetched_dateを表示する', async () => {
      const mockWatermark: Watermark = {
        last_fetched_date: '2025-01-22T10:30:00.000Z',
        last_updated_at: '2025-01-22T11:00:00.000Z',
      }
      vi.mocked(mockDeps.watermarkManager.load).mockResolvedValue(mockWatermark)

      const command = createWatermarkCommand(mockDeps)
      await command.parseAsync(['show'], { from: 'user' })

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('2025-01-22T10:30:00.000Z'))
    })

    it('last_updated_atを表示する', async () => {
      const mockWatermark: Watermark = {
        last_fetched_date: '2025-01-22T10:30:00.000Z',
        last_updated_at: '2025-01-22T11:00:00.000Z',
      }
      vi.mocked(mockDeps.watermarkManager.load).mockResolvedValue(mockWatermark)

      const command = createWatermarkCommand(mockDeps)
      await command.parseAsync(['show'], { from: 'user' })

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('2025-01-22T11:00:00.000Z'))
    })

    it('ウォーターマーク未設定時に「Watermark not set」を表示', async () => {
      vi.mocked(mockDeps.watermarkManager.load).mockResolvedValue(null)

      const command = createWatermarkCommand(mockDeps)
      await command.parseAsync(['show'], { from: 'user' })

      expect(consoleSpy).toHaveBeenCalledWith('Watermark not set')
    })
  })

  describe('resetサブコマンド', () => {
    it('確認プロンプトを表示する', async () => {
      const mockWatermark: Watermark = {
        last_fetched_date: '2025-01-22T10:30:00.000Z',
        last_updated_at: '2025-01-22T11:00:00.000Z',
      }
      vi.mocked(mockDeps.watermarkManager.load).mockResolvedValue(mockWatermark)
      vi.mocked(confirmPrompt).mockResolvedValue(false)

      const command = createWatermarkCommand(mockDeps)
      await command.parseAsync(['reset', '--date', '2025-01-20T00:00:00.000Z'], { from: 'user' })

      expect(confirmPrompt).toHaveBeenCalledWith('Are you sure?')
    })

    it('確認「y」でWatermarkManager.update()が呼び出される', async () => {
      const mockWatermark: Watermark = {
        last_fetched_date: '2025-01-22T10:30:00.000Z',
        last_updated_at: '2025-01-22T11:00:00.000Z',
      }
      vi.mocked(mockDeps.watermarkManager.load).mockResolvedValue(mockWatermark)
      vi.mocked(confirmPrompt).mockResolvedValue(true)
      vi.mocked(mockDeps.watermarkManager.update).mockResolvedValue()

      const command = createWatermarkCommand(mockDeps)
      await command.parseAsync(['reset', '--date', '2025-01-20T00:00:00.000Z'], { from: 'user' })

      expect(mockDeps.watermarkManager.update).toHaveBeenCalledTimes(1)
      expect(mockDeps.watermarkManager.update).toHaveBeenCalledWith(
        expect.objectContaining({
          last_fetched_date: '2025-01-20T00:00:00.000Z',
        }),
      )
    })

    it('確認「n」でupdateが呼び出されない', async () => {
      const mockWatermark: Watermark = {
        last_fetched_date: '2025-01-22T10:30:00.000Z',
        last_updated_at: '2025-01-22T11:00:00.000Z',
      }
      vi.mocked(mockDeps.watermarkManager.load).mockResolvedValue(mockWatermark)
      vi.mocked(confirmPrompt).mockResolvedValue(false)

      const command = createWatermarkCommand(mockDeps)
      await command.parseAsync(['reset', '--date', '2025-01-20T00:00:00.000Z'], { from: 'user' })

      expect(mockDeps.watermarkManager.update).not.toHaveBeenCalled()
    })

    it('キャンセル時にメッセージを表示', async () => {
      const mockWatermark: Watermark = {
        last_fetched_date: '2025-01-22T10:30:00.000Z',
        last_updated_at: '2025-01-22T11:00:00.000Z',
      }
      vi.mocked(mockDeps.watermarkManager.load).mockResolvedValue(mockWatermark)
      vi.mocked(confirmPrompt).mockResolvedValue(false)

      const command = createWatermarkCommand(mockDeps)
      await command.parseAsync(['reset', '--date', '2025-01-20T00:00:00.000Z'], { from: 'user' })

      expect(consoleSpy).toHaveBeenCalledWith('Reset cancelled')
    })

    it('リセット成功メッセージを表示', async () => {
      const mockWatermark: Watermark = {
        last_fetched_date: '2025-01-22T10:30:00.000Z',
        last_updated_at: '2025-01-22T11:00:00.000Z',
      }
      vi.mocked(mockDeps.watermarkManager.load).mockResolvedValue(mockWatermark)
      vi.mocked(confirmPrompt).mockResolvedValue(true)
      vi.mocked(mockDeps.watermarkManager.update).mockResolvedValue()

      const command = createWatermarkCommand(mockDeps)
      await command.parseAsync(['reset', '--date', '2025-01-20T00:00:00.000Z'], { from: 'user' })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Watermark reset to 2025-01-20T00:00:00.000Z'),
      )
    })

    it('現在値と新しい値が表示される', async () => {
      const mockWatermark: Watermark = {
        last_fetched_date: '2025-01-22T10:30:00.000Z',
        last_updated_at: '2025-01-22T11:00:00.000Z',
      }
      vi.mocked(mockDeps.watermarkManager.load).mockResolvedValue(mockWatermark)
      vi.mocked(confirmPrompt).mockResolvedValue(false)

      const command = createWatermarkCommand(mockDeps)
      await command.parseAsync(['reset', '--date', '2025-01-20T00:00:00.000Z'], { from: 'user' })

      // 現在値
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Current:'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('2025-01-22T10:30:00.000Z'))
      // 新しい値
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('New:'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('2025-01-20T00:00:00.000Z'))
    })

    it('ウォーターマーク未設定時はCurrentがNot setと表示', async () => {
      vi.mocked(mockDeps.watermarkManager.load).mockResolvedValue(null)
      vi.mocked(confirmPrompt).mockResolvedValue(false)

      const command = createWatermarkCommand(mockDeps)
      await command.parseAsync(['reset', '--date', '2025-01-20T00:00:00.000Z'], { from: 'user' })

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Not set'))
    })
  })

  describe('日時バリデーション', () => {
    it('不正な日時形式でエラーを表示しexit 1', async () => {
      const command = createWatermarkCommand(mockDeps)
      await command.parseAsync(['reset', '--date', 'invalid-date'], { from: 'user' })

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid date format'))
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('有効なISO 8601日時は受け入れられる', async () => {
      const mockWatermark: Watermark = {
        last_fetched_date: '2025-01-22T10:30:00.000Z',
        last_updated_at: '2025-01-22T11:00:00.000Z',
      }
      vi.mocked(mockDeps.watermarkManager.load).mockResolvedValue(mockWatermark)
      vi.mocked(confirmPrompt).mockResolvedValue(true)
      vi.mocked(mockDeps.watermarkManager.update).mockResolvedValue()

      const command = createWatermarkCommand(mockDeps)
      await command.parseAsync(['reset', '--date', '2025-01-20T00:00:00.000Z'], { from: 'user' })

      // エラーなしで実行
      expect(processExitSpy).not.toHaveBeenCalledWith(1)
      expect(mockDeps.watermarkManager.update).toHaveBeenCalled()
    })

    it('空文字でエラーを表示', async () => {
      const command = createWatermarkCommand(mockDeps)
      await command.parseAsync(['reset', '--date', ''], { from: 'user' })

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid date format'))
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })
})
