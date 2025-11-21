---
story_id: "3"
title: data-transformation
epic_id: "1"
type: task
feature: transform
task_number: 003
version: 1.0.0
created: 2025-11-21
based_on: specs/stories/3-data-transformation/plan.md
---

# タスク: 日時ユーティリティ実装と単体テスト作成

メタ情報:
- 依存: なし（独立したユーティリティ）
- 提供: src/utils/date-utils.ts
- サイズ: 小規模（2ファイル）

## 実装内容

date-fnsを使用した日時ユーティリティ関数を実装し、単体テストを作成する。ISO 8601形式の日時文字列を生成する。

### AC対応
- AC1-2（transformed_at付与）

## 対象ファイル

- [x] src/utils/date-utils.ts
- [x] test/unit/utils/date-utils.test.ts

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase

- [x] date-fnsパッケージをインストール
  ```bash
  npm install date-fns
  ```
- [x] テストファイル `test/unit/utils/date-utils.test.ts` を作成
- [x] 以下のテストケースを記述:
  - getCurrentISOTimestampがISO 8601形式を返す
  - formatDateToISOが正しい形式に変換
- [x] テスト実行して失敗を確認
  ```bash
  npm run test:unit -- test/unit/utils/date-utils.test.ts
  ```

### 2. Green Phase

- [x] `src/utils/date-utils.ts` を作成
- [x] 以下の関数を実装:
  ```typescript
  import { formatISO } from 'date-fns'

  export function getCurrentISOTimestamp(): string {
    return formatISO(new Date())
  }

  export function formatDateToISO(date: Date): string {
    return formatISO(date, { representation: 'complete' })
  }
  ```
- [x] テスト実行して通ることを確認
  ```bash
  npm run test:unit -- test/unit/utils/date-utils.test.ts
  ```

### 3. Refactor Phase

- [x] 必要に応じてコード改善
- [x] テストが引き続き通ることを確認

## テストケース詳細

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getCurrentISOTimestamp, formatDateToISO } from '../../../src/utils/date-utils.js'

describe('date-utils', () => {
  describe('getCurrentISOTimestamp', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return ISO 8601 formatted timestamp', () => {
      const mockDate = new Date('2025-01-15T10:30:00.000Z')
      vi.setSystemTime(mockDate)

      const result = getCurrentISOTimestamp()

      // ISO 8601形式であることを確認
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('should include timezone information', () => {
      const mockDate = new Date('2025-01-15T10:30:00.000Z')
      vi.setSystemTime(mockDate)

      const result = getCurrentISOTimestamp()

      // タイムゾーン情報（+00:00 or Z）が含まれることを確認
      expect(result).toMatch(/(\+\d{2}:\d{2}|Z)$/)
    })
  })

  describe('formatDateToISO', () => {
    it('should format Date object to ISO 8601 string', () => {
      const date = new Date('2025-01-15T10:30:00.000Z')

      const result = formatDateToISO(date)

      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('should handle different dates correctly', () => {
      const date1 = new Date('2025-06-01T00:00:00.000Z')
      const date2 = new Date('2025-12-31T23:59:59.000Z')

      const result1 = formatDateToISO(date1)
      const result2 = formatDateToISO(date2)

      expect(result1).toContain('2025-06-01')
      expect(result2).toContain('2025-12-31')
    })

    it('should return complete ISO format with time', () => {
      const date = new Date('2025-01-15T14:30:45.000Z')

      const result = formatDateToISO(date)

      // 時刻情報が含まれることを確認
      expect(result).toMatch(/T\d{2}:\d{2}:\d{2}/)
    })
  })
})
```

## 完了条件

- [x] date-fnsパッケージがインストール済み
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
  npm run test:unit -- test/unit/utils/date-utils.test.ts
  ```

## 注意事項

- 影響範囲: このタスクは新規ファイル追加のため、既存コードへの影響なし
- 制約: date-fns v3 APIを使用（v2との互換性に注意）
- タイムゾーンはシステムのローカルタイムゾーンを使用
