---
story_id: "3"
title: data-transformation
epic_id: "1"
type: task
feature: transform
task_number: 002
version: 1.0.0
created: 2025-11-21
based_on: specs/stories/3-data-transformation/plan.md
---

# タスク: ITransformerインターフェースと関連型定義

メタ情報:
- 依存: task-transform-phase1-001 -> 成果物: src/types/external-api.ts
- 提供: src/interfaces/transformer.ts
- サイズ: 小規模（1ファイル）

## 実装内容

ITransformerインターフェース、TransformResult型、TransformError型を定義する。IFetcherと同様の関数ファクトリパターンで設計する。

### AC対応
- AC5（エラーハンドリング）

## 対象ファイル

- [x] src/interfaces/transformer.ts

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase

- [x] task-001の成果物（src/types/external-api.ts）が存在することを確認
- [x] 型定義のため、テストは型チェックで代替
- [x] インポートを試みて失敗を確認（ファイルが存在しないため）

### 2. Green Phase

- [x] `src/interfaces/transformer.ts` を作成
- [x] 以下の型を定義:
  ```typescript
  import type { DifyUsageRecord } from '../types/dify-usage.js'
  import type { ExternalApiRecord } from '../types/external-api.js'

  export interface ITransformer {
    transform(records: DifyUsageRecord[]): TransformResult
  }

  export interface TransformResult {
    /** 変換成功したレコード */
    records: ExternalApiRecord[]
    /** バッチ全体の冪等キー（SHA256） */
    batchIdempotencyKey: string
    /** 変換成功レコード数 */
    successCount: number
    /** 変換失敗レコード数 */
    errorCount: number
    /** 変換エラーの詳細 */
    errors: TransformError[]
  }

  export interface TransformError {
    /** エラーが発生したレコードの識別情報 */
    recordIdentifier: {
      date: string
      app_id: string
    }
    /** エラーメッセージ */
    message: string
    /** エラーの詳細 */
    details?: Record<string, unknown>
  }
  ```
- [x] 型チェック実行して成功を確認
  ```bash
  npx tsc --noEmit
  ```

### 3. Refactor Phase

- [x] 必要に応じてコード改善（JSDocコメント追加など）
- [x] 型チェックが引き続き通ることを確認

## 型定義の詳細

### ITransformer

- `transform`: DifyUsageRecord[]を受け取り、TransformResultを返す同期メソッド
- 例外をスローせず、全てのエラーをTransformResultに格納

### TransformResult

- `records`: 変換成功したExternalApiRecordの配列
- `batchIdempotencyKey`: 全レコードのキーをソートしてSHA256ハッシュ化
- `successCount`: 変換成功レコード数
- `errorCount`: 変換失敗レコード数
- `errors`: TransformErrorの配列

### TransformError

- `recordIdentifier`: エラーが発生したレコードを特定する情報
- `message`: エラーメッセージ
- `details`: 追加のエラー情報（オプション）

## 完了条件

- [x] インターフェースがエクスポート可能
- [x] TypeScript strict mode: エラー0件
  ```bash
  npx tsc --noEmit
  ```
- [x] Biome lint: エラー0件
  ```bash
  npm run check
  ```
- [x] ビルド成功
  ```bash
  npm run build
  ```

## 注意事項

- 影響範囲: このタスクは新規ファイル追加のため、既存コードへの影響なし
- 制約: DifyUsageRecord型は既存の定義を参照（変更禁止）
- IFetcherインターフェース（src/interfaces/fetcher.ts）を参照して同一パターンを適用
