/**
 * resendコマンド単体テスト
 *
 * createResendCommand()関数の単体テスト。
 * SpoolManagerとExternalApiSenderをモックしてテストする。
 */

import { promises as fs } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SpoolFile } from '../../../types/spool.js'
import type { CliDependencies } from '../../bootstrap.js'
import { createResendCommand } from '../../commands/resend.js'

// fsモジュールをモック
vi.mock('node:fs', () => ({
  promises: {
    readdir: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    unlink: vi.fn(),
    rm: vi.fn(),
  },
}))

describe('createResendCommand', () => {
  let mockDeps: CliDependencies
  let consoleSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

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
      spoolManager: {
        listFailedFiles: vi.fn(),
        deleteFailedFile: vi.fn(),
        getFailedFile: vi.fn(),
      } as unknown as CliDependencies['spoolManager'],
      watermarkManager: {} as unknown as CliDependencies['watermarkManager'],
      externalApiSender: {
        resendFailedFile: vi.fn(),
      } as unknown as CliDependencies['externalApiSender'],
    }

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('createResendCommand()がCommandを返す', () => {
    const command = createResendCommand(mockDeps)

    expect(command.name()).toBe('resend')
    expect(command.description()).toBe('Resend failed files to external API')
  })

  describe('引数なし実行', () => {
    it('listFailedFiles()を呼び出してファイル一覧を表示', async () => {
      const mockFiles: SpoolFile[] = [
        {
          batchIdempotencyKey: 'abc123',
          records: [
            {
              date: '2025-01-20',
              app_id: 'app1',
              app_name: 'Test App 1',
              token_count: 100,
              total_price: '0.001',
              currency: 'USD',
              idempotency_key: 'key1',
              transformed_at: '2025-01-20T10:30:00.000Z',
            },
          ],
          firstAttempt: '2025-01-20T10:30:00.000Z',
          retryCount: 10,
          lastError: 'Timeout',
        },
      ]
      vi.mocked(mockDeps.spoolManager.listFailedFiles).mockResolvedValue(mockFiles)

      const command = createResendCommand(mockDeps)
      await command.parseAsync([], { from: 'user' })

      expect(mockDeps.spoolManager.listFailedFiles).toHaveBeenCalledTimes(1)
      expect(consoleSpy).toHaveBeenCalledWith('Failed files in data/failed/:')
    })

    it('0件の場合「No failed files」を表示', async () => {
      vi.mocked(mockDeps.spoolManager.listFailedFiles).mockResolvedValue([])

      const command = createResendCommand(mockDeps)
      await command.parseAsync([], { from: 'user' })

      expect(consoleSpy).toHaveBeenCalledWith('No failed files')
    })
  })

  describe('--file オプション', () => {
    it('getFailedFile()で指定ファイルを取得', async () => {
      const mockFile: SpoolFile = {
        batchIdempotencyKey: 'abc123',
        records: [
          {
            date: '2025-01-20',
            app_id: 'app1',
            app_name: 'Test App 1',
            token_count: 100,
            total_price: '0.001',
            currency: 'USD',
            idempotency_key: 'key1',
            transformed_at: '2025-01-20T10:30:00.000Z',
          },
        ],
        firstAttempt: '2025-01-20T10:30:00.000Z',
        retryCount: 10,
        lastError: 'Timeout',
      }
      vi.mocked(mockDeps.spoolManager.getFailedFile).mockResolvedValue(mockFile)
      vi.mocked(mockDeps.externalApiSender.resendFailedFile).mockResolvedValue()

      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--file', 'test.json'], { from: 'user' })

      expect(mockDeps.spoolManager.getFailedFile).toHaveBeenCalledWith('test.json')
    })

    it('取得したレコードをresendFailedFile()で送信', async () => {
      const mockFile: SpoolFile = {
        batchIdempotencyKey: 'abc123',
        records: [
          {
            date: '2025-01-20',
            app_id: 'app1',
            app_name: 'Test App 1',
            token_count: 100,
            total_price: '0.001',
            currency: 'USD',
            idempotency_key: 'key1',
            transformed_at: '2025-01-20T10:30:00.000Z',
          },
        ],
        firstAttempt: '2025-01-20T10:30:00.000Z',
        retryCount: 10,
        lastError: 'Timeout',
      }
      vi.mocked(mockDeps.spoolManager.getFailedFile).mockResolvedValue(mockFile)
      vi.mocked(mockDeps.externalApiSender.resendFailedFile).mockResolvedValue()

      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--file', 'test.json'], { from: 'user' })

      expect(mockDeps.externalApiSender.resendFailedFile).toHaveBeenCalledWith(mockFile.records)
    })

    it('再送成功後にdeleteFailedFile()を呼び出し', async () => {
      const mockFile: SpoolFile = {
        batchIdempotencyKey: 'abc123',
        records: [
          {
            date: '2025-01-20',
            app_id: 'app1',
            app_name: 'Test App 1',
            token_count: 100,
            total_price: '0.001',
            currency: 'USD',
            idempotency_key: 'key1',
            transformed_at: '2025-01-20T10:30:00.000Z',
          },
        ],
        firstAttempt: '2025-01-20T10:30:00.000Z',
        retryCount: 10,
        lastError: 'Timeout',
      }
      vi.mocked(mockDeps.spoolManager.getFailedFile).mockResolvedValue(mockFile)
      vi.mocked(mockDeps.externalApiSender.resendFailedFile).mockResolvedValue()

      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--file', 'test.json'], { from: 'user' })

      expect(mockDeps.spoolManager.deleteFailedFile).toHaveBeenCalledWith('test.json')
    })

    it('ファイルが存在しない場合にエラーメッセージを表示', async () => {
      vi.mocked(mockDeps.spoolManager.getFailedFile).mockResolvedValue(null)

      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--file', 'nonexistent.json'], { from: 'user' })

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('File not found: nonexistent.json'),
      )
    })

    it('再送失敗時にエラーメッセージを表示しファイルを保持', async () => {
      const mockFile: SpoolFile = {
        batchIdempotencyKey: 'abc123',
        records: [
          {
            date: '2025-01-20',
            app_id: 'app1',
            app_name: 'Test App 1',
            token_count: 100,
            total_price: '0.001',
            currency: 'USD',
            idempotency_key: 'key1',
            transformed_at: '2025-01-20T10:30:00.000Z',
          },
        ],
        firstAttempt: '2025-01-20T10:30:00.000Z',
        retryCount: 10,
        lastError: 'Timeout',
      }
      vi.mocked(mockDeps.spoolManager.getFailedFile).mockResolvedValue(mockFile)
      vi.mocked(mockDeps.externalApiSender.resendFailedFile).mockRejectedValue(
        new Error('Network error'),
      )

      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--file', 'test.json'], { from: 'user' })

      // エラーメッセージが表示される
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Network error'))
      // ファイルは削除されない
      expect(mockDeps.spoolManager.deleteFailedFile).not.toHaveBeenCalled()
    })
  })

  describe('--all オプション', () => {
    it('全ファイルを順次処理', async () => {
      const mockFiles: SpoolFile[] = [
        {
          batchIdempotencyKey: 'abc123',
          records: [
            {
              date: '2025-01-20',
              app_id: 'app1',
              app_name: 'Test App 1',
              token_count: 100,
              total_price: '0.001',
              currency: 'USD',
              idempotency_key: 'key1',
              transformed_at: '2025-01-20T10:30:00.000Z',
            },
          ],
          firstAttempt: '2025-01-20T10:30:00.000Z',
          retryCount: 10,
          lastError: 'Timeout',
        },
        {
          batchIdempotencyKey: 'def456',
          records: [
            {
              date: '2025-01-21',
              app_id: 'app2',
              app_name: 'Test App 2',
              token_count: 200,
              total_price: '0.002',
              currency: 'USD',
              idempotency_key: 'key2',
              transformed_at: '2025-01-21T14:20:00.000Z',
            },
          ],
          firstAttempt: '2025-01-21T14:20:00.000Z',
          retryCount: 10,
          lastError: '500 Error',
        },
      ]
      vi.mocked(mockDeps.spoolManager.listFailedFiles).mockResolvedValue(mockFiles)
      vi.mocked(mockDeps.externalApiSender.resendFailedFile).mockResolvedValue()
      // fsモックの設定
      vi.mocked(fs.readdir).mockResolvedValue([
        'failed_20250120T103000000Z_abc123.json',
        'failed_20250121T142000000Z_def456.json',
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>)

      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--all'], { from: 'user' })

      expect(mockDeps.spoolManager.listFailedFiles).toHaveBeenCalledTimes(1)
      expect(mockDeps.externalApiSender.resendFailedFile).toHaveBeenCalledTimes(2)
    })

    it('一部失敗しても残りの処理を継続', async () => {
      const mockFiles: SpoolFile[] = [
        {
          batchIdempotencyKey: 'abc123',
          records: [
            {
              date: '2025-01-20',
              app_id: 'app1',
              app_name: 'Test App 1',
              token_count: 100,
              total_price: '0.001',
              currency: 'USD',
              idempotency_key: 'key1',
              transformed_at: '2025-01-20T10:30:00.000Z',
            },
          ],
          firstAttempt: '2025-01-20T10:30:00.000Z',
          retryCount: 10,
          lastError: 'Timeout',
        },
        {
          batchIdempotencyKey: 'def456',
          records: [
            {
              date: '2025-01-21',
              app_id: 'app2',
              app_name: 'Test App 2',
              token_count: 200,
              total_price: '0.002',
              currency: 'USD',
              idempotency_key: 'key2',
              transformed_at: '2025-01-21T14:20:00.000Z',
            },
          ],
          firstAttempt: '2025-01-21T14:20:00.000Z',
          retryCount: 10,
          lastError: '500 Error',
        },
      ]
      vi.mocked(mockDeps.spoolManager.listFailedFiles).mockResolvedValue(mockFiles)
      vi.mocked(mockDeps.externalApiSender.resendFailedFile)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce()
      // fsモックの設定
      vi.mocked(fs.readdir).mockResolvedValue([
        'failed_20250120T103000000Z_abc123.json',
        'failed_20250121T142000000Z_def456.json',
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>)

      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--all'], { from: 'user' })

      // 両方のファイルに対して処理が試行される
      expect(mockDeps.externalApiSender.resendFailedFile).toHaveBeenCalledTimes(2)
    })

    it('サマリーを表示', async () => {
      const mockFiles: SpoolFile[] = [
        {
          batchIdempotencyKey: 'abc123',
          records: [
            {
              date: '2025-01-20',
              app_id: 'app1',
              app_name: 'Test App 1',
              token_count: 100,
              total_price: '0.001',
              currency: 'USD',
              idempotency_key: 'key1',
              transformed_at: '2025-01-20T10:30:00.000Z',
            },
          ],
          firstAttempt: '2025-01-20T10:30:00.000Z',
          retryCount: 10,
          lastError: 'Timeout',
        },
      ]
      vi.mocked(mockDeps.spoolManager.listFailedFiles).mockResolvedValue(mockFiles)
      vi.mocked(mockDeps.externalApiSender.resendFailedFile).mockResolvedValue()
      // fsモックの設定
      vi.mocked(fs.readdir).mockResolvedValue([
        'failed_20250120T103000000Z_abc123.json',
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>)

      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--all'], { from: 'user' })

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Summary:'))
    })
  })
})
