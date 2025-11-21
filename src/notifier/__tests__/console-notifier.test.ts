import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ErrorNotificationMessage } from '../../interfaces/notifier.js'
import { ConsoleNotifier } from '../console-notifier.js'

describe('ConsoleNotifier', () => {
  let notifier: ConsoleNotifier
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    notifier = new ConsoleNotifier()
    // console.errorをスパイ
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    // モックをリセット
    consoleSpy.mockRestore()
  })

  describe('sendErrorNotification', () => {
    it('エラー通知メッセージをconsole.errorに出力すること', async () => {
      // Arrange
      const message: ErrorNotificationMessage = {
        title: 'スプールリトライ上限超過',
        filePath: 'data/failed/2025-01-21T10:30:00.000Z.json',
        lastError: 'ECONNREFUSED: Connection refused',
        firstAttempt: '2025-01-21T10:00:00.000Z',
        retryCount: 10,
      }

      // Act
      await notifier.sendErrorNotification(message)

      // Assert
      expect(consoleSpy).toHaveBeenCalledTimes(1)
      expect(consoleSpy).toHaveBeenCalledWith(
        '[ERROR NOTIFICATION]',
        expect.objectContaining({
          title: 'スプールリトライ上限超過',
          filePath: 'data/failed/2025-01-21T10:30:00.000Z.json',
          lastError: 'ECONNREFUSED: Connection refused',
          firstAttempt: '2025-01-21T10:00:00.000Z',
          retryCount: 10,
        }),
      )
    })

    it('通知メッセージが正しくJSON形式で出力されること', async () => {
      // Arrange
      const message: ErrorNotificationMessage = {
        title: 'HTTP 500 Internal Server Error',
        filePath: 'data/failed/2025-01-21T11:00:00.000Z.json',
        lastError: 'Request failed with status code 500',
        firstAttempt: '2025-01-21T10:30:00.000Z',
        retryCount: 12,
      }

      // Act
      await notifier.sendErrorNotification(message)

      // Assert
      const callArg = consoleSpy.mock.calls[0]?.[1]
      expect(callArg).toEqual({
        title: 'HTTP 500 Internal Server Error',
        filePath: 'data/failed/2025-01-21T11:00:00.000Z.json',
        lastError: 'Request failed with status code 500',
        firstAttempt: '2025-01-21T10:30:00.000Z',
        retryCount: 12,
      })
    })

    it('複数回呼び出しても正しく動作すること', async () => {
      // Arrange
      const message1: ErrorNotificationMessage = {
        title: 'エラー1',
        filePath: 'data/failed/file1.json',
        lastError: 'Error 1',
        firstAttempt: '2025-01-21T10:00:00.000Z',
        retryCount: 10,
      }
      const message2: ErrorNotificationMessage = {
        title: 'エラー2',
        filePath: 'data/failed/file2.json',
        lastError: 'Error 2',
        firstAttempt: '2025-01-21T10:30:00.000Z',
        retryCount: 11,
      }

      // Act
      await notifier.sendErrorNotification(message1)
      await notifier.sendErrorNotification(message2)

      // Assert
      expect(consoleSpy).toHaveBeenCalledTimes(2)
      expect(consoleSpy).toHaveBeenNthCalledWith(
        1,
        '[ERROR NOTIFICATION]',
        expect.objectContaining({ title: 'エラー1' }),
      )
      expect(consoleSpy).toHaveBeenNthCalledWith(
        2,
        '[ERROR NOTIFICATION]',
        expect.objectContaining({ title: 'エラー2' }),
      )
    })
  })
})
