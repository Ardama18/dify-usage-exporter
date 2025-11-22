/**
 * listコマンド統合テスト - Design Doc: specs/stories/6-manual-resend-watermark/design.md
 * 生成日: 2025-11-22
 * テスト種別: Integration Test
 * 実装タイミング: Phase 1 - SpoolManager拡張 + listコマンド
 */

import { promises as fs } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Logger } from '../../../logger/winston-logger.js'
import { SpoolManager } from '../../../sender/spool-manager.js'
import type { SpoolFile } from '../../../types/spool.js'

describe('listコマンド統合テスト', { concurrent: false }, () => {
  let spoolManager: SpoolManager
  let mockLogger: Logger
  const testFailedDir = 'data/failed'

  // テストデータヘルパー
  function createTestSpoolFile(overrides: Partial<SpoolFile> = {}): SpoolFile {
    return {
      batchIdempotencyKey: `test-${Date.now()}`,
      records: [
        {
          date: '2025-01-20',
          app_id: 'test-app',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 80,
          output_tokens: 20,
          total_tokens: 100,
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
    mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    } as unknown as Logger

    spoolManager = new SpoolManager(mockLogger)

    // テストディレクトリ作成
    await fs.mkdir(testFailedDir, { recursive: true })
  })

  afterEach(async () => {
    // クリーンアップ
    await fs.rm(testFailedDir, { recursive: true, force: true })
  })

  // ======================
  // AC-LIST-1: 失敗ファイル一覧表示
  // ======================
  describe('AC-LIST-1: ファイル一覧表示', () => {
    it('AC-LIST-1: 失敗ディレクトリ内の全ファイルがリストとして返される', async () => {
      // Arrange
      const file1 = createTestSpoolFile({
        batchIdempotencyKey: 'batch1',
        firstAttempt: '2025-01-20T10:30:00.000Z',
      })
      const file2 = createTestSpoolFile({
        batchIdempotencyKey: 'batch2',
        firstAttempt: '2025-01-21T14:20:00.000Z',
      })

      await saveTestFailedFile(file1, 'failed_20250120T103000000Z_batch1.json')
      await saveTestFailedFile(file2, 'failed_20250121T142000000Z_batch2.json')

      // Act
      const result = await spoolManager.listFailedFiles()

      // Assert
      expect(result).toHaveLength(2)
      expect(result[0].batchIdempotencyKey).toBe('batch1')
      expect(result[1].batchIdempotencyKey).toBe('batch2')
    })

    it('AC-LIST-1-edge: 空の失敗ディレクトリで空配列が返される', async () => {
      // Arrange: ディレクトリは存在するがファイルなし
      await fs.mkdir(testFailedDir, { recursive: true })

      // Act
      const result = await spoolManager.listFailedFiles()

      // Assert
      expect(result).toEqual([])
    })

    it('AC-LIST-1-edge: JSON以外のファイルがディレクトリに存在する場合の動作', async () => {
      // Arrange
      await fs.mkdir(testFailedDir, { recursive: true })
      await fs.writeFile(`${testFailedDir}/readme.txt`, 'This is not JSON')

      const validFile = createTestSpoolFile({ batchIdempotencyKey: 'valid' })
      await saveTestFailedFile(validFile, 'failed_20250120T103000000Z_valid.json')

      // Act
      const result = await spoolManager.listFailedFiles()

      // Assert: 有効なファイルのみ返される
      expect(result).toHaveLength(1)
      expect(result[0].batchIdempotencyKey).toBe('valid')
    })
  })

  // ======================
  // AC-LIST-2: ファイル情報表示
  // ======================
  describe('AC-LIST-2: ファイル詳細情報', () => {
    it('AC-LIST-2: 各ファイルにファイル名、レコード数、初回試行日時、最終エラーが含まれる', async () => {
      // Arrange
      const testFile = createTestSpoolFile({
        batchIdempotencyKey: 'detail-test',
        firstAttempt: '2025-01-20T10:30:00.000Z',
        lastError: 'Test error message',
      })

      await saveTestFailedFile(testFile, 'failed_20250120T103000000Z_detail-test.json')

      // Act
      const result = await spoolManager.listFailedFiles()

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0].batchIdempotencyKey).toBe('detail-test')
      expect(result[0].records).toHaveLength(1)
      expect(result[0].firstAttempt).toBe('2025-01-20T10:30:00.000Z')
      expect(result[0].lastError).toBe('Test error message')
    })

    it('AC-LIST-2: レコード数が正確にカウントされている', async () => {
      // Arrange
      const testFile = createTestSpoolFile({
        batchIdempotencyKey: 'count-test',
        records: [
          {
            date: '2025-01-20',
            app_id: 'app1',
            provider: 'openai',
            model: 'gpt-4',
            input_tokens: 80,
            output_tokens: 20,
            total_tokens: 100,
            idempotency_key: 'key1',
            transformed_at: '2025-01-20T10:30:00.000Z',
          },
          {
            date: '2025-01-20',
            app_id: 'app2',
            provider: 'openai',
            model: 'gpt-4',
            input_tokens: 160,
            output_tokens: 40,
            total_tokens: 200,
            idempotency_key: 'key2',
            transformed_at: '2025-01-20T10:31:00.000Z',
          },
          {
            date: '2025-01-20',
            app_id: 'app3',
            provider: 'openai',
            model: 'gpt-4',
            input_tokens: 240,
            output_tokens: 60,
            total_tokens: 300,
            idempotency_key: 'key3',
            transformed_at: '2025-01-20T10:32:00.000Z',
          },
        ],
      })

      await saveTestFailedFile(testFile, 'failed_20250120T103000000Z_count-test.json')

      // Act
      const result = await spoolManager.listFailedFiles()

      // Assert
      expect(result[0].records).toHaveLength(3)
    })

    it('AC-LIST-2: firstAttemptがISO8601形式で取得される', async () => {
      // Arrange
      const testFile = createTestSpoolFile({
        firstAttempt: '2025-01-20T10:30:00.000Z',
      })

      await saveTestFailedFile(testFile, 'failed_20250120T103000000Z_iso8601.json')

      // Act
      const result = await spoolManager.listFailedFiles()

      // Assert
      expect(result[0].firstAttempt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)
    })

    it('AC-LIST-2: lastErrorがファイルから取得される', async () => {
      // Arrange
      const testFile = createTestSpoolFile({
        lastError: 'Network timeout error',
      })

      await saveTestFailedFile(testFile, 'failed_20250120T103000000Z_lasterror.json')

      // Act
      const result = await spoolManager.listFailedFiles()

      // Assert
      expect(result[0].lastError).toBe('Network timeout error')
    })
  })

  // ======================
  // AC-LIST-3: 空ディレクトリ時のメッセージ
  // ======================
  describe('AC-LIST-3: 空ディレクトリ処理', () => {
    it('AC-LIST-3: ファイルが存在しない場合に適切なレスポンスが返る', async () => {
      // Arrange: 空のディレクトリ
      await fs.mkdir(testFailedDir, { recursive: true })

      // Act
      const result = await spoolManager.listFailedFiles()

      // Assert
      expect(result).toEqual([])
      expect(result.length).toBe(0)
    })

    it('AC-LIST-3-edge: data/failed/ディレクトリが存在しない場合の動作', async () => {
      // Arrange: ディレクトリを削除
      try {
        await fs.rmdir(testFailedDir)
      } catch {
        // 既に存在しない場合は無視
      }

      // Act
      const result = await spoolManager.listFailedFiles()

      // Assert: エラーなしで空配列を返す
      expect(result).toEqual([])
    })
  })

  // ======================
  // AC-LIST-4: 合計表示
  // ======================
  describe('AC-LIST-4: 合計情報', () => {
    it('AC-LIST-4: 複数ファイルの合計ファイル数が正確に計算される', async () => {
      // Arrange
      const file1 = createTestSpoolFile({ batchIdempotencyKey: 'sum1' })
      const file2 = createTestSpoolFile({ batchIdempotencyKey: 'sum2' })
      const file3 = createTestSpoolFile({ batchIdempotencyKey: 'sum3' })

      await saveTestFailedFile(file1, 'failed_20250120T100000000Z_sum1.json')
      await saveTestFailedFile(file2, 'failed_20250120T110000000Z_sum2.json')
      await saveTestFailedFile(file3, 'failed_20250120T120000000Z_sum3.json')

      // Act
      const result = await spoolManager.listFailedFiles()

      // Assert
      expect(result).toHaveLength(3)
    })

    it('AC-LIST-4: 複数ファイルの合計レコード数が正確に計算される', async () => {
      // Arrange
      const file1 = createTestSpoolFile({
        batchIdempotencyKey: 'record1',
        records: [
          {
            date: '2025-01-20',
            app_id: 'app1',
            provider: 'openai',
            model: 'gpt-4',
            input_tokens: 80,
            output_tokens: 20,
            total_tokens: 100,
            idempotency_key: 'key1',
            transformed_at: '2025-01-20T10:30:00.000Z',
          },
          {
            date: '2025-01-20',
            app_id: 'app1',
            provider: 'openai',
            model: 'gpt-4',
            input_tokens: 160,
            output_tokens: 40,
            total_tokens: 200,
            idempotency_key: 'key2',
            transformed_at: '2025-01-20T10:31:00.000Z',
          },
        ],
      })
      const file2 = createTestSpoolFile({
        batchIdempotencyKey: 'record2',
        records: [
          {
            date: '2025-01-20',
            app_id: 'app2',
            provider: 'openai',
            model: 'gpt-4',
            input_tokens: 240,
            output_tokens: 60,
            total_tokens: 300,
            idempotency_key: 'key3',
            transformed_at: '2025-01-20T11:30:00.000Z',
          },
        ],
      })

      await saveTestFailedFile(file1, 'failed_20250120T100000000Z_record1.json')
      await saveTestFailedFile(file2, 'failed_20250120T110000000Z_record2.json')

      // Act
      const result = await spoolManager.listFailedFiles()

      // Assert
      const totalRecords = result.reduce((sum, file) => sum + file.records.length, 0)
      expect(totalRecords).toBe(3)
    })

    it('AC-LIST-4-edge: 1ファイルのみの場合の合計計算', async () => {
      // Arrange
      const singleFile = createTestSpoolFile({
        batchIdempotencyKey: 'single',
      })

      await saveTestFailedFile(singleFile, 'failed_20250120T103000000Z_single.json')

      // Act
      const result = await spoolManager.listFailedFiles()

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0].records).toHaveLength(1)
    })
  })
})

describe('SpoolManager.listFailedFiles 統合テスト', { concurrent: false }, () => {
  let spoolManager: SpoolManager
  let mockLogger: Logger
  const testFailedDir = 'data/failed'

  function createTestSpoolFile(overrides: Partial<SpoolFile> = {}): SpoolFile {
    return {
      batchIdempotencyKey: `test-${Date.now()}`,
      records: [
        {
          date: '2025-01-20',
          app_id: 'test-app',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 80,
          output_tokens: 20,
          total_tokens: 100,
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
    mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    } as unknown as Logger

    spoolManager = new SpoolManager(mockLogger)

    // テストディレクトリ作成
    await fs.mkdir(testFailedDir, { recursive: true })
  })

  afterEach(async () => {
    // クリーンアップ
    await fs.rm(testFailedDir, { recursive: true, force: true })
  })

  // ======================
  // ソート順の検証
  // ======================
  describe('ファイルソート', () => {
    it('ファイルがfirstAttempt昇順でソートされて返される', async () => {
      // Arrange: 日時順でない順序で保存
      const newer = createTestSpoolFile({
        batchIdempotencyKey: 'newer',
        firstAttempt: '2025-01-22T10:30:00.000Z',
      })
      const older = createTestSpoolFile({
        batchIdempotencyKey: 'older',
        firstAttempt: '2025-01-20T10:30:00.000Z',
      })
      const middle = createTestSpoolFile({
        batchIdempotencyKey: 'middle',
        firstAttempt: '2025-01-21T10:30:00.000Z',
      })

      await saveTestFailedFile(newer, 'failed_20250122T103000000Z_newer.json')
      await saveTestFailedFile(older, 'failed_20250120T103000000Z_older.json')
      await saveTestFailedFile(middle, 'failed_20250121T103000000Z_middle.json')

      // Act
      const result = await spoolManager.listFailedFiles()

      // Assert: firstAttempt昇順
      expect(result[0].batchIdempotencyKey).toBe('older')
      expect(result[1].batchIdempotencyKey).toBe('middle')
      expect(result[2].batchIdempotencyKey).toBe('newer')
    })

    it('同一firstAttemptのファイルの順序が安定している', async () => {
      // Arrange: 同じfirstAttemptのファイル
      const file1 = createTestSpoolFile({
        batchIdempotencyKey: 'same1',
        firstAttempt: '2025-01-20T10:30:00.000Z',
      })
      const file2 = createTestSpoolFile({
        batchIdempotencyKey: 'same2',
        firstAttempt: '2025-01-20T10:30:00.000Z',
      })

      await saveTestFailedFile(file1, 'failed_20250120T103000000Z_same1.json')
      await saveTestFailedFile(file2, 'failed_20250120T103000000Z_same2.json')

      // Act
      const result = await spoolManager.listFailedFiles()

      // Assert: 順序が安定している（エラーなし）
      expect(result).toHaveLength(2)
      const keys = result.map((f) => f.batchIdempotencyKey)
      expect(keys).toContain('same1')
      expect(keys).toContain('same2')
    })
  })

  // ======================
  // ファイル読み込みエラー
  // ======================
  describe('エラーハンドリング', () => {
    it('破損したJSONファイルが存在する場合にスキップされる', async () => {
      // Arrange
      await fs.mkdir(testFailedDir, { recursive: true })
      await fs.writeFile(
        `${testFailedDir}/failed_20250120T100000000Z_corrupted.json`,
        'invalid json {',
      )

      const validFile = createTestSpoolFile({ batchIdempotencyKey: 'valid' })
      await saveTestFailedFile(validFile, 'failed_20250120T110000000Z_valid.json')

      // Act
      const result = await spoolManager.listFailedFiles()

      // Assert: 有効なファイルのみ返される
      expect(result).toHaveLength(1)
      expect(result[0].batchIdempotencyKey).toBe('valid')
    })

    it('スキーマ不正のファイルが存在する場合にスキップされる', async () => {
      // Arrange
      await fs.mkdir(testFailedDir, { recursive: true })
      // スキーマに合わないJSONを作成
      await fs.writeFile(
        `${testFailedDir}/failed_20250120T100000000Z_invalid.json`,
        JSON.stringify({ invalidField: 'invalid' }),
      )

      const validFile = createTestSpoolFile({ batchIdempotencyKey: 'valid' })
      await saveTestFailedFile(validFile, 'failed_20250120T110000000Z_valid.json')

      // Act
      const result = await spoolManager.listFailedFiles()

      // Assert: 有効なファイルのみ返される
      expect(result).toHaveLength(1)
      expect(result[0].batchIdempotencyKey).toBe('valid')
    })
  })
})
