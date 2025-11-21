---
story_id: 4
title: external-api-sender
epic_id: 1
type: task
feature: external-api-sender
phase: 2
task_number: 001
version: 1.0.0
created: 2025-01-21
based_on: specs/stories/4-external-api-sender/plan.md
---

# タスク: ファイル操作ユーティリティ実装

## メタ情報
- 依存: phase0-001（型定義）
- 提供:
  - src/utils/file-utils.ts
  - src/utils/__tests__/file-utils.test.ts
- サイズ: 小規模（1ファイル）
- 確認レベル: L1（単体テスト実行）

## 実装内容
パーミッション600設定関数、アトミックファイル書き込み関数を実装する。

## 対象ファイル
- [ ] src/utils/file-utils.ts（新規作成）
- [ ] src/utils/__tests__/file-utils.test.ts（新規作成）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [ ] 失敗するテストを作成
  - writeFileAtomic()のテスト（一時ファイル作成→リネーム）
  - setPermission600()のテスト（パーミッション確認）
  - エラーケース（ディレクトリ作成失敗、書き込み失敗）
- [ ] テスト実行して失敗を確認
  ```bash
  cd backend && npm run test:unit -- src/utils/__tests__/file-utils.test.ts
  ```

### 2. Green Phase
- [ ] ファイル操作ユーティリティ実装
  - writeFileAtomic(): 一時ファイルへ書き込み→リネーム
  - setPermission600(): fs.chmod()でパーミッション設定
  - ensureDirectory(): ディレクトリ作成（recursive）
- [ ] 追加したテストのみ実行して通ることを確認

### 3. Refactor Phase
- [ ] コード整理（関数の分離、エラーハンドリング）
- [ ] 追加したテストが引き続き通ることを確認

## 完了条件
- [ ] 追加したテストが全てパス
- [ ] TypeScript strict mode: エラー0件
  ```bash
  cd backend && npm run build
  ```
- [ ] Biome lint: エラー0件
  ```bash
  cd backend && npm run check
  ```
- [ ] 動作確認完了（L1: 単体テスト実行）
  ```bash
  cd backend && npm run test:unit -- src/utils/__tests__/file-utils.test.ts
  ```
- [ ] 成果物作成完了
  - src/utils/file-utils.ts

## 実装サンプル

### ファイル操作ユーティリティ（src/utils/file-utils.ts）
```typescript
import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'

/**
 * アトミックファイル書き込み
 * @param filePath - 書き込み先ファイルパス
 * @param content - 書き込み内容
 * @param mode - ファイルパーミッション（デフォルト: 0o600）
 */
export async function writeFileAtomic(
  filePath: string,
  content: string,
  mode: number = 0o600
): Promise<void> {
  const tempPath = `${filePath}.tmp`

  try {
    // ディレクトリ作成
    await ensureDirectory(dirname(filePath))

    // 一時ファイルへ書き込み
    await fs.writeFile(tempPath, content, { mode })

    // リネーム（アトミック操作）
    await fs.rename(tempPath, filePath)
  } catch (error) {
    // 失敗時は一時ファイル削除
    try {
      await fs.unlink(tempPath)
    } catch {
      // 削除失敗は無視
    }
    throw error
  }
}

/**
 * パーミッション600設定
 * @param filePath - ファイルパス
 */
export async function setPermission600(filePath: string): Promise<void> {
  await fs.chmod(filePath, 0o600)
}

/**
 * ディレクトリ作成（存在しない場合）
 * @param dirPath - ディレクトリパス
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true })
}
```

### テストサンプル（src/utils/__tests__/file-utils.test.ts）
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import { writeFileAtomic, setPermission600, ensureDirectory } from '../file-utils.js'

describe('FileUtils', () => {
  const testDir = 'tmp/test-file-utils'
  const testFile = `${testDir}/test.json`

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe('writeFileAtomic', () => {
    it('should write file atomically with permission 600', async () => {
      const content = JSON.stringify({ test: 'data' })

      await writeFileAtomic(testFile, content)

      // ファイル存在確認
      const stat = await fs.stat(testFile)
      expect(stat.isFile()).toBe(true)

      // パーミッション確認（600 = rw-------）
      const mode = stat.mode & 0o777
      expect(mode).toBe(0o600)

      // 内容確認
      const readContent = await fs.readFile(testFile, 'utf-8')
      expect(readContent).toBe(content)
    })

    it('should create directory if not exists', async () => {
      const nestedFile = `${testDir}/nested/deep/test.json`
      const content = JSON.stringify({ test: 'data' })

      await writeFileAtomic(nestedFile, content)

      const stat = await fs.stat(nestedFile)
      expect(stat.isFile()).toBe(true)
    })

    it('should remove temp file on error', async () => {
      const invalidPath = '/invalid/path/test.json'

      await expect(writeFileAtomic(invalidPath, 'test')).rejects.toThrow()

      // 一時ファイルが残っていないことを確認
      const tempPath = `${invalidPath}.tmp`
      await expect(fs.access(tempPath)).rejects.toThrow()
    })
  })

  describe('setPermission600', () => {
    it('should set permission to 600', async () => {
      await fs.writeFile(testFile, 'test', { mode: 0o644 })

      await setPermission600(testFile)

      const stat = await fs.stat(testFile)
      const mode = stat.mode & 0o777
      expect(mode).toBe(0o600)
    })
  })

  describe('ensureDirectory', () => {
    it('should create directory if not exists', async () => {
      const nestedDir = `${testDir}/nested/deep`

      await ensureDirectory(nestedDir)

      const stat = await fs.stat(nestedDir)
      expect(stat.isDirectory()).toBe(true)
    })

    it('should not throw if directory already exists', async () => {
      await ensureDirectory(testDir)
      await expect(ensureDirectory(testDir)).resolves.toBeUndefined()
    })
  })
})
```

## 注意事項
- **アトミック操作**: 書き込み失敗時にファイルが破損しないよう一時ファイルを使用
- **パーミッション**: セキュリティのため必ず600（所有者のみ読み書き）
- **エラーハンドリング**: 一時ファイル削除失敗は無視（すでに削除されている可能性）
- **影響範囲**: 新規ファイル作成のみ、既存コードへの影響なし
