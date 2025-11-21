---
story_id: "3"
title: data-transformation
epic_id: "1"
type: task
feature: transform
task_number: 004
version: 1.0.0
created: 2025-11-21
based_on: specs/stories/3-data-transformation/plan.md
---

# タスク: レコード冪等キー生成と単体テスト作成

メタ情報:
- 依存: task-transform-phase1-002 -> 成果物: src/interfaces/transformer.ts
- 提供: src/transformer/idempotency-key.ts（レコードキー部分）
- サイズ: 小規模（2ファイル）

## 実装内容

レコード単位の冪等キーを生成する関数を実装する。キー形式は`{date}_{app_id}_{provider}_{model}`。

### AC対応
- AC2（レコード単位冪等キー）

## 対象ファイル

- [ ] src/transformer/idempotency-key.ts
- [ ] test/unit/transformer/idempotency-key.test.ts

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase

- [ ] transformerディレクトリを作成
  ```bash
  mkdir -p src/transformer
  ```
- [ ] テストディレクトリを作成
  ```bash
  mkdir -p test/unit/transformer
  ```
- [ ] テストファイル `test/unit/transformer/idempotency-key.test.ts` を作成
- [ ] 以下のテストケースを記述（レコードキー部分のみ）:
  - 正常パラメータで`{date}_{app_id}_{provider}_{model}`形式生成
  - 同一入力に対して同一キー生成（冪等性）
  - 異なる入力に対して異なるキー生成（一意性）
- [ ] テスト実行して失敗を確認
  ```bash
  npm run test:unit -- test/unit/transformer/idempotency-key.test.ts
  ```

### 2. Green Phase

- [ ] `src/transformer/idempotency-key.ts` を作成
- [ ] RecordKeyParams型とgenerateRecordIdempotencyKey関数を実装:
  ```typescript
  export interface RecordKeyParams {
    date: string
    app_id: string
    provider: string
    model: string
  }

  export function generateRecordIdempotencyKey(params: RecordKeyParams): string {
    return `${params.date}_${params.app_id}_${params.provider}_${params.model}`
  }
  ```
- [ ] テスト実行して通ることを確認
  ```bash
  npm run test:unit -- test/unit/transformer/idempotency-key.test.ts
  ```

### 3. Refactor Phase

- [ ] 必要に応じてコード改善
- [ ] テストが引き続き通ることを確認

## テストケース詳細

```typescript
import { describe, it, expect } from 'vitest'
import {
  generateRecordIdempotencyKey,
  type RecordKeyParams,
} from '../../../src/transformer/idempotency-key.js'

describe('generateRecordIdempotencyKey', () => {
  describe('正常系', () => {
    it('should generate key in correct format', () => {
      const params: RecordKeyParams = {
        date: '2025-01-01',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
      }

      const result = generateRecordIdempotencyKey(params)

      expect(result).toBe('2025-01-01_app-123_openai_gpt-4')
    })

    it('should return same key for same input (idempotency)', () => {
      const params: RecordKeyParams = {
        date: '2025-01-01',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
      }

      const result1 = generateRecordIdempotencyKey(params)
      const result2 = generateRecordIdempotencyKey(params)

      expect(result1).toBe(result2)
    })

    it('should return different key for different input (uniqueness)', () => {
      const params1: RecordKeyParams = {
        date: '2025-01-01',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
      }
      const params2: RecordKeyParams = {
        date: '2025-01-02',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
      }

      const result1 = generateRecordIdempotencyKey(params1)
      const result2 = generateRecordIdempotencyKey(params2)

      expect(result1).not.toBe(result2)
    })

    it('should handle different providers correctly', () => {
      const params: RecordKeyParams = {
        date: '2025-01-01',
        app_id: 'app-456',
        provider: 'anthropic',
        model: 'claude-3',
      }

      const result = generateRecordIdempotencyKey(params)

      expect(result).toBe('2025-01-01_app-456_anthropic_claude-3')
    })
  })
})
```

## 完了条件

- [ ] 追加したテストが全てパス
- [ ] TypeScript strict mode: エラー0件
  ```bash
  npx tsc --noEmit
  ```
- [ ] Biome lint: エラー0件
  ```bash
  npm run check
  ```
- [ ] 動作確認完了（L2: 単体テスト実行）
  ```bash
  npm run test:unit -- test/unit/transformer/idempotency-key.test.ts
  ```

## 注意事項

- 影響範囲: このタスクは新規ファイル追加のため、既存コードへの影響なし
- 制約: キー形式は`{date}_{app_id}_{provider}_{model}`を厳守
- 正規化後のprovider/modelを使用すること（Task 3-1で実装）
