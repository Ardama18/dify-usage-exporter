---
story_id: "3"
title: data-transformation
epic_id: "1"
type: task
feature: transform
task_number: 005
version: 1.0.0
created: 2025-11-21
based_on: specs/stories/3-data-transformation/plan.md
---

# タスク: バッチ冪等キー生成と単体テスト作成

メタ情報:
- 依存: task-transform-phase2-004 -> 成果物: src/transformer/idempotency-key.ts（レコードキー部分）
- 提供: src/transformer/idempotency-key.ts（バッチキー部分追加）
- サイズ: 小規模（1ファイル更新）

## 実装内容

バッチ単位の冪等キーを生成する関数を実装する。全レコードのキーをソートしてSHA256ハッシュを生成。

### AC対応
- AC3（バッチ単位冪等キー）

## 対象ファイル

- [x] src/transformer/idempotency-key.ts（追加）
- [x] test/unit/transformer/idempotency-key.test.ts（追加）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase

- [x] task-004の成果物（src/transformer/idempotency-key.ts）が存在することを確認
- [x] 既存のテストファイルにバッチキー部分のテストケースを追加:
  - 空配列で空文字列を返却
  - ソートによる順序非依存性検証
  - SHA256形式（64文字16進数）の確認
  - 単一レコードでも正常動作
  - 大量レコード（1000件）でも正常動作
  - 重複レコード含むバッチでの決定性
- [x] テスト実行して失敗を確認
  ```bash
  npm run test:unit -- test/unit/transformer/idempotency-key.test.ts
  ```

### 2. Green Phase

- [x] `src/transformer/idempotency-key.ts` にgenerateBatchIdempotencyKeyを追加:
  ```typescript
  import crypto from 'crypto'

  export function generateBatchIdempotencyKey(recordKeys: string[]): string {
    if (recordKeys.length === 0) {
      return ''
    }

    // ソートして順序に依存しない決定的なキー生成
    const sorted = [...recordKeys].sort()
    const concatenated = sorted.join(',')

    return crypto.createHash('sha256').update(concatenated).digest('hex')
  }
  ```
- [x] テスト実行して通ることを確認
  ```bash
  npm run test:unit -- test/unit/transformer/idempotency-key.test.ts
  ```

### 3. Refactor Phase

- [x] 必要に応じてコード改善
- [x] テストが引き続き通ることを確認

## テストケース詳細

```typescript
import { describe, it, expect } from 'vitest'
import {
  generateBatchIdempotencyKey,
} from '../../../src/transformer/idempotency-key.js'

describe('generateBatchIdempotencyKey', () => {
  describe('正常系', () => {
    it('should return empty string for empty array', () => {
      const result = generateBatchIdempotencyKey([])

      expect(result).toBe('')
    })

    it('should generate SHA256 hash (64 hex characters)', () => {
      const keys = ['key1', 'key2', 'key3']

      const result = generateBatchIdempotencyKey(keys)

      expect(result).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should return same hash for same keys regardless of order', () => {
      const keys1 = ['key1', 'key2', 'key3']
      const keys2 = ['key3', 'key1', 'key2']

      const result1 = generateBatchIdempotencyKey(keys1)
      const result2 = generateBatchIdempotencyKey(keys2)

      expect(result1).toBe(result2)
    })

    it('should handle single record', () => {
      const keys = ['single-key']

      const result = generateBatchIdempotencyKey(keys)

      expect(result).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should handle large number of records (1000)', () => {
      const keys = Array.from({ length: 1000 }, (_, i) => `key-${i}`)

      const result = generateBatchIdempotencyKey(keys)

      expect(result).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should return deterministic result for duplicate keys', () => {
      const keys1 = ['key1', 'key1', 'key2']
      const keys2 = ['key1', 'key1', 'key2']

      const result1 = generateBatchIdempotencyKey(keys1)
      const result2 = generateBatchIdempotencyKey(keys2)

      expect(result1).toBe(result2)
    })

    it('should return different hash for different keys', () => {
      const keys1 = ['key1', 'key2']
      const keys2 = ['key1', 'key3']

      const result1 = generateBatchIdempotencyKey(keys1)
      const result2 = generateBatchIdempotencyKey(keys2)

      expect(result1).not.toBe(result2)
    })
  })
})
```

## 完了条件

- [x] 追加したテストが全てパス
- [x] TypeScript strict mode: エラー0件
  ```bash
  npx tsc --noEmit
  ```
- [x] Biome lint: エラー0件
  ```bash
  npm run check
  ```
- [x] 動作確認完了（L2: 単体テスト実行）
  ```bash
  npm run test:unit -- test/unit/transformer/idempotency-key.test.ts
  ```

## 注意事項

- 影響範囲: 既存のidempotency-key.tsに追加するが、既存関数への影響なし
- 制約: SHA256ハッシュ（64文字16進数）を使用
- Node.js標準のcryptoモジュールを使用
