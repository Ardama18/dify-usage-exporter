/**
 * listコマンド統合テスト - Design Doc: specs/stories/6-manual-resend-watermark/design.md
 * 生成日: 2025-11-22
 * テスト種別: Integration Test
 * 実装タイミング: Phase 1 - SpoolManager拡張 + listコマンド
 *
 * Note: 新形式SpoolFile (v2.0.0) に更新済み
 */

import { promises as fs } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Logger } from '../../../logger/winston-logger.js'
import { SpoolManager } from '../../../sender/spool-manager.js'
import type { ApiMeterRequest } from '../../../types/api-meter-schema.js'
import type { SpoolFile } from '../../../types/spool.js'

describe('listコマンド統合テスト (新形式)', { concurrent: false }, () => {
  let spoolManager: SpoolManager
  let mockLogger: Logger
  const testFailedDir = 'data/failed'

  // テストデータヘルパー (新形式 SpoolFile)
  function createTestSpoolFile(overrides: Partial<SpoolFile> = {}): SpoolFile {
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
      data: overrides.data || defaultData,
      createdAt: overrides.createdAt || '2025-01-20T10:30:00.000Z',
      retryCount: overrides.retryCount ?? 0,
    }
  }

  async function saveTestFailedFile(spoolFile: SpoolFile, filename: string): Promise<void> {
    await fs.mkdir(testFailedDir, { recursive: true })
    const filePath = `${testFailedDir}/${filename}`
    await fs.writeFile(filePath, JSON.stringify(spoolFile, null, 2))
  }

  beforeEach(async () => {
    mockLogger = {
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

  describe('AC-LIST-1: ファイル一覧表示', () => {
    it('失敗ディレクトリ内の全ファイルがリストとして返される', async () => {
      const file1 = createTestSpoolFile({ createdAt: '2025-01-20T10:30:00.000Z' })
      const file2 = createTestSpoolFile({ createdAt: '2025-01-21T14:20:00.000Z' })

      await saveTestFailedFile(file1, 'failed_20250120T103000000Z_batch1.json')
      await saveTestFailedFile(file2, 'failed_20250121T142000000Z_batch2.json')

      const result = await spoolManager.listFailedFiles()

      expect(result).toHaveLength(2)
      expect(result[0].data.tenant_id).toBeDefined()
      expect(result[1].data.tenant_id).toBeDefined()
    })

    it('空の失敗ディレクトリで空配列が返される', async () => {
      const result = await spoolManager.listFailedFiles()
      expect(result).toEqual([])
    })

    it('JSON以外のファイルはスキップされる', async () => {
      await fs.writeFile(`${testFailedDir}/readme.txt`, 'This is not JSON')
      const validFile = createTestSpoolFile()
      await saveTestFailedFile(validFile, 'failed_20250120T103000000Z_valid.json')

      const result = await spoolManager.listFailedFiles()

      expect(result).toHaveLength(1)
      expect(result[0].version).toBe('2.0.0')
    })
  })

  describe('AC-LIST-2: ファイル詳細情報', () => {
    it('レコード数が正確にカウントされる', async () => {
      const testFile = createTestSpoolFile()
      await saveTestFailedFile(testFile, 'failed_20250120T103000000Z_count-test.json')

      const result = await spoolManager.listFailedFiles()

      expect(result[0].data.records).toHaveLength(1)
    })

    it('createdAtがISO8601形式で取得される', async () => {
      const testFile = createTestSpoolFile({
        createdAt: '2025-01-20T10:30:00.000Z',
      })
      await saveTestFailedFile(testFile, 'failed_20250120T103000000Z_iso8601.json')

      const result = await spoolManager.listFailedFiles()

      expect(result[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)
    })
  })

  describe('AC-LIST-3: 空ディレクトリ処理', () => {
    it('ファイルが存在しない場合に空配列が返る', async () => {
      const result = await spoolManager.listFailedFiles()

      expect(result).toEqual([])
      expect(result.length).toBe(0)
    })

    it('ディレクトリが存在しない場合でもエラーなく空配列を返す', async () => {
      try {
        await fs.rmdir(testFailedDir)
      } catch {
        // 既に存在しない場合は無視
      }

      const result = await spoolManager.listFailedFiles()
      expect(result).toEqual([])
    })
  })

  describe('AC-LIST-4: 合計情報', () => {
    it('複数ファイルの合計ファイル数が正確に計算される', async () => {
      const file1 = createTestSpoolFile()
      const file2 = createTestSpoolFile()
      const file3 = createTestSpoolFile()

      await saveTestFailedFile(file1, 'failed_20250120T100000000Z_sum1.json')
      await saveTestFailedFile(file2, 'failed_20250120T110000000Z_sum2.json')
      await saveTestFailedFile(file3, 'failed_20250120T120000000Z_sum3.json')

      const result = await spoolManager.listFailedFiles()
      expect(result).toHaveLength(3)
    })

    it('複数ファイルの合計レコード数が正確に計算される', async () => {
      const file1 = createTestSpoolFile()
      const file2 = createTestSpoolFile()

      await saveTestFailedFile(file1, 'failed_20250120T100000000Z_record1.json')
      await saveTestFailedFile(file2, 'failed_20250120T110000000Z_record2.json')

      const result = await spoolManager.listFailedFiles()
      const totalRecords = result.reduce((sum, file) => sum + file.data.records.length, 0)
      expect(totalRecords).toBe(2)
    })
  })

  describe('ファイルソート', () => {
    it('ファイルがcreatedAt昇順でソートされる', async () => {
      const newer = createTestSpoolFile({ createdAt: '2025-01-22T10:30:00.000Z' })
      const older = createTestSpoolFile({ createdAt: '2025-01-20T10:30:00.000Z' })
      const middle = createTestSpoolFile({ createdAt: '2025-01-21T10:30:00.000Z' })

      await saveTestFailedFile(newer, 'failed_20250122T103000000Z_newer.json')
      await saveTestFailedFile(older, 'failed_20250120T103000000Z_older.json')
      await saveTestFailedFile(middle, 'failed_20250121T103000000Z_middle.json')

      const result = await spoolManager.listFailedFiles()

      expect(result[0].createdAt).toBe('2025-01-20T10:30:00.000Z')
      expect(result[1].createdAt).toBe('2025-01-21T10:30:00.000Z')
      expect(result[2].createdAt).toBe('2025-01-22T10:30:00.000Z')
    })
  })

  describe('エラーハンドリング', () => {
    it('破損したJSONファイルはスキップされる', async () => {
      await fs.writeFile(
        `${testFailedDir}/failed_20250120T100000000Z_corrupted.json`,
        'invalid json {',
      )
      const validFile = createTestSpoolFile()
      await saveTestFailedFile(validFile, 'failed_20250120T110000000Z_valid.json')

      const result = await spoolManager.listFailedFiles()

      expect(result).toHaveLength(1)
      expect(result[0].version).toBe('2.0.0')
    })

    it('スキーマ不正のファイルはスキップされる', async () => {
      await fs.writeFile(
        `${testFailedDir}/failed_20250120T100000000Z_invalid.json`,
        JSON.stringify({ invalidField: 'invalid' }),
      )
      const validFile = createTestSpoolFile()
      await saveTestFailedFile(validFile, 'failed_20250120T110000000Z_valid.json')

      const result = await spoolManager.listFailedFiles()

      expect(result).toHaveLength(1)
      expect(result[0].version).toBe('2.0.0')
    })
  })
})
