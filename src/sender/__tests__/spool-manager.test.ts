import { promises as fs } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Logger } from 'winston'
import type { ApiMeterRequest } from '../../types/api-meter-schema.js'
import type { ExternalApiRecord } from '../../types/external-api.js'
import type { LegacySpoolFile, SpoolFile } from '../../types/spool.js'
import { SpoolManager } from '../spool-manager.js'

// 環境変数を設定（有効なUUID形式を使用）
const TEST_TENANT_ID = '123e4567-e89b-12d3-a456-426614174000'
process.env.API_METER_TENANT_ID = TEST_TENANT_ID
process.env.API_METER_TOKEN = 'test-api-key'
process.env.API_METER_URL = 'https://api.example.com'
process.env.DIFY_API_BASE_URL = 'https://dify.example.com'
process.env.DIFY_EMAIL = 'test@example.com'
process.env.DIFY_PASSWORD = 'test-password'
process.env.EXTERNAL_API_URL = 'https://external.example.com'
process.env.EXTERNAL_API_TOKEN = 'test-external-token'

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

  describe('saveToSpool (new format)', () => {
    it('should save new format spool file (ApiMeterRequest)', async () => {
      const apiMeterRequest: ApiMeterRequest = {
        tenant_id: TEST_TENANT_ID,
        export_metadata: {
          exporter_version: '1.1.0',
          export_timestamp: new Date().toISOString(),
          aggregation_period: 'daily',
          source_system: 'dify',
          date_range: {
            start: '2025-01-21T00:00:00Z',
            end: '2025-01-21T23:59:59Z',
          },
        },
        records: [
          {
            usage_date: '2025-01-21',
            provider: 'openai',
            model: 'gpt-4-0613',
            input_tokens: 100,
            output_tokens: 50,
            total_tokens: 150,
            request_count: 1,
            cost_actual: 0.001,
            currency: 'USD',
            metadata: {
              source_system: 'dify',
              source_event_id: 'event-1',
              aggregation_method: 'daily_sum',
            },
          },
        ],
      }

      const filename = await spoolManager.save(apiMeterRequest)

      expect(filename).toMatch(/^spool-\d+\.json$/)

      const files = await fs.readdir(testSpoolDir)
      expect(files).toHaveLength(1)

      // ファイル内容確認
      const content = await fs.readFile(`${testSpoolDir}/${files[0]}`, 'utf-8')
      const savedData = JSON.parse(content) as SpoolFile

      expect(savedData.version).toBe('2.0.0')
      expect(savedData.data.tenant_id).toBe(TEST_TENANT_ID)
      expect(savedData.data.records).toHaveLength(1)
      expect(savedData.retryCount).toBe(0)
    })
  })

  describe('listSpoolFiles', () => {
    it('should list spool files sorted by createdAt (new format)', async () => {
      const apiMeterRequest1: ApiMeterRequest = {
        tenant_id: TEST_TENANT_ID,
        export_metadata: {
          exporter_version: '1.1.0',
          export_timestamp: new Date().toISOString(),
          aggregation_period: 'daily',
          source_system: 'dify',
          date_range: {
            start: '2025-01-21T00:00:00Z',
            end: '2025-01-21T23:59:59Z',
          },
        },
        records: [
          {
            usage_date: '2025-01-21',
            provider: 'openai',
            model: 'gpt-4-0613',
            input_tokens: 100,
            output_tokens: 50,
            total_tokens: 150,
            request_count: 1,
            cost_actual: 0.001,
            currency: 'USD',
            metadata: {
              source_system: 'dify',
              source_event_id: 'event-1',
              aggregation_method: 'daily_sum',
            },
          },
        ],
      }

      const apiMeterRequest2: ApiMeterRequest = {
        ...apiMeterRequest1,
        records: [
          {
            ...apiMeterRequest1.records[0],
            metadata: {
              ...apiMeterRequest1.records[0].metadata,
              source_event_id: 'event-2',
            },
          },
        ],
      }

      const filename1 = await spoolManager.save(apiMeterRequest1)
      // タイムスタンプの重複を防ぐため十分に待機
      await new Promise((resolve) => setTimeout(resolve, 10))
      const filename2 = await spoolManager.save(apiMeterRequest2)

      // ファイルが実際に作成されているか確認
      const files = await fs.readdir(testSpoolDir)
      expect(files).toContain(filename1)
      expect(files).toContain(filename2)

      const spoolFiles = await spoolManager.listSpoolFiles()

      expect(spoolFiles).toHaveLength(2)
      // createdAt昇順でソート（古い方が先）
      expect(spoolFiles[0].data.records[0].metadata.source_event_id).toBe('event-1')
      expect(spoolFiles[1].data.records[0].metadata.source_event_id).toBe('event-2')
    })

    it('should move corrupted files to failed directory', async () => {
      // 破損ファイル作成（zodバリデーション失敗、新形式だが不正なデータ）
      const corruptedFile = {
        version: '2.0.0',
        data: 'invalid-data', // ApiMeterRequestではない
        createdAt: '2025-01-21T10:00:00Z',
        retryCount: 0,
      }

      await fs.writeFile(`${testSpoolDir}/spool-corrupted.json`, JSON.stringify(corruptedFile), {
        mode: 0o600,
      })

      const spoolFiles = await spoolManager.listSpoolFiles()

      expect(spoolFiles).toHaveLength(0)
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Corrupted spool file detected',
        expect.objectContaining({
          filePath: expect.stringContaining('spool-corrupted.json'),
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
    it('should delete spool file by filename', async () => {
      const apiMeterRequest: ApiMeterRequest = {
        tenant_id: TEST_TENANT_ID,
        export_metadata: {
          exporter_version: '1.1.0',
          export_timestamp: new Date().toISOString(),
          aggregation_period: 'daily',
          source_system: 'dify',
          date_range: {
            start: '2025-01-21T00:00:00Z',
            end: '2025-01-21T23:59:59Z',
          },
        },
        records: [
          {
            usage_date: '2025-01-21',
            provider: 'openai',
            model: 'gpt-4-0613',
            input_tokens: 100,
            output_tokens: 50,
            total_tokens: 150,
            request_count: 1,
            cost_actual: 0.001,
            currency: 'USD',
            metadata: {
              source_system: 'dify',
              source_event_id: 'delete-test-event',
              aggregation_method: 'daily_sum',
            },
          },
        ],
      }

      const filename = await spoolManager.save(apiMeterRequest)
      await spoolManager.deleteSpoolFile(filename)

      const files = await fs.readdir(testSpoolDir)
      expect(files).toHaveLength(0)
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

    it('should list failed files sorted by createdAt (new format)', async () => {
      const apiMeterRequest1: ApiMeterRequest = {
        tenant_id: TEST_TENANT_ID,
        export_metadata: {
          exporter_version: '1.1.0',
          export_timestamp: '2025-01-21T10:00:00Z',
          aggregation_period: 'daily',
          source_system: 'dify',
          date_range: {
            start: '2025-01-21T00:00:00Z',
            end: '2025-01-21T23:59:59Z',
          },
        },
        records: [
          {
            usage_date: '2025-01-21',
            provider: 'openai',
            model: 'gpt-4-0613',
            input_tokens: 100,
            output_tokens: 50,
            total_tokens: 150,
            request_count: 1,
            cost_actual: 0.001,
            currency: 'USD',
            metadata: {
              source_system: 'dify',
              source_event_id: 'failed-1',
              aggregation_method: 'daily_sum',
            },
          },
        ],
      }

      const apiMeterRequest2: ApiMeterRequest = {
        ...apiMeterRequest1,
        export_metadata: {
          ...apiMeterRequest1.export_metadata,
          export_timestamp: '2025-01-21T09:00:00Z',
        },
        records: [
          {
            ...apiMeterRequest1.records[0],
            metadata: {
              ...apiMeterRequest1.records[0].metadata,
              source_event_id: 'failed-2',
            },
          },
        ],
      }

      const spoolFile1: SpoolFile = {
        version: '2.0.0',
        data: apiMeterRequest1,
        createdAt: '2025-01-21T10:00:00Z',
        retryCount: 10,
      }

      const spoolFile2: SpoolFile = {
        version: '2.0.0',
        data: apiMeterRequest2,
        createdAt: '2025-01-21T09:00:00Z',
        retryCount: 10,
      }

      // failed ディレクトリに直接ファイルを作成
      await fs.writeFile(
        `${testFailedDir}/failed-20250121T100000Z-1.json`,
        JSON.stringify(spoolFile1),
        { mode: 0o600 },
      )
      await fs.writeFile(
        `${testFailedDir}/failed-20250121T090000Z-2.json`,
        JSON.stringify(spoolFile2),
        { mode: 0o600 },
      )

      const failedFiles = await spoolManager.listFailedFiles()

      expect(failedFiles).toHaveLength(2)
      // createdAt昇順でソート（古い方が先）
      expect(failedFiles[0].data.records[0].metadata.source_event_id).toBe('failed-2')
      expect(failedFiles[1].data.records[0].metadata.source_event_id).toBe('failed-1')
    })

    it('should skip invalid JSON files', async () => {
      // 無効なJSONファイル
      await fs.writeFile(`${testFailedDir}/failed-invalid.json`, 'invalid json', { mode: 0o600 })

      // 有効なファイル
      const validRequest: ApiMeterRequest = {
        tenant_id: TEST_TENANT_ID,
        export_metadata: {
          exporter_version: '1.1.0',
          export_timestamp: '2025-01-21T10:00:00Z',
          aggregation_period: 'daily',
          source_system: 'dify',
          date_range: {
            start: '2025-01-21T00:00:00Z',
            end: '2025-01-21T23:59:59Z',
          },
        },
        records: [
          {
            usage_date: '2025-01-21',
            provider: 'openai',
            model: 'gpt-4-0613',
            input_tokens: 100,
            output_tokens: 50,
            total_tokens: 150,
            request_count: 1,
            cost_actual: 0.001,
            currency: 'USD',
            metadata: {
              source_system: 'dify',
              source_event_id: 'valid',
              aggregation_method: 'daily_sum',
            },
          },
        ],
      }

      const validFile: SpoolFile = {
        version: '2.0.0',
        data: validRequest,
        createdAt: '2025-01-21T10:00:00Z',
        retryCount: 10,
      }

      await fs.writeFile(`${testFailedDir}/failed-valid.json`, JSON.stringify(validFile), {
        mode: 0o600,
      })

      const failedFiles = await spoolManager.listFailedFiles()

      expect(failedFiles).toHaveLength(1)
      expect(failedFiles[0].data.records[0].metadata.source_event_id).toBe('valid')
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to read failed file',
        expect.objectContaining({
          filePath: `${testFailedDir}/failed-invalid.json`,
        }),
      )
    })

    it('should skip files that fail zod validation', async () => {
      // zodバリデーション失敗ファイル（新形式だが不正なデータ）
      const invalidSchema = {
        version: '2.0.0',
        data: 'not-an-api-meter-request', // ApiMeterRequestではない
        createdAt: '2025-01-21T10:00:00Z',
        retryCount: 10,
      }
      await fs.writeFile(
        `${testFailedDir}/failed-invalid-schema.json`,
        JSON.stringify(invalidSchema),
        { mode: 0o600 },
      )

      const failedFiles = await spoolManager.listFailedFiles()

      expect(failedFiles).toHaveLength(0)
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid failed file schema',
        expect.objectContaining({
          filePath: expect.stringContaining('failed-invalid-schema.json'),
        }),
      )
    })
  })

  describe('deleteFailedFile', () => {
    it('should delete failed file by filename', async () => {
      const apiMeterRequest: ApiMeterRequest = {
        tenant_id: TEST_TENANT_ID,
        export_metadata: {
          exporter_version: '1.1.0',
          export_timestamp: '2025-01-21T10:00:00Z',
          aggregation_period: 'daily',
          source_system: 'dify',
          date_range: {
            start: '2025-01-21T00:00:00Z',
            end: '2025-01-21T23:59:59Z',
          },
        },
        records: [],
      }

      const spoolFile: SpoolFile = {
        version: '2.0.0',
        data: apiMeterRequest,
        createdAt: new Date().toISOString(),
        retryCount: 10,
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
    it('should get failed file by filename (new format)', async () => {
      const apiMeterRequest: ApiMeterRequest = {
        tenant_id: TEST_TENANT_ID,
        export_metadata: {
          exporter_version: '1.1.0',
          export_timestamp: '2025-01-21T10:00:00Z',
          aggregation_period: 'daily',
          source_system: 'dify',
          date_range: {
            start: '2025-01-21T00:00:00Z',
            end: '2025-01-21T23:59:59Z',
          },
        },
        records: [
          {
            usage_date: '2025-01-21',
            provider: 'openai',
            model: 'gpt-4-0613',
            input_tokens: 100,
            output_tokens: 50,
            total_tokens: 150,
            request_count: 1,
            cost_actual: 0.001,
            currency: 'USD',
            metadata: {
              source_system: 'dify',
              source_event_id: 'get-failed-test',
              aggregation_method: 'daily_sum',
            },
          },
        ],
      }

      const spoolFile: SpoolFile = {
        version: '2.0.0',
        data: apiMeterRequest,
        createdAt: '2025-01-21T10:00:00Z',
        retryCount: 10,
      }

      const filename = 'failed-20250121T100000Z-test.json'
      await fs.writeFile(`${testFailedDir}/${filename}`, JSON.stringify(spoolFile), { mode: 0o600 })

      const result = await spoolManager.getFailedFile(filename)

      expect(result).not.toBeNull()
      expect(result?.data.records[0].metadata.source_event_id).toBe('get-failed-test')
      expect(result?.data.records).toHaveLength(1)
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
          filePath: expect.stringContaining('failed_invalid-schema.json'),
        }),
      )
    })
  })

  describe('Legacy spool file conversion', () => {
    it('should detect legacy spool file and convert to new format', async () => {
      // 旧形式スプールファイル (ExternalApiRecord[])
      const legacyRecord: ExternalApiRecord = {
        date: '2025-01-21',
        app_id: 'app-1',
        app_name: 'Test App',
        token_count: 150,
        total_price: '0.001',
        currency: 'USD',
        idempotency_key: 'legacy-key-1',
        transformed_at: '2025-01-21T10:00:00Z',
      }

      const legacySpoolFile: LegacySpoolFile = {
        version: '1.0.0',
        data: [legacyRecord],
        createdAt: '2025-01-21T10:00:00Z',
        retryCount: 0,
      }

      // 旧形式ファイルを保存
      const filename = 'spool-legacy-test.json'
      await fs.writeFile(`${testSpoolDir}/${filename}`, JSON.stringify(legacySpoolFile), 'utf-8')

      // loadで読み込むと自動変換される
      const result = await spoolManager.load(filename)

      // 新形式に変換されている
      expect(result.tenant_id).toBe(TEST_TENANT_ID)
      expect(result.records).toHaveLength(1)
      expect(result.records[0].provider).toBe('unknown')
      expect(result.records[0].model).toBe('unknown')
      expect(result.records[0].usage_date).toBe('2025-01-21')
      expect(result.records[0].total_tokens).toBe(150)
      expect(result.records[0].input_tokens).toBe(150) // 旧形式ではすべてinput_tokensに設定
      expect(result.records[0].output_tokens).toBe(0)

      // 旧形式ファイルは削除されている
      const files = await fs.readdir(testSpoolDir)
      const legacyFileExists = files.includes(filename)
      expect(legacyFileExists).toBe(false)

      // 新形式ファイルが保存されている
      expect(files.length).toBeGreaterThan(0)
    })

    it('should move legacy spool file to failed directory if conversion fails', async () => {
      // 不正な旧形式ファイル（変換できない）
      const invalidLegacyFile = {
        version: '1.0.0',
        data: [
          {
            date: 'invalid-date-format', // 不正な日付
            app_id: 'app-1',
            app_name: 'Test App',
            token_count: 'not-a-number', // 不正な数値
            total_price: '0.001',
            currency: 'USD',
            idempotency_key: 'key-1',
            transformed_at: 'invalid-datetime', // 不正な日時
          },
        ],
        createdAt: '2025-01-21T10:00:00Z',
        retryCount: 0,
      }

      const filename = 'spool-invalid-legacy.json'
      await fs.writeFile(`${testSpoolDir}/${filename}`, JSON.stringify(invalidLegacyFile), 'utf-8')

      // 変換失敗時はエラーがスローされる
      await expect(spoolManager.load(filename)).rejects.toThrow()

      // failedディレクトリへ移動されている
      const failedFiles = await fs.readdir(testFailedDir)
      expect(failedFiles.length).toBeGreaterThan(0)

      // スプールディレクトリからは削除されている
      const spoolFiles = await fs.readdir(testSpoolDir)
      const fileExists = spoolFiles.includes(filename)
      expect(fileExists).toBe(false)
    })

    it('should handle legacy spool file without version field', async () => {
      // version フィールドなしの旧形式（v1.0.0以前）
      const legacyRecord: ExternalApiRecord = {
        date: '2025-01-21',
        app_id: 'app-1',
        app_name: 'Test App',
        token_count: 100,
        total_price: '0.001',
        currency: 'USD',
        idempotency_key: 'key-1',
        transformed_at: '2025-01-21T10:00:00Z',
      }

      const legacySpoolFileNoVersion = {
        // version フィールドなし
        data: [legacyRecord],
        createdAt: '2025-01-21T10:00:00Z',
        retryCount: 0,
      }

      const filename = 'spool-no-version.json'
      await fs.writeFile(
        `${testSpoolDir}/${filename}`,
        JSON.stringify(legacySpoolFileNoVersion),
        'utf-8',
      )

      // 変換成功
      const result = await spoolManager.load(filename)

      expect(result.tenant_id).toBe(TEST_TENANT_ID)
      expect(result.records).toHaveLength(1)
    })

    it('should move unrecognized format to failed directory', async () => {
      // 新形式でも旧形式でもないファイル
      const unrecognizedFile = {
        version: '3.0.0', // 未知のバージョン
        data: 'invalid-data',
        createdAt: '2025-01-21T10:00:00Z',
        retryCount: 0,
      }

      const filename = 'spool-unrecognized.json'
      await fs.writeFile(`${testSpoolDir}/${filename}`, JSON.stringify(unrecognizedFile), 'utf-8')

      // エラーがスローされる
      await expect(spoolManager.load(filename)).rejects.toThrow('Invalid spool file format')

      // failedディレクトリへ移動されている
      const failedFiles = await fs.readdir(testFailedDir)
      expect(failedFiles.length).toBeGreaterThan(0)
    })
  })
})
