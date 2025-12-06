---
story_id: SPEC-CHANGE-001
title: api-meter-interface-update
feature: api-meter-integration
type: task
task_number: 005
phase: 2
version: 1.0.0
created: 2025-12-05
based_on: specs/stories/SPEC-CHANGE-001-api-meter-interface-update/plan.md
---

# タスク: source_event_id生成ロジックの実装

メタ情報:
- 依存: task-api-meter-interface-update-phase2-001 → 成果物: src/transformer/data-transformer.ts
- 提供: src/transformer/idempotency-key.ts（更新）
- サイズ: 小規模（2ファイル: 実装 + テスト）

## 実装内容

冪等性を保証するための `source_event_id` 生成ロジックを実装します。同一データから常に同じIDが生成される決定論的なハッシュを使用します。

### 実装するもの
1. `generateSourceEventId()` 関数 - 決定論的なID生成
2. フォーマット: `dify-{usage_date}-{provider}-{model}-{hash12}`
3. SHA256ハッシュ生成（usage_date, provider, model, app_id, user_id から計算）
4. ハッシュの最初の12文字を16進数で使用

### ID生成ルール
- 決定論的: 同一データから常に同じIDを生成
- 衝突耐性: 異なるデータから異なるIDを生成
- 可読性: 日付、プロバイダー、モデル情報を含む

## 対象ファイル

- [x] src/transformer/idempotency-key.ts（新規作成）
- [x] src/transformer/__tests__/idempotency-key.test.ts（新規作成）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [x] 依存成果物の確認: `src/transformer/data-transformer.ts` が更新されている
- [x] `src/transformer/__tests__/idempotency-key.test.ts` を作成
- [x] 失敗するテストを作成:
  - 決定論的ID生成（同一データから同じID）
  - フォーマット検証（`dify-{usage_date}-{provider}-{model}-{hash12}`）
  - ハッシュ部分が12文字の16進数であることを確認
  - 衝突耐性テスト（異なるデータから異なるIDが生成される）
  - app_id/user_idのoptional対応
- [x] テスト実行して失敗を確認: `npm test src/transformer/idempotency-key.test.ts`

### 2. Green Phase

#### 2-1. generateSourceEventId() の実装
```typescript
// src/transformer/idempotency-key.ts
import { createHash } from 'node:crypto'
import type { NormalizedModelRecord } from '../normalizer/normalizer'

/**
 * source_event_idを生成する
 * フォーマット: dify-{usage_date}-{provider}-{model}-{hash12}
 *
 * @param record - 正規化されたモデルレコード
 * @returns source_event_id
 */
export const generateSourceEventId = (record: NormalizedModelRecord): string => {
  // ハッシュ計算用のデータを結合
  const hashInput = [
    record.usageDate,
    record.provider,
    record.model,
    record.appId || '',
    record.userId || '',
  ].join('|')

  // SHA256ハッシュを生成
  const hash = createHash('sha256')
    .update(hashInput, 'utf8')
    .digest('hex')
    .substring(0, 12) // 最初の12文字を使用

  // フォーマット: dify-{usage_date}-{provider}-{model}-{hash12}
  return `dify-${record.usageDate}-${record.provider}-${record.model}-${hash}`
}
```

#### 2-2. data-transformer.ts の更新
```typescript
// src/transformer/data-transformer.ts に追加
import { generateSourceEventId } from './idempotency-key'

// transform() メソッド内で使用
const usageRecords = records.map((record) => {
  // ...
  return {
    source_event_id: generateSourceEventId(record),
    // ...
  }
})
```

- [x] 追加したテストのみ実行して通ることを確認: `npm test src/transformer/idempotency-key.test.ts`
- [x] data-transformer.test.ts も実行して通ることを確認

### 3. Refactor Phase
- [x] コメントの充実化
- [x] ハッシュ生成ロジックの可読性向上
- [x] 追加したテストが引き続き通ることを確認

## 完了条件

- [x] 追加したテストが全てパス
- [x] TypeScript strict mode: エラー0件
  ```bash
  npm run build
  ```
- [x] Biome lint: エラー0件（今回追加したファイルにはエラーなし）
  ```bash
  npm run check
  ```
- [x] 動作確認完了（L1: ユニットテスト実行）
  ```bash
  npm test src/transformer/idempotency-key.test.ts
  npm test src/transformer/data-transformer.test.ts
  ```
- [x] 成果物作成完了: `src/transformer/idempotency-key.ts`

## テストケース

### 正常系
- [x] 決定論的ID生成: 同一データから常に同じIDが生成される
- [x] フォーマット検証: `dify-{usage_date}-{provider}-{model}-{hash12}` に準拠
- [x] ハッシュ部分が12文字の16進数
- [x] app_id/user_idがoptionalでも正常動作

### 異常系ではなく、衝突耐性のテスト
- [x] 異なるデータから異なるIDが生成される
  - usage_dateが異なる → 異なるID
  - providerが異なる → 異なるID
  - modelが異なる → 異なるID
  - app_idが異なる → 異なるID
  - user_idが異なる → 異なるID

### エッジケース
- [x] app_id/user_idがundefined → ハッシュ計算に空文字列を使用
- [x] 特殊文字を含むデータ → 正常にハッシュ生成

## 注意事項

- **影響範囲**:
  - 新規ファイル作成（`idempotency-key.ts`）
  - `data-transformer.ts` の軽微な更新
- **制約**:
  - SHA256ハッシュを使用（Node.js標準のcryptoモジュール）
  - ハッシュの最初の12文字のみを使用
- **重要な設計判断**:
  - 決定論的ハッシュにより冪等性を保証
  - API_Meter側で重複検出時に409 Conflictを返す（ただしADR 017/019により削除予定）
  - 現在は200 OKで処理される仕様
- **パフォーマンス考慮**:
  - ハッシュ生成は高速（1レコードあたり1ms未満）
  - バッチサイズ100-500レコードでの処理に影響なし
- **次タスクへの引き継ぎ**:
  - Task 3-2 で `source_event_id` を含む `ApiMeterRequest` を送信

## 参考資料

- [Design Document](../design.md) - 第6章「冪等性機構の実装」
- [ADR 016: 冪等性機構](../../adr/016-idempotency-mechanism.md)
- [ADR 017: エラーハンドリング戦略](../../adr/017-error-handling-strategy.md)
- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html)
