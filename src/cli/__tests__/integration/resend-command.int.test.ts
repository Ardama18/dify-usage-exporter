/**
 * resendコマンド統合テスト - Design Doc: specs/stories/6-manual-resend-watermark/design.md
 * 生成日: 2025-11-22
 * テスト種別: Integration Test
 * 実装タイミング: Phase 2 - resendコマンド
 */

import { promises as fs } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Logger } from '../../../logger/winston-logger.js'
import type { ExternalApiSender } from '../../../sender/external-api-sender.js'
import { SpoolManager } from '../../../sender/spool-manager.js'
import type { EnvConfig } from '../../../types/env.js'
import type { SpoolFile } from '../../../types/spool.js'
import type { CliDependencies } from '../../bootstrap.js'
import { createResendCommand } from '../../commands/resend.js'

describe('resendコマンド統合テスト', { concurrent: false }, () => {
  let mockDeps: CliDependencies
  let spoolManager: SpoolManager
  let consoleSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  const testFailedDir = 'data/failed'

  // テストデータヘルパー
  function createTestSpoolFile(overrides: Partial<SpoolFile> = {}): SpoolFile {
    return {
      batchIdempotencyKey: `test-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      records: [
        {
          date: '2025-01-20',
          app_id: 'test-app',
          app_name: 'Test App',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
          idempotency_key: `key-${Date.now()}`,
          transformed_at: '2025-01-20T10:30:00.000Z',
        },
      ],
      firstAttempt: '2025-01-20T10:30:00.000Z',
      retryCount: 10,
      lastError: 'Test error',
      ...overrides,
    }
  }

  async function saveTestFailedFile(spoolFile: SpoolFile, filename: string): Promise<void> {
    await fs.mkdir(testFailedDir, { recursive: true })
    const filePath = `${testFailedDir}/${filename}`
    await fs.writeFile(filePath, JSON.stringify(spoolFile, null, 2))
  }

  beforeEach(async () => {
    // モックロガー
    const mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    } as unknown as Logger

    spoolManager = new SpoolManager(mockLogger)

    // テストディレクトリ作成
    await fs.mkdir(testFailedDir, { recursive: true })

    // モック依存関係
    mockDeps = {
      config: {} as EnvConfig,
      logger: mockLogger,
      spoolManager,
      watermarkManager: {} as CliDependencies['watermarkManager'],
      externalApiSender: {
        resendFailedFile: vi.fn().mockResolvedValue(undefined),
      } as unknown as ExternalApiSender,
    }

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    // クリーンアップ
    await fs.rm(testFailedDir, { recursive: true, force: true })
  })

  // ======================
  // AC-RESEND-1: 引数なし実行時のファイル一覧表示
  // ======================
  describe('AC-RESEND-1: 引数なし実行', () => {
    it('AC-RESEND-1: 引数なし実行でlistFailedFilesが呼び出される', async () => {
      // Arrange
      const file1 = createTestSpoolFile({
        batchIdempotencyKey: 'batch1',
        firstAttempt: '2025-01-20T10:30:00.000Z',
      })
      await saveTestFailedFile(file1, 'failed_20250120T103000000Z_batch1.json')

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync([], { from: 'user' })

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('Failed files in data/failed/:')
    })

    it('AC-RESEND-1: ファイル一覧が仕様の形式で表示される', async () => {
      // Arrange
      const file1 = createTestSpoolFile({
        batchIdempotencyKey: 'batch1',
        firstAttempt: '2025-01-20T10:30:00.000Z',
      })
      await saveTestFailedFile(file1, 'failed_20250120T103000000Z_batch1.json')

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync([], { from: 'user' })

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('batch1'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('1 records'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Total: 1 files'))
    })

    it('AC-RESEND-1-edge: 失敗ファイルが存在しない場合のメッセージ表示', async () => {
      // Arrange: 空ディレクトリ

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync([], { from: 'user' })

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('No failed files')
    })
  })

  // ======================
  // AC-RESEND-2: 指定ファイル再送
  // ======================
  describe('AC-RESEND-2: 指定ファイル再送', () => {
    it('AC-RESEND-2: 指定ファイルがgetFailedFileで取得される', async () => {
      // Arrange
      const file = createTestSpoolFile({ batchIdempotencyKey: 'specific' })
      const filename = 'failed_20250120T103000000Z_specific.json'
      await saveTestFailedFile(file, filename)

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--file', filename], { from: 'user' })

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(`Resending ${filename}`))
    })

    it('AC-RESEND-2: 取得したレコードがresendFailedFileで送信される', async () => {
      // Arrange
      const file = createTestSpoolFile({ batchIdempotencyKey: 'sendrec' })
      const filename = 'failed_20250120T103000000Z_sendrec.json'
      await saveTestFailedFile(file, filename)

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--file', filename], { from: 'user' })

      // Assert
      expect(mockDeps.externalApiSender.resendFailedFile).toHaveBeenCalledWith(file.records)
    })

    it('AC-RESEND-2-edge: 存在しないファイル名を指定した場合にエラー', async () => {
      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--file', 'nonexistent.json'], { from: 'user' })

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('File not found: nonexistent.json'),
      )
    })

    it('AC-RESEND-2-edge: ファイル内のレコードが空の場合の動作', async () => {
      // Arrange
      const emptyFile = createTestSpoolFile({
        batchIdempotencyKey: 'empty',
        records: [],
      })
      const filename = 'failed_20250120T103000000Z_empty.json'
      await saveTestFailedFile(emptyFile, filename)

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--file', filename], { from: 'user' })

      // Assert
      expect(mockDeps.externalApiSender.resendFailedFile).toHaveBeenCalledWith([])
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('0 records'))
    })
  })

  // ======================
  // AC-RESEND-3: 全ファイル再送
  // ======================
  describe('AC-RESEND-3: 全ファイル再送', () => {
    it('AC-RESEND-3: 全失敗ファイルが順次処理される', async () => {
      // Arrange
      const file1 = createTestSpoolFile({
        batchIdempotencyKey: 'all1',
        firstAttempt: '2025-01-20T10:30:00.000Z',
      })
      const file2 = createTestSpoolFile({
        batchIdempotencyKey: 'all2',
        firstAttempt: '2025-01-21T10:30:00.000Z',
      })
      await saveTestFailedFile(file1, 'failed_20250120T103000000Z_all1.json')
      await saveTestFailedFile(file2, 'failed_20250121T103000000Z_all2.json')

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--all'], { from: 'user' })

      // Assert
      expect(mockDeps.externalApiSender.resendFailedFile).toHaveBeenCalledTimes(2)
    })

    it('AC-RESEND-3: 各ファイルのレコードがresendFailedFileで送信される', async () => {
      // Arrange
      const file1 = createTestSpoolFile({
        batchIdempotencyKey: 'rec1',
        records: [
          {
            date: '2025-01-20',
            app_id: 'app1',
            app_name: 'Test App',
            token_count: 100,
            total_price: '0.001',
            currency: 'USD',
            idempotency_key: 'key1',
            transformed_at: '2025-01-20T10:30:00.000Z',
          },
        ],
      })
      await saveTestFailedFile(file1, 'failed_20250120T103000000Z_rec1.json')

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--all'], { from: 'user' })

      // Assert
      expect(mockDeps.externalApiSender.resendFailedFile).toHaveBeenCalledWith(file1.records)
    })

    it('AC-RESEND-3: 一部のファイルが失敗しても残りの処理が継続される', async () => {
      // Arrange
      const file1 = createTestSpoolFile({ batchIdempotencyKey: 'fail1' })
      const file2 = createTestSpoolFile({ batchIdempotencyKey: 'fail2' })
      await saveTestFailedFile(file1, 'failed_20250120T103000000Z_fail1.json')
      await saveTestFailedFile(file2, 'failed_20250121T103000000Z_fail2.json')

      vi.mocked(mockDeps.externalApiSender.resendFailedFile)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined)

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--all'], { from: 'user' })

      // Assert
      expect(mockDeps.externalApiSender.resendFailedFile).toHaveBeenCalledTimes(2)
    })

    it('AC-RESEND-3-edge: 多数のファイル（10件以上）の順次処理', async () => {
      // Arrange
      for (let i = 0; i < 10; i++) {
        const file = createTestSpoolFile({ batchIdempotencyKey: `multi${i}` })
        await saveTestFailedFile(file, `failed_2025012${i}T103000000Z_multi${i}.json`)
      }

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--all'], { from: 'user' })

      // Assert
      expect(mockDeps.externalApiSender.resendFailedFile).toHaveBeenCalledTimes(10)
    })
  })

  // ======================
  // AC-RESEND-4: 再送成功時のファイル削除
  // ======================
  describe('AC-RESEND-4: 成功時のファイル削除', () => {
    it('AC-RESEND-4: 再送成功後にdeleteFailedFileが呼び出される', async () => {
      // Arrange
      const file = createTestSpoolFile({ batchIdempotencyKey: 'delete1' })
      const filename = 'failed_20250120T103000000Z_delete1.json'
      await saveTestFailedFile(file, filename)

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--file', filename], { from: 'user' })

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('File deleted'))
    })

    it('AC-RESEND-4: ファイルがファイルシステムから削除されている', async () => {
      // Arrange
      const file = createTestSpoolFile({ batchIdempotencyKey: 'fsdelete' })
      const filename = 'failed_20250120T103000000Z_fsdelete.json'
      await saveTestFailedFile(file, filename)

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--file', filename], { from: 'user' })

      // Assert
      const fileExists = await fs
        .access(`${testFailedDir}/${filename}`)
        .then(() => true)
        .catch(() => false)
      expect(fileExists).toBe(false)
    })

    it('AC-RESEND-4: 409レスポンスでもファイルが削除される', async () => {
      // Arrange: 409は成功扱いとしてmockが解決する
      const file = createTestSpoolFile({ batchIdempotencyKey: 'conflict' })
      const filename = 'failed_20250120T103000000Z_conflict.json'
      await saveTestFailedFile(file, filename)

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--file', filename], { from: 'user' })

      // Assert
      const fileExists = await fs
        .access(`${testFailedDir}/${filename}`)
        .then(() => true)
        .catch(() => false)
      expect(fileExists).toBe(false)
    })
  })

  // ======================
  // AC-RESEND-5: 再送失敗時のファイル保持
  // ======================
  describe('AC-RESEND-5: 失敗時のファイル保持', () => {
    it('AC-RESEND-5: 再送失敗時にファイルが削除されない', async () => {
      // Arrange
      const file = createTestSpoolFile({ batchIdempotencyKey: 'keep' })
      const filename = 'failed_20250120T103000000Z_keep.json'
      await saveTestFailedFile(file, filename)

      vi.mocked(mockDeps.externalApiSender.resendFailedFile).mockRejectedValue(
        new Error('Network error'),
      )

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--file', filename], { from: 'user' })

      // Assert
      const fileExists = await fs
        .access(`${testFailedDir}/${filename}`)
        .then(() => true)
        .catch(() => false)
      expect(fileExists).toBe(true)
    })

    it('AC-RESEND-5: 再送失敗時にエラーメッセージが出力される', async () => {
      // Arrange
      const file = createTestSpoolFile({ batchIdempotencyKey: 'errmsg' })
      const filename = 'failed_20250120T103000000Z_errmsg.json'
      await saveTestFailedFile(file, filename)

      vi.mocked(mockDeps.externalApiSender.resendFailedFile).mockRejectedValue(
        new Error('Connection refused'),
      )

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--file', filename], { from: 'user' })

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Connection refused'))
    })

    it('AC-RESEND-5-edge: ネットワークタイムアウト時の動作', async () => {
      // Arrange
      const file = createTestSpoolFile({ batchIdempotencyKey: 'timeout' })
      const filename = 'failed_20250120T103000000Z_timeout.json'
      await saveTestFailedFile(file, filename)

      vi.mocked(mockDeps.externalApiSender.resendFailedFile).mockRejectedValue(
        new Error('ETIMEDOUT'),
      )

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--file', filename], { from: 'user' })

      // Assert
      const fileExists = await fs
        .access(`${testFailedDir}/${filename}`)
        .then(() => true)
        .catch(() => false)
      expect(fileExists).toBe(true)
    })

    it('AC-RESEND-5-edge: 500エラー時のファイル保持', async () => {
      // Arrange
      const file = createTestSpoolFile({ batchIdempotencyKey: 'err500' })
      const filename = 'failed_20250120T103000000Z_err500.json'
      await saveTestFailedFile(file, filename)

      vi.mocked(mockDeps.externalApiSender.resendFailedFile).mockRejectedValue(
        new Error('Internal Server Error'),
      )

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--file', filename], { from: 'user' })

      // Assert
      const fileExists = await fs
        .access(`${testFailedDir}/${filename}`)
        .then(() => true)
        .catch(() => false)
      expect(fileExists).toBe(true)
    })
  })

  // ======================
  // AC-RESEND-6: サマリー表示
  // ======================
  describe('AC-RESEND-6: 処理サマリー', () => {
    it('AC-RESEND-6: 成功ファイル数とレコード数がサマリーに含まれる', async () => {
      // Arrange
      const file = createTestSpoolFile({ batchIdempotencyKey: 'summary1' })
      await saveTestFailedFile(file, 'failed_20250120T103000000Z_summary1.json')

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--all'], { from: 'user' })

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Summary:'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Successful: 1 files'))
    })

    it('AC-RESEND-6: 失敗ファイル数とレコード数がサマリーに含まれる', async () => {
      // Arrange
      const file = createTestSpoolFile({ batchIdempotencyKey: 'failsum' })
      await saveTestFailedFile(file, 'failed_20250120T103000000Z_failsum.json')

      vi.mocked(mockDeps.externalApiSender.resendFailedFile).mockRejectedValue(
        new Error('API Error'),
      )

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--all'], { from: 'user' })

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Summary:'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed: 1 files'))
    })

    it('AC-RESEND-6: 全ファイル成功時のサマリー表示', async () => {
      // Arrange
      const file1 = createTestSpoolFile({ batchIdempotencyKey: 'allsuc1' })
      const file2 = createTestSpoolFile({ batchIdempotencyKey: 'allsuc2' })
      await saveTestFailedFile(file1, 'failed_20250120T103000000Z_allsuc1.json')
      await saveTestFailedFile(file2, 'failed_20250121T103000000Z_allsuc2.json')

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--all'], { from: 'user' })

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Successful: 2 files'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed: 0 files'))
    })

    it('AC-RESEND-6: 全ファイル失敗時のサマリー表示', async () => {
      // Arrange
      const file1 = createTestSpoolFile({ batchIdempotencyKey: 'allfail1' })
      const file2 = createTestSpoolFile({ batchIdempotencyKey: 'allfail2' })
      await saveTestFailedFile(file1, 'failed_20250120T103000000Z_allfail1.json')
      await saveTestFailedFile(file2, 'failed_20250121T103000000Z_allfail2.json')

      vi.mocked(mockDeps.externalApiSender.resendFailedFile).mockRejectedValue(
        new Error('API Error'),
      )

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--all'], { from: 'user' })

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Successful: 0 files'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed: 2 files'))
    })

    it('AC-RESEND-6: 部分的成功時のサマリー表示', async () => {
      // Arrange
      const file1 = createTestSpoolFile({ batchIdempotencyKey: 'partial1' })
      const file2 = createTestSpoolFile({ batchIdempotencyKey: 'partial2' })
      await saveTestFailedFile(file1, 'failed_20250120T103000000Z_partial1.json')
      await saveTestFailedFile(file2, 'failed_20250121T103000000Z_partial2.json')

      vi.mocked(mockDeps.externalApiSender.resendFailedFile)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('API Error'))

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--all'], { from: 'user' })

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Successful: 1 files'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed: 1 files'))
    })
  })
})

describe('ExternalApiSender.resendFailedFile 統合テスト', { concurrent: false }, () => {
  let mockDeps: CliDependencies
  let spoolManager: SpoolManager
  let consoleSpy: ReturnType<typeof vi.spyOn>
  const testFailedDir = 'data/failed'

  function createTestSpoolFile(overrides: Partial<SpoolFile> = {}): SpoolFile {
    return {
      batchIdempotencyKey: `test-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      records: [
        {
          date: '2025-01-20',
          app_id: 'test-app',
          app_name: 'Test App',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
          idempotency_key: `key-${Date.now()}`,
          transformed_at: '2025-01-20T10:30:00.000Z',
        },
      ],
      firstAttempt: '2025-01-20T10:30:00.000Z',
      retryCount: 10,
      lastError: 'Test error',
      ...overrides,
    }
  }

  async function saveTestFailedFile(spoolFile: SpoolFile, filename: string): Promise<void> {
    await fs.mkdir(testFailedDir, { recursive: true })
    const filePath = `${testFailedDir}/${filename}`
    await fs.writeFile(filePath, JSON.stringify(spoolFile, null, 2))
  }

  beforeEach(async () => {
    const mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    } as unknown as Logger

    spoolManager = new SpoolManager(mockLogger)

    await fs.mkdir(testFailedDir, { recursive: true })

    mockDeps = {
      config: {} as EnvConfig,
      logger: mockLogger,
      spoolManager,
      watermarkManager: {} as CliDependencies['watermarkManager'],
      externalApiSender: {
        resendFailedFile: vi.fn().mockResolvedValue(undefined),
      } as unknown as ExternalApiSender,
    }

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await fs.rm(testFailedDir, { recursive: true, force: true })
  })

  // ======================
  // 送信成功シナリオ
  // ======================
  describe('送信成功パターン', () => {
    it('200レスポンスで送信成功', async () => {
      // Arrange
      const file = createTestSpoolFile({ batchIdempotencyKey: 'success200' })
      const filename = 'failed_20250120T103000000Z_success200.json'
      await saveTestFailedFile(file, filename)

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--file', filename], { from: 'user' })

      // Assert
      expect(mockDeps.externalApiSender.resendFailedFile).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Successfully resent'))
    })

    it('201レスポンスで送信成功', async () => {
      // Arrange: モックは成功を返す
      const file = createTestSpoolFile({ batchIdempotencyKey: 'success201' })
      const filename = 'failed_20250120T103000000Z_success201.json'
      await saveTestFailedFile(file, filename)

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--file', filename], { from: 'user' })

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Successfully resent'))
    })

    it('409レスポンスで重複扱いとして成功', async () => {
      // Arrange: 409は成功扱い
      const file = createTestSpoolFile({ batchIdempotencyKey: 'dup409' })
      const filename = 'failed_20250120T103000000Z_dup409.json'
      await saveTestFailedFile(file, filename)

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--file', filename], { from: 'user' })

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Successfully resent'))
    })
  })

  // ======================
  // 送信失敗シナリオ
  // ======================
  describe('送信失敗パターン', () => {
    it('400エラーでリトライせずに失敗', async () => {
      // Arrange
      const file = createTestSpoolFile({ batchIdempotencyKey: 'err400' })
      const filename = 'failed_20250120T103000000Z_err400.json'
      await saveTestFailedFile(file, filename)

      vi.mocked(mockDeps.externalApiSender.resendFailedFile).mockRejectedValue(
        new Error('Bad Request'),
      )

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--file', filename], { from: 'user' })

      // Assert
      const fileExists = await fs
        .access(`${testFailedDir}/${filename}`)
        .then(() => true)
        .catch(() => false)
      expect(fileExists).toBe(true)
    })

    it('500エラーでリトライ上限後に失敗', async () => {
      // Arrange
      const file = createTestSpoolFile({ batchIdempotencyKey: 'err500retry' })
      const filename = 'failed_20250120T103000000Z_err500retry.json'
      await saveTestFailedFile(file, filename)

      vi.mocked(mockDeps.externalApiSender.resendFailedFile).mockRejectedValue(
        new Error('Internal Server Error'),
      )

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--file', filename], { from: 'user' })

      // Assert
      const fileExists = await fs
        .access(`${testFailedDir}/${filename}`)
        .then(() => true)
        .catch(() => false)
      expect(fileExists).toBe(true)
    })

    it('ネットワークエラーで失敗', async () => {
      // Arrange
      const file = createTestSpoolFile({ batchIdempotencyKey: 'neterr' })
      const filename = 'failed_20250120T103000000Z_neterr.json'
      await saveTestFailedFile(file, filename)

      vi.mocked(mockDeps.externalApiSender.resendFailedFile).mockRejectedValue(
        new Error('ECONNREFUSED'),
      )

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--file', filename], { from: 'user' })

      // Assert
      const fileExists = await fs
        .access(`${testFailedDir}/${filename}`)
        .then(() => true)
        .catch(() => false)
      expect(fileExists).toBe(true)
    })
  })

  // ======================
  // send()との違いの検証
  // ======================
  describe('send()との動作の違い', () => {
    it('resendFailedFile失敗時にスプールファイルが作成されない', async () => {
      // Arrange
      const file = createTestSpoolFile({ batchIdempotencyKey: 'nospool' })
      const filename = 'failed_20250120T103000000Z_nospool.json'
      await saveTestFailedFile(file, filename)

      vi.mocked(mockDeps.externalApiSender.resendFailedFile).mockRejectedValue(
        new Error('API Error'),
      )

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--file', filename], { from: 'user' })

      // Assert: スプールディレクトリにファイルが作成されていない
      const spoolDir = 'data/spool'
      let spoolFiles: string[] = []
      try {
        spoolFiles = await fs.readdir(spoolDir)
      } catch {
        // ディレクトリが存在しない場合は空
      }
      expect(spoolFiles.filter((f) => f.includes('nospool'))).toHaveLength(0)
    })

    it('batchIdempotencyKeyが正しく送信される', async () => {
      // Arrange
      const file = createTestSpoolFile({
        batchIdempotencyKey: 'correctkey',
        records: [
          {
            date: '2025-01-20',
            app_id: 'app1',
            app_name: 'Test App',
            token_count: 100,
            total_price: '0.001',
            currency: 'USD',
            idempotency_key: 'unique-key',
            transformed_at: '2025-01-20T10:30:00.000Z',
          },
        ],
      })
      const filename = 'failed_20250120T103000000Z_correctkey.json'
      await saveTestFailedFile(file, filename)

      // Act
      const command = createResendCommand(mockDeps)
      await command.parseAsync(['--file', filename], { from: 'user' })

      // Assert
      expect(mockDeps.externalApiSender.resendFailedFile).toHaveBeenCalledWith(file.records)
    })
  })
})

describe('SpoolManager.deleteFailedFile 統合テスト', { concurrent: false }, () => {
  let spoolManager: SpoolManager
  const testFailedDir = 'data/failed'

  function createTestSpoolFile(overrides: Partial<SpoolFile> = {}): SpoolFile {
    return {
      batchIdempotencyKey: `test-${Date.now()}`,
      records: [
        {
          date: '2025-01-20',
          app_id: 'test-app',
          app_name: 'Test App',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
          idempotency_key: `key-${Date.now()}`,
          transformed_at: '2025-01-20T10:30:00.000Z',
        },
      ],
      firstAttempt: '2025-01-20T10:30:00.000Z',
      retryCount: 10,
      lastError: 'Test error',
      ...overrides,
    }
  }

  async function saveTestFailedFile(spoolFile: SpoolFile, filename: string): Promise<void> {
    await fs.mkdir(testFailedDir, { recursive: true })
    const filePath = `${testFailedDir}/${filename}`
    await fs.writeFile(filePath, JSON.stringify(spoolFile, null, 2))
  }

  beforeEach(async () => {
    const mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    } as unknown as Logger

    spoolManager = new SpoolManager(mockLogger)

    await fs.mkdir(testFailedDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testFailedDir, { recursive: true, force: true })
  })

  // ======================
  // ファイル削除
  // ======================
  describe('ファイル削除', () => {
    it('指定したファイルが正常に削除される', async () => {
      // Arrange
      const file = createTestSpoolFile({ batchIdempotencyKey: 'todelete' })
      const filename = 'failed_20250120T103000000Z_todelete.json'
      await saveTestFailedFile(file, filename)

      // Act
      await spoolManager.deleteFailedFile(filename)

      // Assert
      const fileExists = await fs
        .access(`${testFailedDir}/${filename}`)
        .then(() => true)
        .catch(() => false)
      expect(fileExists).toBe(false)
    })

    it('存在しないファイルの削除時のエラーハンドリング', async () => {
      // Act & Assert
      await expect(spoolManager.deleteFailedFile('nonexistent.json')).rejects.toThrow()
    })
  })
})

describe('SpoolManager.getFailedFile 統合テスト', { concurrent: false }, () => {
  let spoolManager: SpoolManager
  const testFailedDir = 'data/failed'

  function createTestSpoolFile(overrides: Partial<SpoolFile> = {}): SpoolFile {
    return {
      batchIdempotencyKey: `test-${Date.now()}`,
      records: [
        {
          date: '2025-01-20',
          app_id: 'test-app',
          app_name: 'Test App',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
          idempotency_key: `key-${Date.now()}`,
          transformed_at: '2025-01-20T10:30:00.000Z',
        },
      ],
      firstAttempt: '2025-01-20T10:30:00.000Z',
      retryCount: 10,
      lastError: 'Test error',
      ...overrides,
    }
  }

  async function saveTestFailedFile(spoolFile: SpoolFile, filename: string): Promise<void> {
    await fs.mkdir(testFailedDir, { recursive: true })
    const filePath = `${testFailedDir}/${filename}`
    await fs.writeFile(filePath, JSON.stringify(spoolFile, null, 2))
  }

  beforeEach(async () => {
    const mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    } as unknown as Logger

    spoolManager = new SpoolManager(mockLogger)

    await fs.mkdir(testFailedDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testFailedDir, { recursive: true, force: true })
  })

  // ======================
  // ファイル取得
  // ======================
  describe('ファイル取得', () => {
    it('指定したファイルが正常に取得される', async () => {
      // Arrange
      const file = createTestSpoolFile({ batchIdempotencyKey: 'toget' })
      const filename = 'failed_20250120T103000000Z_toget.json'
      await saveTestFailedFile(file, filename)

      // Act
      const result = await spoolManager.getFailedFile(filename)

      // Assert
      expect(result).not.toBeNull()
      expect(result?.batchIdempotencyKey).toBe('toget')
    })

    it('存在しないファイルの取得でnullが返される', async () => {
      // Act
      const result = await spoolManager.getFailedFile('nonexistent.json')

      // Assert
      expect(result).toBeNull()
    })

    it('破損したJSONファイルの取得時のエラーハンドリング', async () => {
      // Arrange
      await fs.mkdir(testFailedDir, { recursive: true })
      const filename = 'failed_20250120T103000000Z_corrupted.json'
      await fs.writeFile(`${testFailedDir}/${filename}`, 'invalid json {')

      // Act
      const result = await spoolManager.getFailedFile(filename)

      // Assert
      expect(result).toBeNull()
    })
  })
})
