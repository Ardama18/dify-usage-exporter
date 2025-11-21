---
story_id: 4
title: external-api-sender
epic_id: 1
type: task
feature: external-api-sender
phase: 2
task_number: 002
version: 1.0.0
created: 2025-01-21
based_on: specs/stories/4-external-api-sender/plan.md
---

# タスク: SpoolManagerクラス実装と単体テスト作成

## メタ情報
- 依存:
  - phase0-001（型定義） → 成果物: src/types/spool.ts
  - phase2-001（ファイル操作ユーティリティ） → 成果物: src/utils/file-utils.ts
- 提供:
  - src/sender/spool-manager.ts
  - src/sender/__tests__/spool-manager.test.ts
- サイズ: 中規模（1ファイル、複雑なロジック）
- 確認レベル: L2（モジュール統合テスト）

## 実装内容
SpoolManagerクラス実装（saveToSpool, loadFromSpool, deleteSpoolFile, moveToFailed, updateSpoolFile）、単体テスト作成。

## 対象ファイル
- [x] src/sender/spool-manager.ts（新規作成）
- [x] src/sender/__tests__/spool-manager.test.ts（新規作成）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [x] 依存成果物の確認
  - src/types/spool.ts（SpoolFile型、SpoolFileSchema）
  - src/utils/file-utils.ts（writeFileAtomic, setPermission600）
- [x] 失敗するテストを作成
  - saveToSpool()のテスト（ファイル保存、パーミッション600確認）
  - listSpoolFiles()のテスト（firstAttempt昇順ソート確認）
  - deleteSpoolFile()のテスト（ファイル削除確認）
  - moveToFailed()のテスト（data/failed/移動確認）
  - updateSpoolFile()のテスト（retryCount更新確認）
  - 破損ファイルのdata/failed/移動テスト
- [x] テスト実行して失敗を確認
  ```bash
  cd backend && npm run test:unit -- src/sender/__tests__/spool-manager.test.ts
  ```

### 2. Green Phase
- [x] SpoolManagerクラス実装
  - saveToSpool(): スプールファイル保存（writeFileAtomic使用）
  - listSpoolFiles(): スプールファイル読み込み（firstAttempt昇順ソート、zodバリデーション）
  - deleteSpoolFile(): スプールファイル削除
  - moveToFailed(): data/failed/へ移動
  - updateSpoolFile(): retryCount更新（削除→再保存）
- [x] 追加したテストのみ実行して通ることを確認

### 3. Refactor Phase
- [x] コード整理（メソッド分離、エラーハンドリング）
- [x] zodバリデーションエラーの詳細ログ
- [x] 追加したテストが引き続き通ることを確認

## 完了条件
- [x] 追加したテストが全てパス
- [x] TypeScript strict mode: エラー0件
  ```bash
  cd backend && npm run build
  ```
- [x] Biome lint: エラー0件
  ```bash
  cd backend && npm run check
  ```
- [x] 動作確認完了（L2: モジュール統合テスト）
  ```bash
  cd backend && npm run test:unit -- src/sender/__tests__/spool-manager.test.ts
  ```
- [x] 成果物作成完了
  - src/sender/spool-manager.ts

## 実装サンプル

### SpoolManagerクラス（src/sender/spool-manager.ts）
```typescript
import { promises as fs } from 'node:fs'
import type { Logger } from 'winston'
import type { SpoolFile } from '../types/spool.js'
import { SpoolFileSchema } from '../types/spool.js'
import { writeFileAtomic } from '../utils/file-utils.js'

export class SpoolManager {
  private readonly spoolDir = 'data/spool'
  private readonly failedDir = 'data/failed'

  constructor(private readonly logger: Logger) {}

  async saveToSpool(spoolFile: SpoolFile): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '')
    const fileName = `spool_${timestamp}_${spoolFile.batchIdempotencyKey}.json`
    const filePath = `${this.spoolDir}/${fileName}`

    await writeFileAtomic(filePath, JSON.stringify(spoolFile, null, 2), 0o600)

    this.logger.info('Spool file saved', { filePath, recordCount: spoolFile.records.length })
  }

  async listSpoolFiles(): Promise<SpoolFile[]> {
    try {
      await fs.access(this.spoolDir)
    } catch {
      // ディレクトリが存在しない場合は空配列を返す
      return []
    }

    const files = await fs.readdir(this.spoolDir)
    const spoolFiles: SpoolFile[] = []

    for (const file of files) {
      if (!file.startsWith('spool_')) continue

      const filePath = `${this.spoolDir}/${file}`
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const data = JSON.parse(content)

        // zodバリデーション
        const parseResult = SpoolFileSchema.safeParse(data)
        if (!parseResult.success) {
          this.logger.error('Corrupted spool file detected', {
            filePath,
            error: parseResult.error.format()
          })
          // 破損ファイルをdata/failed/へ移動
          await this.moveToFailed(data)
          continue
        }

        spoolFiles.push(parseResult.data)
      } catch (error) {
        this.logger.error('Failed to read spool file', { filePath, error })
      }
    }

    // firstAttempt昇順でソート（古いデータ優先）
    return spoolFiles.sort((a, b) =>
      new Date(a.firstAttempt).getTime() - new Date(b.firstAttempt).getTime()
    )
  }

  async deleteSpoolFile(batchKey: string): Promise<void> {
    const files = await fs.readdir(this.spoolDir)
    for (const file of files) {
      if (file.includes(batchKey)) {
        const filePath = `${this.spoolDir}/${file}`
        await fs.unlink(filePath)
        this.logger.info('Spool file deleted', { filePath })
      }
    }
  }

  async updateSpoolFile(spoolFile: SpoolFile): Promise<void> {
    await this.deleteSpoolFile(spoolFile.batchIdempotencyKey)
    await this.saveToSpool(spoolFile)
    this.logger.info('Spool file updated', {
      batchKey: spoolFile.batchIdempotencyKey,
      retryCount: spoolFile.retryCount
    })
  }

  async moveToFailed(spoolFile: SpoolFile): Promise<void> {
    // data/failed/ディレクトリ作成
    await fs.mkdir(this.failedDir, { recursive: true })

    // ファイル移動
    const timestamp = new Date().toISOString().replace(/[:.]/g, '')
    const fileName = `failed_${timestamp}_${spoolFile.batchIdempotencyKey}.json`
    const filePath = `${this.failedDir}/${fileName}`

    await writeFileAtomic(filePath, JSON.stringify(spoolFile, null, 2), 0o600)

    // スプールファイル削除
    await this.deleteSpoolFile(spoolFile.batchIdempotencyKey)

    this.logger.info('Moved to failed', { filePath })
  }
}
```

### テストサンプル（src/sender/__tests__/spool-manager.test.ts）
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import type { Logger } from 'winston'
import { SpoolManager } from '../spool-manager.js'
import type { SpoolFile } from '../../types/spool.js'

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
      debug: vi.fn()
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
            appId: 'app-1',
            provider: 'openai',
            model: 'gpt-4',
            totalTokens: 100,
            promptTokens: 80,
            completionTokens: 20,
            totalCalls: 1,
            idempotencyKey: 'key-1'
          }
        ],
        firstAttempt: new Date().toISOString(),
        retryCount: 0,
        lastError: ''
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
        lastError: ''
      }

      const spoolFile2: SpoolFile = {
        batchIdempotencyKey: 'batch-2',
        records: [],
        firstAttempt: '2025-01-21T09:00:00Z',
        retryCount: 0,
        lastError: ''
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
        lastError: ''
      }

      await fs.writeFile(
        `${testSpoolDir}/spool_corrupted.json`,
        JSON.stringify(corruptedFile),
        { mode: 0o600 }
      )

      const spoolFiles = await spoolManager.listSpoolFiles()

      expect(spoolFiles).toHaveLength(0)
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Corrupted spool file detected',
        expect.objectContaining({
          filePath: `${testSpoolDir}/spool_corrupted.json`
        })
      )

      // data/failed/へ移動されていることを確認
      const failedFiles = await fs.readdir(testFailedDir)
      expect(failedFiles.length).toBeGreaterThan(0)
    })
  })

  describe('deleteSpoolFile', () => {
    it('should delete spool file by batch key', async () => {
      const spoolFile: SpoolFile = {
        batchIdempotencyKey: 'delete-test',
        records: [],
        firstAttempt: new Date().toISOString(),
        retryCount: 0,
        lastError: ''
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
        lastError: ''
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
        lastError: 'Max retries exceeded'
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
```

## 注意事項
- **zodバリデーション**: 破損ファイルは必ずdata/failed/へ移動
- **firstAttempt昇順ソート**: 古いデータから優先的に再送
- **パーミッション600**: セキュリティのため必ず設定
- **影響範囲**: 新規ファイル作成のみ、既存コードへの影響なし
