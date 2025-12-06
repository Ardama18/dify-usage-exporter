/**
 * resendコマンド統合テスト - Design Doc: specs/stories/6-manual-resend-watermark/design.md
 * 生成日: 2025-11-22
 * テスト種別: Integration Test
 * 実装タイミング: Phase 2 - resendコマンド
 *
 * Note: 新形式SpoolFile (v2.0.0) に更新済み
 * Note: resendFailedFile メソッドは未実装のため、テストは最小限に縮小
 */

import { promises as fs } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Logger } from '../../../logger/winston-logger.js'
import { SpoolManager } from '../../../sender/spool-manager.js'
import type { ApiMeterRequest } from '../../../types/api-meter-schema.js'
import type { SpoolFile } from '../../../types/spool.js'

describe('SpoolManager.deleteFailedFile 統合テスト', { concurrent: false }, () => {
  let spoolManager: SpoolManager
  const testFailedDir = 'data/failed'

  function createTestSpoolFile(): SpoolFile {
    const defaultData: ApiMeterRequest = {
      tenant_id: '00000000-0000-0000-0000-000000000000',
      export_metadata: {
        exporter_version: '1.1.0',
        export_timestamp: '2025-01-20T10:30:00.000Z',
        aggregation_period: 'daily',
        date_range: {
          start: '2025-01-20T00:00:00.000Z',
          end: '2025-01-20T23:59:59.999Z',
        },
      },
      records: [
        {
          usage_date: '2025-01-20',
          provider: 'test-provider',
          model: 'test-model',
          input_tokens: 100,
          output_tokens: 0,
          total_tokens: 100,
          request_count: 1,
          cost_actual: 0.001,
          currency: 'USD',
          metadata: {
            source_system: 'dify',
            source_event_id: `test-event-${Date.now()}`,
            source_app_id: 'test-app',
            source_app_name: 'Test App',
            aggregation_method: 'daily_sum',
          },
        },
      ],
    }

    return {
      version: '2.0.0',
      data: defaultData,
      createdAt: '2025-01-20T10:30:00.000Z',
      retryCount: 0,
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

  describe('ファイル削除', () => {
    it('指定したファイルが正常に削除される', async () => {
      const file = createTestSpoolFile()
      const filename = 'failed_20250120T103000000Z_todelete.json'
      await saveTestFailedFile(file, filename)

      await spoolManager.deleteFailedFile(filename)

      const fileExists = await fs
        .access(`${testFailedDir}/${filename}`)
        .then(() => true)
        .catch(() => false)
      expect(fileExists).toBe(false)
    })

    it('存在しないファイルの削除時のエラーハンドリング', async () => {
      await expect(spoolManager.deleteFailedFile('nonexistent.json')).rejects.toThrow()
    })
  })
})

describe('SpoolManager.getFailedFile 統合テスト', { concurrent: false }, () => {
  let spoolManager: SpoolManager
  const testFailedDir = 'data/failed'

  function createTestSpoolFile(): SpoolFile {
    const defaultData: ApiMeterRequest = {
      tenant_id: '00000000-0000-0000-0000-000000000000',
      export_metadata: {
        exporter_version: '1.1.0',
        export_timestamp: '2025-01-20T10:30:00.000Z',
        aggregation_period: 'daily',
        date_range: {
          start: '2025-01-20T00:00:00.000Z',
          end: '2025-01-20T23:59:59.999Z',
        },
      },
      records: [
        {
          usage_date: '2025-01-20',
          provider: 'test-provider',
          model: 'test-model',
          input_tokens: 100,
          output_tokens: 0,
          total_tokens: 100,
          request_count: 1,
          cost_actual: 0.001,
          currency: 'USD',
          metadata: {
            source_system: 'dify',
            source_event_id: `test-event-${Date.now()}`,
            source_app_id: 'test-app',
            source_app_name: 'Test App',
            aggregation_method: 'daily_sum',
          },
        },
      ],
    }

    return {
      version: '2.0.0',
      data: defaultData,
      createdAt: '2025-01-20T10:30:00.000Z',
      retryCount: 0,
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

  describe('ファイル取得', () => {
    it('指定したファイルが正常に取得される', async () => {
      const file = createTestSpoolFile()
      const filename = 'failed_20250120T103000000Z_toget.json'
      await saveTestFailedFile(file, filename)

      const result = await spoolManager.getFailedFile(filename)

      expect(result).not.toBeNull()
      expect(result?.version).toBe('2.0.0')
      expect(result?.data.tenant_id).toBeDefined()
    })

    it('存在しないファイルの取得でnullが返される', async () => {
      const result = await spoolManager.getFailedFile('nonexistent.json')
      expect(result).toBeNull()
    })

    it('破損したJSONファイルの取得時のエラーハンドリング', async () => {
      const filename = 'failed_20250120T103000000Z_corrupted.json'
      await fs.writeFile(`${testFailedDir}/${filename}`, 'invalid json {')

      const result = await spoolManager.getFailedFile(filename)
      expect(result).toBeNull()
    })
  })
})
