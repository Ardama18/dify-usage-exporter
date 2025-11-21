import { promises as fs } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Logger } from 'winston'
import type { SpoolFile } from '../../types/spool.js'
import { SpoolManager } from '../spool-manager.js'

describe('SpoolManager', () => {
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
            provider: 'openai',
            model: 'gpt-4',
            total_tokens: 100,
            input_tokens: 80,
            output_tokens: 20,
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
})
