---
story_id: SPEC-CHANGE-001
title: api-meter-interface-update
feature: api-meter-integration
type: task
task_number: 001
phase: 1
version: 1.0.0
created: 2025-12-05
based_on: specs/stories/SPEC-CHANGE-001-api-meter-interface-update/plan.md
---

# タスク: 新型定義ファイルの作成

メタ情報:
- 依存: なし
- 提供: src/types/api-meter-schema.ts
- サイズ: 小規模（2ファイル: 型定義 + テスト）

## 実装内容

API_Meterの新仕様（2025-12-04版）に対応した型定義ファイルをzodスキーマで作成します。

### 実装するもの
1. `ApiMeterRequest` 型 - API_Meterへの送信リクエスト全体
2. `ApiMeterUsageRecord` 型 - 個別の使用量レコード
3. zodスキーマによるバリデーション
   - `total_tokens = input_tokens + output_tokens` の検証
   - 必須フィールドの検証
   - 型の検証
4. `ExternalApiRecord` への `@deprecated` タグ追加

## 対象ファイル

- [x] src/types/api-meter-schema.ts（新規作成）
- [x] src/types/api-meter-schema.test.ts（新規作成）
- [x] src/types/external-api.ts（@deprecated追加）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [x] `src/types/api-meter-schema.test.ts` を作成
- [x] 失敗するテストを作成:
  - zodスキーマのバリデーション（total_tokens検証）
  - 正常なデータでのバリデーション成功
  - 不正なデータでのバリデーションエラー（total_tokens不一致）
  - 必須フィールド欠損時のエラー
- [x] テスト実行して失敗を確認: `npm test src/types/api-meter-schema.test.ts`

### 2. Green Phase
- [x] `src/types/api-meter-schema.ts` を作成
- [x] zodスキーマで型定義を実装:
  ```typescript
  import { z } from 'zod'

  // ApiMeterUsageRecord のスキーマ
  export const apiMeterUsageRecordSchema = z.object({
    source_event_id: z.string(),
    usage_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    provider: z.string(),
    model: z.string(),
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
    total_tokens: z.number().int().nonnegative(),
    cost_actual: z.number().nonnegative(),
    aggregation_method: z.enum(['sum', 'daily_sum']),
    source_system: z.string(),
    app_id: z.string().optional(),
    user_id: z.string().optional(),
  }).refine(
    (data) => data.total_tokens === data.input_tokens + data.output_tokens,
    {
      message: 'total_tokens must equal input_tokens + output_tokens',
      path: ['total_tokens'],
    }
  )

  export type ApiMeterUsageRecord = z.infer<typeof apiMeterUsageRecordSchema>

  // ApiMeterRequest のスキーマ
  export const apiMeterRequestSchema = z.object({
    tenant_id: z.string().uuid(),
    records: z.array(apiMeterUsageRecordSchema).min(1),
    export_metadata: z.object({
      export_date_start: z.string().datetime(),
      export_date_end: z.string().datetime(),
      source_system: z.string(),
      export_version: z.string(),
    }),
  })

  export type ApiMeterRequest = z.infer<typeof apiMeterRequestSchema>
  ```
- [x] `src/types/external-api.ts` に `@deprecated` タグを追加:
  ```typescript
  /**
   * @deprecated Use ApiMeterRequest from api-meter-schema.ts instead.
   * This type will be removed in v2.0.0.
   */
  export type ExternalApiRecord = {
    // ...
  }
  ```
- [x] 追加したテストのみ実行して通ることを確認: `npm test src/types/api-meter-schema.test.ts`

### 3. Refactor Phase
- [x] zodスキーマの可読性向上（必要に応じて）
- [x] エラーメッセージの改善
- [x] 追加したテストが引き続き通ることを確認

## 完了条件

- [x] 追加したテストが全てパス
- [x] TypeScript strict mode: エラー0件
  ```bash
  npm run build
  ```
- [x] Biome lint: エラー0件
  ```bash
  npm run check
  ```
- [x] 動作確認完了（L1: ユニットテスト実行）
  ```bash
  npm test src/types/api-meter-schema.test.ts
  ```
- [x] 成果物作成完了: `src/types/api-meter-schema.ts`

## テストケース

### 正常系
- [x] 正しいデータでバリデーション成功
- [x] total_tokens = input_tokens + output_tokens の場合に成功

### 異常系
- [x] total_tokens ≠ input_tokens + output_tokens の場合にエラー
- [x] 必須フィールド欠損時にエラー
- [x] tenant_id が UUID 形式でない場合にエラー
- [x] usage_date が YYYY-MM-DD 形式でない場合にエラー
- [x] records が空配列の場合にエラー

## 注意事項

- **影響範囲**: 新規ファイル作成のため、既存コードへの影響なし
- **制約**:
  - ExternalApiRecordは既存コードで使用されているため削除しない
  - @deprecatedタグのみ追加し、将来の削除を予告
- **次タスクへの引き継ぎ**:
  - 正規化層（Task 1-2）でこの型定義を使用
  - 変換層（Task 2-1）でApiMeterRequestを構築

## 参考資料

- [Design Document](../design.md) - 第4章「新型定義の設計」
- [ADR 014: 型システムの完全置き換え](../../adr/014-type-system-replacement.md)
- [Zod Documentation](https://zod.dev/)
