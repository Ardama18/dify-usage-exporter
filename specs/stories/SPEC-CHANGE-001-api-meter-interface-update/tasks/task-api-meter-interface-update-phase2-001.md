---
story_id: SPEC-CHANGE-001
title: api-meter-interface-update
feature: api-meter-integration
type: task
task_number: 004
phase: 2
version: 1.0.0
created: 2025-12-05
based_on: specs/stories/SPEC-CHANGE-001-api-meter-interface-update/plan.md
---

# タスク: データ変換ロジックの改修

メタ情報:
- 依存:
  - task-api-meter-interface-update-phase1-001 → 成果物: src/types/api-meter-schema.ts
  - task-api-meter-interface-update-phase1-003 → 成果物: src/types/env.ts
- 提供: src/transformer/data-transformer.ts（更新）
- サイズ: 中規模（2ファイル: 実装 + テスト更新）

## 実装内容

データ変換ロジックを`ApiMeterRequest`形式に対応させます。正規化されたデータを新しいAPI_Meter仕様のフォーマットに変換します。

### 実装するもの
1. `TransformResult` 型の更新（`ApiMeterRequest`を含む）
2. `NormalizedModelRecord[]` → `ApiMeterUsageRecord[]` への変換
3. `ApiMeterRequest` の構築（tenant_id, export_metadata付与）
4. 日付範囲計算の実装（`getDateRangeStart()`, `getDateRangeEnd()`）
5. トークン計算検証の実装（total_tokens = input_tokens + output_tokens）

## 対象ファイル

- [x] src/transformer/data-transformer.ts（更新）
- [x] src/transformer/__tests__/data-transformer.test.ts（更新）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [x] 依存成果物の確認:
  - `src/types/api-meter-schema.ts` が存在
  - `src/types/env.ts` に新環境変数が追加されている
- [x] `src/transformer/__tests__/data-transformer.test.ts` を更新
- [x] 失敗するテストを追加:
  - NormalizedModelRecord → ApiMeterUsageRecord 変換
  - トークン計算検証（total_tokens = input_tokens + output_tokens）
  - トークン不一致時にエラー
  - 日付範囲計算のテスト
  - ApiMeterRequestの構築テスト（tenant_id, export_metadataの付与）
- [x] テスト実行して失敗を確認: `npm test src/transformer/data-transformer.test.ts`

### 2. Green Phase

#### 2-1. TransformResult 型の更新
```typescript
// src/transformer/data-transformer.ts
import type { ApiMeterRequest } from '../types/api-meter-schema'

export interface TransformResult {
  request: ApiMeterRequest
  recordCount: number
}
```

#### 2-2. 日付範囲計算関数の実装
```typescript
/**
 * レコードから最も古い日付を取得
 */
const getDateRangeStart = (records: NormalizedModelRecord[]): string => {
  const dates = records.map((r) => new Date(r.usageDate))
  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
  return minDate.toISOString()
}

/**
 * レコードから最も新しい日付を取得
 */
const getDateRangeEnd = (records: NormalizedModelRecord[]): string => {
  const dates = records.map((r) => new Date(r.usageDate))
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))
  return maxDate.toISOString()
}
```

#### 2-3. データ変換ロジックの実装
```typescript
import { apiMeterRequestSchema } from '../types/api-meter-schema'
import type { NormalizedModelRecord } from '../normalizer/normalizer'
import { loadEnv } from '../types/env'

export class DataTransformer {
  transform(records: NormalizedModelRecord[]): TransformResult {
    if (records.length === 0) {
      throw new Error('No records to transform')
    }

    const env = loadEnv()

    // NormalizedModelRecord → ApiMeterUsageRecord への変換
    const usageRecords = records.map((record) => {
      // トークン計算検証
      const totalTokens = record.inputTokens + record.outputTokens
      if (totalTokens !== record.totalTokens) {
        throw new Error(
          `Token mismatch: ${record.totalTokens} !== ${totalTokens} (${record.inputTokens} + ${record.outputTokens})`
        )
      }

      return {
        source_event_id: generateSourceEventId(record), // Task 2-2で実装
        usage_date: record.usageDate,
        provider: record.provider,
        model: record.model,
        input_tokens: record.inputTokens,
        output_tokens: record.outputTokens,
        total_tokens: record.totalTokens,
        cost_actual: record.costActual,
        aggregation_method: 'daily_sum' as const,
        source_system: 'dify-usage-exporter',
        app_id: record.appId,
        user_id: record.userId,
      }
    })

    // ApiMeterRequestの構築
    const request = {
      tenant_id: env.API_METER_TENANT_ID,
      records: usageRecords,
      export_metadata: {
        export_date_start: getDateRangeStart(records),
        export_date_end: getDateRangeEnd(records),
        source_system: 'dify-usage-exporter',
        export_version: '1.1.0',
      },
    }

    // zodスキーマでバリデーション
    const validatedRequest = apiMeterRequestSchema.parse(request)

    return {
      request: validatedRequest,
      recordCount: usageRecords.length,
    }
  }
}
```

- [x] 追加したテストのみ実行して通ることを確認: `npm test src/transformer/data-transformer.test.ts`

### 3. Refactor Phase
- [x] エラーハンドリングの改善
- [x] ログ出力の追加
- [x] コードの可読性向上
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
  npm test src/transformer/data-transformer.test.ts
  ```
- [x] 成果物作成完了: `src/transformer/data-transformer.ts`（更新）

## テストケース

### 正常系
- [x] NormalizedModelRecord → ApiMeterUsageRecord 変換成功
- [x] トークン計算が正しい（total_tokens = input_tokens + output_tokens）
- [x] 日付範囲が正しく計算される
- [x] tenant_idが正しく設定される
- [x] export_metadataが正しく構築される
- [x] 複数レコードの一括変換成功

### 異常系
- [x] トークン不一致時にエラー（total_tokens ≠ input_tokens + output_tokens）
- [x] レコードが空配列の場合にエラー
- [x] zodスキーマでバリデーションエラー時に例外

## 注意事項

- **影響範囲**:
  - `src/transformer/data-transformer.ts` の改修
  - 既存の変換ロジックを新形式に置き換え
- **制約**:
  - `generateSourceEventId()` は Task 2-2 で実装予定のため、一時的にスタブ実装
  - zodスキーマでの厳密なバリデーション必須
- **重要な変更点**:
  - ExternalApiRecord → ApiMeterRequest への完全移行
  - トークン計算検証の追加
  - 日付範囲計算の追加
- **次タスクへの引き継ぎ**:
  - Task 2-2 で `generateSourceEventId()` を実装
  - Task 3-2 で `ApiMeterRequest` を送信

## 参考資料

- [Design Document](../design.md) - 第5章「データ変換層の改修」
- [ADR 015: データフロー変更](../../adr/015-data-flow-transformation.md)
- [ADR 014: 型システムの完全置き換え](../../adr/014-type-system-replacement.md)
