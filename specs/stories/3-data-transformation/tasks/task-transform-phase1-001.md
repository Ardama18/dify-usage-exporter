---
story_id: "3"
title: data-transformation
epic_id: "1"
type: task
feature: transform
task_number: 001
version: 1.0.0
created: 2025-11-21
based_on: specs/stories/3-data-transformation/plan.md
---

# タスク: ExternalApiRecord型定義と単体テスト作成

メタ情報:
- 依存: なし（最初のタスク）
- 提供: src/types/external-api.ts
- サイズ: 小規模（2ファイル）

## 実装内容

外部API仕様に適合するExternalApiRecord型をzodスキーマとともに定義し、単体テストを作成する。

### AC対応
- AC4（zodバリデーション）

## 対象ファイル

- [x] src/types/external-api.ts
- [x] test/unit/types/external-api.test.ts

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase

- [x] テストファイル `test/unit/types/external-api.test.ts` を作成
- [x] 以下のテストケースを記述:
  - 正常なレコードのバリデーション成功
  - 日付形式不正（YYYY/MM/DDなど）でエラー
  - 負のトークン数でエラー
  - 空文字列app_idでエラー
  - オプションフィールド（app_name, user_id）の欠損許容
- [x] テスト実行して失敗を確認
  ```bash
  npm run test:unit -- test/unit/types/external-api.test.ts
  ```

### 2. Green Phase

- [x] `src/types/external-api.ts` を作成
- [x] externalApiRecordSchemaを定義:
  ```typescript
  import { z } from 'zod'

  export const externalApiRecordSchema = z.object({
    // 必須フィールド
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    app_id: z.string().min(1),
    provider: z.string().min(1),
    model: z.string().min(1),
    input_tokens: z.number().int().min(0),
    output_tokens: z.number().int().min(0),
    total_tokens: z.number().int().min(0),

    // 冪等キー
    idempotency_key: z.string().min(1),

    // オプションフィールド
    app_name: z.string().optional(),
    user_id: z.string().optional(),

    // メタデータ
    transformed_at: z.string().datetime(),
  })

  export type ExternalApiRecord = z.infer<typeof externalApiRecordSchema>
  ```
- [x] テスト実行して通ることを確認
  ```bash
  npm run test:unit -- test/unit/types/external-api.test.ts
  ```

### 3. Refactor Phase

- [x] 必要に応じてコード改善
- [x] テストが引き続き通ることを確認

## テストケース詳細

```typescript
import { describe, it, expect } from 'vitest'
import { externalApiRecordSchema, type ExternalApiRecord } from '../../../src/types/external-api.js'

describe('externalApiRecordSchema', () => {
  describe('正常系', () => {
    it('should validate a correct record', () => {
      const record: ExternalApiRecord = {
        date: '2025-01-01',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
        idempotency_key: '2025-01-01_app-123_openai_gpt-4',
        transformed_at: '2025-01-01T00:00:00.000Z',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(true)
    })

    it('should allow optional app_name', () => {
      const record = {
        date: '2025-01-01',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
        idempotency_key: 'key',
        app_name: 'Test App',
        transformed_at: '2025-01-01T00:00:00.000Z',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(true)
    })

    it('should allow optional user_id', () => {
      const record = {
        date: '2025-01-01',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
        idempotency_key: 'key',
        user_id: 'user-456',
        transformed_at: '2025-01-01T00:00:00.000Z',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(true)
    })
  })

  describe('異常系', () => {
    it('should reject invalid date format (YYYY/MM/DD)', () => {
      const record = {
        date: '2025/01/01',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
        idempotency_key: 'key',
        transformed_at: '2025-01-01T00:00:00.000Z',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(false)
    })

    it('should reject negative input_tokens', () => {
      const record = {
        date: '2025-01-01',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: -1,
        output_tokens: 200,
        total_tokens: 300,
        idempotency_key: 'key',
        transformed_at: '2025-01-01T00:00:00.000Z',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(false)
    })

    it('should reject empty app_id', () => {
      const record = {
        date: '2025-01-01',
        app_id: '',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
        idempotency_key: 'key',
        transformed_at: '2025-01-01T00:00:00.000Z',
      }
      const result = externalApiRecordSchema.safeParse(record)
      expect(result.success).toBe(false)
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
  npm run test:unit -- test/unit/types/external-api.test.ts
  ```

## 注意事項

- 影響範囲: このタスクは新規ファイル追加のため、既存コードへの影響なし
- 制約: date形式はYYYY-MM-DD（ハイフン区切り）のみ許容
- Design Docの型定義に厳密に従うこと
