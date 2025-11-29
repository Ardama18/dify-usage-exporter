import { promises as fs } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Logger } from 'winston'
import type { SpoolFile } from '../../types/spool.js'
import { SpoolManager } from '../spool-manager.js'

describe('SpoolManager', { concurrent: false }, () => {
  let spoolManager: SpoolManager
  let mockLogger: Logger
  const testSpoolDir = 'data/spool'
  const testFailedDir = 'data/failed'

  beforeEach(async () => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    } as unknown as Logger

    spoolManager = new SpoolManager(mockLogger)

    // テストディレクトリ作成
    await fs.mkdir(testSpoolDir, { recursive: true })
    await fs.mkdir(testFailedDir, { recursive: true })
  })

  afterEach(async () => {
    // クリーンアップ
    await fs.rm(testSpoolDir, { recursive: true, force: true })
    await fs.rm(testFailedDir, { recursive: true, force: true })
  })

  describe('saveToSpool', () => {
    it('should save spool file with permission 600', async () => {
      const spoolFile: SpoolFile = {
        batchIdempotencyKey: 'test-batch-key',
        records: [
          {
            date: '2025-01-21',
            app_id: 'app-1',
            app_name: 'Test App',
            token_count: 100,
            total_price: '0.001',
            currency: 'USD',
            idempotency_key: 'key-1',
            transformed_at: new Date().toISOString(),
          },
        ],
        firstAttempt: new Date().toISOString(),
        retryCount: 0,
        lastError: '',
      }

      await spoolManager.saveToSpool(spoolFile)

      const files = await fs.readdir(testSpoolDir)
      expect(files).toHaveLength(1)
      expect(files[0]).toMatch(/^spool_.*_test-batch-key\.json$/)

      // パーミッション確認
      const stat = await fs.stat(`${testSpoolDir}/${files[0]}`)
      const mode = stat.mode & 0o777
      expect(mode).toBe(0o600)
    })
  })

  describe('listSpoolFiles', () => {
    it('should list spool files sorted by firstAttempt', async () => {
      const spoolFile1: SpoolFile = {
        batchIdempotencyKey: 'batch-1',
        records: [],
        firstAttempt: '2025-01-21T10:00:00Z',
        retryCount: 0,
        lastError: '',
      }

      const spoolFile2: SpoolFile = {
        batchIdempotencyKey: 'batch-2',
        records: [],
        firstAttempt: '2025-01-21T09:00:00Z',
        retryCount: 0,
        lastError: '',
      }

      await spoolManager.saveToSpool(spoolFile1)
      // タイムスタンプの重複を防ぐため1ms待機
      await new Promise((resolve) => setTimeout(resolve, 1))
      await spoolManager.saveToSpool(spoolFile2)

      const spoolFiles = await spoolManager.listSpoolFiles()

      expect(spoolFiles).toHaveLength(2)
      expect(spoolFiles[0].batchIdempotencyKey).toBe('batch-2') // 古い方が先
      expect(spoolFiles[1].batchIdempotencyKey).toBe('batch-1')
    })

    it('should move corrupted files to failed directory', async () => {
      // 破損ファイル作成（zodバリデーション失敗）
      const corruptedFile = {
        batchIdempotencyKey: 'corrupted',
        records: 'invalid', // 配列ではない
        firstAttempt: '2025-01-21T10:00:00Z',
        retryCount: 0,
        lastError: '',
      }

      await fs.writeFile(`${testSpoolDir}/spool_corrupted.json`, JSON.stringify(corruptedFile), {
        mode: 0o600,
      })

      const spoolFiles = await spoolManager.listSpoolFiles()

      expect(spoolFiles).toHaveLength(0)
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Corrupted spool file detected',
        expect.objectContaining({
          filePath: `${testSpoolDir}/spool_corrupted.json`,
        }),
      )

      // data/failed/へ移動されていることを確認
      const failedFiles = await fs.readdir(testFailedDir)
      expect(failedFiles.length).toBeGreaterThan(0)
    })

    it('should return empty array if spool directory does not exist', async () => {
      // ディレクトリを削除
      await fs.rm(testSpoolDir, { recursive: true, force: true })

      const spoolFiles = await spoolManager.listSpoolFiles()

      expect(spoolFiles).toHaveLength(0)
    })
  })

  describe('deleteSpoolFile', () => {
    it('should delete spool file by batch key', async () => {
      const spoolFile: SpoolFile = {
        batchIdempotencyKey: 'delete-test',
        records: [],
        firstAttempt: new Date().toISOString(),
        retryCount: 0,
        lastError: '',
      }

      await spoolManager.saveToSpool(spoolFile)
      await spoolManager.deleteSpoolFile('delete-test')

      const files = await fs.readdir(testSpoolDir)
      expect(files).toHaveLength(0)
    })
  })

  describe('updateSpoolFile', () => {
    it('should update spool file with new retryCount', async () => {
      const spoolFile: SpoolFile = {
        batchIdempotencyKey: 'update-test',
        records: [],
        firstAttempt: new Date().toISOString(),
        retryCount: 0,
        lastError: '',
      }

      await spoolManager.saveToSpool(spoolFile)

      spoolFile.retryCount = 5
      await spoolManager.updateSpoolFile(spoolFile)

      const spoolFiles = await spoolManager.listSpoolFiles()
      expect(spoolFiles).toHaveLength(1)
      expect(spoolFiles[0].retryCount).toBe(5)
    })
  })

  describe('moveToFailed', () => {
    it('should move spool file to failed directory', async () => {
      const spoolFile: SpoolFile = {
        batchIdempotencyKey: 'failed-test',
        records: [],
        firstAttempt: new Date().toISOString(),
        retryCount: 10,
        lastError: 'Max retries exceeded',
      }

      await spoolManager.saveToSpool(spoolFile)
      await spoolManager.moveToFailed(spoolFile)

      // スプールディレクトリからは削除
      const spoolFiles = await fs.readdir(testSpoolDir)
      expect(spoolFiles).toHaveLength(0)

      // data/failed/へ移動
      const failedFiles = await fs.readdir(testFailedDir)
      expect(failedFiles.length).toBeGreaterThan(0)
      expect(failedFiles[0]).toMatch(/^failed_.*_failed-test\.json$/)
    })
  })

  describe('listFailedFiles', () => {
    it('should return empty array when failed directory is empty', async () => {
      const failedFiles = await spoolManager.listFailedFiles()
      expect(failedFiles).toHaveLength(0)
    })

    it('should return empty array when failed directory does not exist', async () => {
      // ディレクトリを削除
      await fs.rm(testFailedDir, { recursive: true, force: true })

      const failedFiles = await spoolManager.listFailedFiles()
      expect(failedFiles).toHaveLength(0)
    })

    it('should list failed files sorted by firstAttempt', async () => {
      const spoolFile1: SpoolFile = {
        batchIdempotencyKey: 'failed-1',
        records: [],
        firstAttempt: '2025-01-21T10:00:00Z',
        retryCount: 10,
        lastError: 'Error 1',
      }

      const spoolFile2: SpoolFile = {
        batchIdempotencyKey: 'failed-2',
        records: [],
        firstAttempt: '2025-01-21T09:00:00Z',
        retryCount: 10,
        lastError: 'Error 2',
      }

      // failed ディレクトリに直接ファイルを作成
      await fs.writeFile(
        `${testFailedDir}/failed_20250121T100000Z_failed-1.json`,
        JSON.stringify(spoolFile1),
        { mode: 0o600 },
      )
      await fs.writeFile(
        `${testFailedDir}/failed_20250121T090000Z_failed-2.json`,
        JSON.stringify(spoolFile2),
        { mode: 0o600 },
      )

      const failedFiles = await spoolManager.listFailedFiles()

      expect(failedFiles).toHaveLength(2)
      expect(failedFiles[0].batchIdempotencyKey).toBe('failed-2') // 古い方が先
      expect(failedFiles[1].batchIdempotencyKey).toBe('failed-1')
    })

    it('should skip invalid JSON files', async () => {
      // 無効なJSONファイル
      await fs.writeFile(`${testFailedDir}/failed_invalid.json`, 'invalid json', { mode: 0o600 })

      // 有効なファイル
      const validFile: SpoolFile = {
        batchIdempotencyKey: 'valid',
        records: [],
        firstAttempt: '2025-01-21T10:00:00Z',
        retryCount: 10,
        lastError: 'Error',
      }
      await fs.writeFile(`${testFailedDir}/failed_valid.json`, JSON.stringify(validFile), {
        mode: 0o600,
      })

      const failedFiles = await spoolManager.listFailedFiles()

      expect(failedFiles).toHaveLength(1)
      expect(failedFiles[0].batchIdempotencyKey).toBe('valid')
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to read failed file',
        expect.objectContaining({
          filePath: `${testFailedDir}/failed_invalid.json`,
        }),
      )
    })

    it('should skip files that fail zod validation', async () => {
      // zodバリデーション失敗ファイル
      const invalidSchema = {
        batchIdempotencyKey: 'invalid-schema',
        records: 'not-an-array', // 配列ではない
        firstAttempt: '2025-01-21T10:00:00Z',
        retryCount: 10,
        lastError: 'Error',
      }
      await fs.writeFile(
        `${testFailedDir}/failed_invalid-schema.json`,
        JSON.stringify(invalidSchema),
        { mode: 0o600 },
      )

      const failedFiles = await spoolManager.listFailedFiles()

      expect(failedFiles).toHaveLength(0)
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid failed file schema',
        expect.objectContaining({
          filePath: `${testFailedDir}/failed_invalid-schema.json`,
        }),
      )
    })
  })

  describe('deleteFailedFile', () => {
    it('should delete failed file by filename', async () => {
      const spoolFile: SpoolFile = {
        batchIdempotencyKey: 'delete-failed-test',
        records: [],
        firstAttempt: new Date().toISOString(),
        retryCount: 10,
        lastError: 'Error',
      }

      const filename = 'failed_20250121T100000Z_delete-failed-test.json'
      await fs.writeFile(`${testFailedDir}/${filename}`, JSON.stringify(spoolFile), { mode: 0o600 })

      await spoolManager.deleteFailedFile(filename)

      const files = await fs.readdir(testFailedDir)
      expect(files).toHaveLength(0)
      expect(mockLogger.info).toHaveBeenCalledWith('Failed file deleted', {
        filePath: `${testFailedDir}/${filename}`,
      })
    })

    it('should throw error when file does not exist', async () => {
      await expect(spoolManager.deleteFailedFile('nonexistent.json')).rejects.toThrow('ENOENT')
    })
  })

  describe('getFailedFile', () => {
    it('should get failed file by filename', async () => {
      const spoolFile: SpoolFile = {
        batchIdempotencyKey: 'get-failed-test',
        records: [
          {
            date: '2025-01-21',
            app_id: 'app-1',
            app_name: 'Test App',
            token_count: 100,
            total_price: '0.001',
            currency: 'USD',
            idempotency_key: 'key-1',
            transformed_at: new Date().toISOString(),
          },
        ],
        firstAttempt: '2025-01-21T10:00:00Z',
        retryCount: 10,
        lastError: 'Error',
      }

      const filename = 'failed_20250121T100000Z_get-failed-test.json'
      await fs.writeFile(`${testFailedDir}/${filename}`, JSON.stringify(spoolFile), { mode: 0o600 })

      const result = await spoolManager.getFailedFile(filename)

      expect(result).not.toBeNull()
      expect(result?.batchIdempotencyKey).toBe('get-failed-test')
      expect(result?.records).toHaveLength(1)
    })

    it('should return null when file does not exist', async () => {
      const result = await spoolManager.getFailedFile('nonexistent.json')
      expect(result).toBeNull()
    })

    it('should return null for invalid JSON', async () => {
      const filename = 'failed_invalid.json'
      await fs.writeFile(`${testFailedDir}/${filename}`, 'invalid json', { mode: 0o600 })

      const result = await spoolManager.getFailedFile(filename)

      expect(result).toBeNull()
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to read failed file',
        expect.objectContaining({
          filePath: `${testFailedDir}/${filename}`,
        }),
      )
    })

    it('should return null for invalid schema', async () => {
      const invalidSchema = {
        batchIdempotencyKey: 'invalid',
        records: 'not-an-array',
        firstAttempt: '2025-01-21T10:00:00Z',
        retryCount: 10,
        lastError: 'Error',
      }
      const filename = 'failed_invalid-schema.json'
      await fs.writeFile(`${testFailedDir}/${filename}`, JSON.stringify(invalidSchema), {
        mode: 0o600,
      })

      const result = await spoolManager.getFailedFile(filename)

      expect(result).toBeNull()
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid failed file schema',
        expect.objectContaining({
          filePath: `${testFailedDir}/${filename}`,
        }),
      )
    })
  })
})
