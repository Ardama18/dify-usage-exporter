# タスク: 型定義・zodスキーマ実装

---
story_id: 2
title: dify-usage-fetcher
epic_id: 1
type: task
task_number: 001
version: 1.0.0
created: 2025-11-21
based_on: specs/stories/2-dify-usage-fetcher/plan.md
---

メタ情報:
- 依存: なし（最初のタスク）
- 提供: src/types/dify-usage.ts, src/types/watermark.ts
- サイズ: 小規模（2ファイル + テスト）

## 実装内容

Dify使用量データとウォーターマークの型定義およびzodスキーマを実装する。これにより後続のタスクで型安全なデータ処理が可能になる。

## 対象ファイル
- [x] `src/types/dify-usage.ts` - Dify使用量データ型定義
- [x] `src/types/watermark.ts` - ウォーターマーク型定義
- [x] `test/unit/types/dify-usage.test.ts` - 型バリデーションテスト

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [x] `test/unit/types/dify-usage.test.ts` を作成
  - 正常なデータのバリデーション成功テスト
  - 必須フィールド欠落時のエラー検出テスト
  - 日付形式（YYYY-MM-DD）のバリデーションテスト
  - トークン数の範囲チェック（0以上の整数）テスト
  - DifyUsageResponseの全体バリデーションテスト
- [x] `test/unit/types/watermark.test.ts` を作成
  - Watermark型のバリデーションテスト
  - ISO8601日時形式の検証テスト
- [x] テスト実行して失敗を確認
  ```bash
  npm test -- test/unit/types/
  ```

### 2. Green Phase
- [x] `src/types/dify-usage.ts` を作成
  ```typescript
  import { z } from 'zod'

  export const difyUsageRecordSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    app_id: z.string().min(1),
    app_name: z.string().optional(),
    provider: z.string().min(1),
    model: z.string().min(1),
    input_tokens: z.number().int().min(0),
    output_tokens: z.number().int().min(0),
    total_tokens: z.number().int().min(0),
    user_id: z.string().optional(),
  })

  export const difyUsageResponseSchema = z.object({
    data: z.array(difyUsageRecordSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    has_more: z.boolean(),
  })

  export type DifyUsageRecord = z.infer<typeof difyUsageRecordSchema>
  export type DifyUsageResponse = z.infer<typeof difyUsageResponseSchema>
  ```

- [x] `src/types/watermark.ts` を作成
  ```typescript
  import { z } from 'zod'

  export const watermarkSchema = z.object({
    last_fetched_date: z.string().datetime(),
    last_updated_at: z.string().datetime(),
  })

  export type Watermark = z.infer<typeof watermarkSchema>
  ```

- [x] テスト実行して通ることを確認
  ```bash
  npm test -- test/unit/types/
  ```

### 3. Refactor Phase
- [x] 必要に応じてスキーマを改善
- [x] エクスポートの整理
- [x] テストが引き続き通ることを確認

## 完了条件
- [x] 単体テストが全てパス
- [x] TypeScript strict mode: エラー0件
  ```bash
  npm run build
  ```
- [x] Biome lint: エラー0件
  ```bash
  npm run check
  ```
- [x] zodスキーマがDesign Docの定義と一致
- [x] 型が正しくエクスポートされている

## 関連する受入条件（AC）
- **AC-6-1**: システムはAPIレスポンスをzodスキーマで検証すること
- **AC-6-2**: システムは必須フィールド（date, app_id, provider, model, total_tokens）の存在を確認すること
- **AC-6-4**: システムはトークン数が0以上の整数であることを検証すること

## 依存タスク
- なし（最初のタスク）

## 注意事項
- 影響範囲: 後続の全タスクがこの型定義を使用
- 制約: Design Docのインターフェース定義に厳密に準拠すること
- zodの`.datetime()`はISO 8601形式を検証する
