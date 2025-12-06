---
story_id: SPEC-CHANGE-001
title: api-meter-interface-update
feature: api-meter-integration
type: task
task_number: 002
phase: 1
version: 1.0.0
created: 2025-12-05
based_on: specs/stories/SPEC-CHANGE-001-api-meter-interface-update/plan.md
---

# タスク: 正規化層の実装

メタ情報:
- 依存: task-api-meter-interface-update-phase1-001 → 成果物: src/types/api-meter-schema.ts
- 提供: src/normalizer/*.ts
- サイズ: 中規模（6ファイル: 実装3 + テスト3）

## 実装内容

プロバイダー名/モデル名を標準化する正規化層を実装します。API_Meter側の要求仕様に合わせて、名前の統一と標準化を行います。

### 実装するもの
1. `ProviderNormalizer` - プロバイダー名の正規化（aws-bedrock → aws 等）
2. `ModelNormalizer` - モデル名の標準化（claude-3-5-sonnet → claude-3-5-sonnet-20241022 等）
3. `Normalizer` - 統合インターフェース（AggregatedModelRecord → NormalizedModelRecord）

### 正規化ルール
- プロバイダー名: 大文字小文字統一、前後空白除去、マッピングテーブル参照
- モデル名: マッピングテーブル参照、不明なモデルはそのまま維持
- 不明なプロバイダー: "unknown" に設定

## 対象ファイル

- [x] src/normalizer/provider-normalizer.ts（新規作成）
- [x] src/normalizer/model-normalizer.ts（新規作成）
- [x] src/normalizer/normalizer.ts（新規作成）
- [x] src/normalizer/__tests__/provider-normalizer.test.ts（新規作成）
- [x] src/normalizer/__tests__/model-normalizer.test.ts（新規作成）
- [x] src/normalizer/__tests__/normalizer.test.ts（新規作成）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [x] テストファイルを作成
  - `src/normalizer/__tests__/provider-normalizer.test.ts`
  - `src/normalizer/__tests__/model-normalizer.test.ts`
  - `src/normalizer/__tests__/normalizer.test.ts`
- [x] 失敗するテストを作成:
  - プロバイダー名正規化（aws-bedrock → aws）
  - 大文字小文字の統一（AWS-BEDROCK → aws）
  - 前後空白の除去（" aws-bedrock " → aws）
  - 不明なプロバイダー → unknown
  - モデル名正規化（claude-3-5-sonnet → claude-3-5-sonnet-20241022）
  - 不明なモデル → そのまま維持
  - AggregatedModelRecord → NormalizedModelRecord 変換
- [x] テスト実行して失敗を確認: `npm test src/normalizer/`

### 2. Green Phase

#### 2-1. ProviderNormalizer の実装
```typescript
// src/normalizer/provider-normalizer.ts
export const PROVIDER_MAPPING: Record<string, string> = {
  'aws-bedrock': 'aws',
  'azure-openai': 'azure',
  'google-vertex': 'google',
  // 他のマッピング
}

export interface ProviderNormalizer {
  normalize(provider: string): string
}

export const createProviderNormalizer = (): ProviderNormalizer => {
  return {
    normalize(provider: string): string {
      const normalized = provider.trim().toLowerCase()
      return PROVIDER_MAPPING[normalized] || 'unknown'
    },
  }
}
```

#### 2-2. ModelNormalizer の実装
```typescript
// src/normalizer/model-normalizer.ts
export const MODEL_MAPPING: Record<string, string> = {
  'claude-3-5-sonnet': 'claude-3-5-sonnet-20241022',
  'gpt-4': 'gpt-4-0613',
  // 他のマッピング
}

export interface ModelNormalizer {
  normalize(model: string): string
}

export const createModelNormalizer = (): ModelNormalizer => {
  return {
    normalize(model: string): string {
      const normalized = model.trim().toLowerCase()
      return MODEL_MAPPING[normalized] || model // 不明なモデルはそのまま
    },
  }
}
```

#### 2-3. Normalizer の実装
```typescript
// src/normalizer/normalizer.ts
import type { AggregatedModelRecord } from '../types/aggregated'
import type { ApiMeterUsageRecord } from '../types/api-meter-schema'
import { createProviderNormalizer } from './provider-normalizer'
import { createModelNormalizer } from './model-normalizer'

export interface NormalizedModelRecord {
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costActual: number
  usageDate: string
  appId?: string
  userId?: string
}

export interface INormalizer {
  normalize(records: AggregatedModelRecord[]): NormalizedModelRecord[]
}

export const createNormalizer = (): INormalizer => {
  const providerNormalizer = createProviderNormalizer()
  const modelNormalizer = createModelNormalizer()

  return {
    normalize(records: AggregatedModelRecord[]): NormalizedModelRecord[] {
      return records.map((record) => ({
        provider: providerNormalizer.normalize(record.provider),
        model: modelNormalizer.normalize(record.model),
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        totalTokens: record.totalTokens,
        costActual: record.costActual,
        usageDate: record.usageDate,
        appId: record.appId,
        userId: record.userId,
      }))
    },
  }
}
```

- [x] 追加したテストのみ実行して通ることを確認: `npm test src/normalizer/`

### 3. Refactor Phase
- [x] マッピングテーブルの可読性向上
- [x] エラーハンドリングの追加（必要に応じて）
- [x] 追加したテストが引き続き通ることを確認

## 完了条件

- [x] 追加したテストが全てパス
- [x] TypeScript strict mode: エラー0件
  ```bash
  npm run build
  ```
- [x] Biome lint: エラー0件（正規化層ファイルのみ）
  ```bash
  npx biome check src/normalizer/
  ```
- [x] 動作確認完了（L1: ユニットテスト実行）
  ```bash
  npm test src/normalizer/
  ```
- [x] 成果物作成完了:
  - `src/normalizer/provider-normalizer.ts`
  - `src/normalizer/model-normalizer.ts`
  - `src/normalizer/normalizer.ts`

## テストケース

### ProviderNormalizer
- [x] 正規化動作: "aws-bedrock" → "aws"
- [x] 大文字小文字統一: "AWS-BEDROCK" → "aws"
- [x] 前後空白除去: " aws-bedrock " → "aws"
- [x] 不明なプロバイダー: "unknown-provider" → "unknown"

### ModelNormalizer
- [x] 正規化動作: "claude-3-5-sonnet" → "claude-3-5-sonnet-20241022"
- [x] 不明なモデル: "unknown-model" → "unknown-model"（そのまま）
- [x] 大文字小文字統一: "CLAUDE-3-5-SONNET" → "claude-3-5-sonnet-20241022"

### Normalizer
- [x] AggregatedModelRecord → NormalizedModelRecord 変換
- [x] 複数レコードの一括変換
- [x] appId/userId の optional フィールド処理

## 注意事項

- **影響範囲**: 新規ファイル作成のため、既存コードへの影響なし
- **制約**:
  - マッピングテーブルは定数として一箇所に集約
  - O(1)参照を維持（Record<string, string>型）
- **パフォーマンス考慮**:
  - マッピングテーブル参照はO(1)で高速
  - バッチサイズ100-500レコードでの正規化は1ms未満と推定
- **次タスクへの引き継ぎ**:
  - 変換層（Task 2-1）でNormalizedModelRecordを使用

## 参考資料

- [Design Document](../design.md) - 第3章「正規化層の設計」
- [ADR 013: 正規化層の導入](../../adr/013-normalization-layer-introduction.md)
