---
id: 015
feature: api-meter-interface-migration
type: adr
version: 1.0.0
created: 2025-12-04
based_on: requirements analysis for API_Meter new specification
---

# ADR 015: データフロー変更

## ステータス

Accepted

- Date: 2025-12-06
- Implemented in: v1.1.0

## コンテキスト

API_Meterの新仕様対応に伴い、既存のデータフローに**正規化層（Normalization Layer）**を追加する必要がある。正規化層の導入により、プロバイダー名・モデル名の標準化を集約的に実行し、変換層の責務を明確化する。

### 既存のデータフロー（ADR 010）

```
Fetch → Aggregate → Transform → Send
  ↓          ↓           ↓          ↓
Dify API   集計処理    変換処理   外部API
```

- **Fetch**: Dify APIからデータ取得
- **Aggregate**: 日別データを月/週/日単位に集計
- **Transform**: 外部API形式に変換（ExternalApiRecord）
- **Send**: 外部APIへ送信（リトライ・スプール保存）

### 新仕様で必要な処理

1. **プロバイダー名正規化**: aws-bedrock → aws, claude → anthropic等
2. **モデル名標準化**: claude-3-5-sonnet → claude-3-5-sonnet-20241022
3. **データ構造変換**: ApiMeterRequest形式への変換
4. **source_event_id生成**: 冪等性キーの生成

### 問題点

**既存のデータフローでは正規化のタイミングが不明確**:
- **集計前に正規化**: 集計キー（provider, model）が変更され、集計データの完全性が損なわれる
- **変換中に正規化**: 変換層の責務が肥大化し、単一責任原則に違反
- **送信前に正規化**: 送信層の責務が肥大化し、リトライ・スプール機構と混在

## 決定事項

### 1. 正規化層を集計後、変換前に挿入

```
Fetch → Aggregate → **Normalize** → Transform → Send
  ↓          ↓            ↓            ↓          ↓
Dify API   集計処理   正規化処理    変換処理   外部API
```

### 2. 各層の責務定義

| 層 | 責務 | 入力 | 出力 |
|----|------|------|------|
| **Fetch** | Dify APIからデータ取得 | 期間指定 | FetchedTokenCostRecord[] |
| **Aggregate** | データ集計（per_app/workspace/per_user/per_model/all） | FetchedTokenCostRecord[] | AggregatedModelRecord[] |
| **Normalize** | プロバイダー・モデル名の標準化 | AggregatedModelRecord[] | NormalizedModelRecord[] |
| **Transform** | API_Meter形式への変換 | NormalizedModelRecord[] | ApiMeterRequest |
| **Send** | 外部APIへ送信、リトライ、スプール | ApiMeterRequest | void |

### 3. 正規化層のインターフェース

```typescript
// src/normalizer/normalizer.ts
export interface INormalizer {
  normalizeRecords(records: AggregatedModelRecord[]): NormalizedModelRecord[]
}

export interface NormalizedModelRecord {
  // AggregatedModelRecordと同じ構造だが、provider/modelが正規化済み
  period: string
  period_type: AggregationPeriod
  user_id: string
  user_type: 'end_user' | 'account'
  app_id: string
  app_name: string
  model_provider: string  // 正規化済み（aws-bedrock → aws）
  model_name: string      // 正規化済み（claude-3-5-sonnet → claude-3-5-sonnet-20241022）
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  prompt_price: string
  completion_price: string
  total_price: string
  currency: string
  execution_count: number
}

export function createNormalizer(deps: {
  providerNormalizer: ProviderNormalizer
  modelNormalizer: ModelNormalizer
  logger: Logger
}): INormalizer {
  return {
    normalizeRecords(records: AggregatedModelRecord[]): NormalizedModelRecord[] {
      return records.map(record => ({
        ...record,
        model_provider: deps.providerNormalizer.normalize(record.model_provider),
        model_name: deps.modelNormalizer.normalize(record.model_name),
      }))
    }
  }
}
```

### 4. データフローの統合（src/index.ts）

```typescript
// 既存のデータフロー
const aggregationResult = aggregateUsageData(
  rawRecords,
  config.DIFY_AGGREGATION_PERIOD,
  config.DIFY_OUTPUT_MODE,
  rawUserRecords,
  rawModelRecords
)

// 正規化層の追加（新規）
const providerNormalizer = createProviderNormalizer()
const modelNormalizer = createModelNormalizer()
const normalizer = createNormalizer({ providerNormalizer, modelNormalizer, logger })

const normalizedRecords = normalizer.normalizeRecords(aggregationResult.modelRecords)

// 変換層（変更）
const transformer = createDataTransformer({ logger })
const transformResult = transformer.transform(normalizedRecords)

// 送信層（変更）
await sender.send(transformResult)
```

### 5. 集計モードごとのデータフロー

#### per_model/allモード（最優先実装）

```
Fetch → Aggregate(modelRecords) → Normalize(provider/model) → Transform → Send
```

- 正規化対象: `AggregatedModelRecord[]`のprovider/model
- 出力: `ApiMeterUsageRecord[]`（provider, model含む）

#### per_app/workspaceモード（後回し）

```
Fetch → Aggregate(appRecords/workspaceRecords) → (Skip Normalize) → Transform → Send
```

- 正規化不要: アプリ別・ワークスペース全体はprovider/modelを含まない
- 出力: 既存形式を維持（API_Meterへの送信は保留）

#### per_userモード（後回し）

```
Fetch → Aggregate(userRecords) → (Skip Normalize) → Transform → Send
```

- 正規化不要: ユーザー別はprovider/modelを含まない
- 出力: 既存形式を維持（API_Meterへの送信は保留）

## 根拠

### 検討した選択肢

#### 1. 集計前に正規化（非推奨）

```
Fetch → **Normalize** → Aggregate → Transform → Send
```

**利点**:
- 集計前にデータが正規化されるため、集計キーが統一される
- 集計後のデータ構造がシンプル

**欠点**:
- **集計データの完全性が損なわれる**: Dify内部のprovider/model名で集計できない
- **集計ロジックへの影響大**: 集計キーが変更され、既存の集計ロジックが破壊される
- **デバッグが困難**: 集計前のデータとDify APIレスポンスが一致しない
- **ロールバックが困難**: 正規化ルール変更時に集計データも再計算が必要

#### 2. 変換中に正規化（非推奨）

```
Fetch → Aggregate → **Transform(with Normalize)** → Send
```

**利点**:
- データフローの段階が増えない
- 変換と正規化を1ステップで実行

**欠点**:
- **変換層の責務肥大化**: 変換層が「データ構造変換」と「名前正規化」の2つの責務を持つ
- **単一責任原則違反**: 変換層の変更理由が2つになる（構造変更、正規化ルール変更）
- **テストの複雑化**: 変換ロジックと正規化ロジックを同時にテスト
- **再利用性の低下**: 正規化ロジックを他のコンポーネントで使用できない

#### 3. 変換前に独立レイヤーで正規化（採用）

```
Fetch → Aggregate → **Normalize** → Transform → Send
```

**利点**:
- **集計データの完全性維持**: 集計はDify内部のprovider/model名で実行
- **責務の明確化**: 正規化層は「名前標準化」のみを担当
- **テスト容易性**: 正規化ロジック単体でテスト可能
- **変換層のシンプル化**: 変換層は「データ構造変換」のみに専念
- **再利用性**: 正規化層を他のコンポーネント（CLI等）から利用可能

**欠点**:
- **データフローの複雑化**: 処理ステップが1つ増加
- **パフォーマンス**: 正規化ステップが追加されるが、マッピングテーブル参照は高速（O(1)）で影響は軽微

### 採用理由

**変換前に独立レイヤーで正規化（選択肢3）を採用する理由**:

1. **集計データの完全性維持**
   - Dify内部のprovider/model名で集計し、集計データの完全性を保証
   - 集計後のデータとDify APIレスポンスの対応関係が明確
   - デバッグが容易（Dify APIレスポンス → 集計データ → 正規化データの対応が追跡可能）

2. **単一責任原則の遵守**
   - 集計層: データ集計のみ
   - 正規化層: 名前標準化のみ
   - 変換層: データ構造変換のみ
   - 送信層: 外部API送信、リトライ、スプール保存のみ

3. **変更の局所化**
   - 正規化ルール変更時は正規化層のみ変更
   - 変換ロジック変更時は変換層のみ変更
   - 各層の変更理由が単一

4. **テスタビリティの向上**
   - 正規化層単体でテスト可能
   - 変換層は正規化済みデータを前提にテスト
   - モックが容易（依存性注入）

5. **既存アーキテクチャとの一貫性**
   - ADR 010で定義された責務分離パターンに準拠
   - IFetcher, ITransformer, ISenderと同様の関数ベース実装

## 影響

### ポジティブな影響

- **責務の明確化**: 各層の役割が明確になり、コードの可読性が向上
- **テストカバレッジの向上**: 正規化層単体でテストでき、バグ検出が早期化
- **保守性の向上**: 正規化ルール変更が局所化され、影響範囲が限定
- **デバッグの容易さ**: データフローの各段階でデータ構造が追跡可能
- **拡張性**: 新しいプロバイダー/モデルの追加が正規化層のみで完結

### ネガティブな影響

- **データフローの複雑化**: 処理ステップが4段階から5段階に増加
- **パフォーマンス**: 正規化ステップが追加されるが、影響は軽微（マッピングテーブル参照はO(1)）
- **学習コスト**: 新規開発者がデータフローの全体像を理解するコストが増加

### 中立的な影響

- **コード量の増加**: 正規化層の追加で約200-300行のコードが増加
- **統合テストの追加**: データフロー全体を確認する統合テストが必要

## 実装への指針

### 原則

1. **データフローの明示的な記述**
   - src/index.ts内で各層の呼び出しを明示的に記述
   - コメントで各層の責務を記載

2. **依存性注入の活用**
   - createNormalizer()ファクトリ関数で依存性注入
   - providerNormalizer, modelNormalizer, loggerを注入

3. **エラーハンドリング**
   - 正規化エラー（不明なprovider/model）は"unknown"を返す
   - エラーログを詳細に出力（元の値と正規化後の値を記録）

4. **パフォーマンス考慮**
   - 正規化はマッピングテーブル参照（O(1)）で高速
   - バッチサイズ100-500レコードでの正規化は1ms未満

5. **テスト戦略**
   - ユニットテスト: 各層（Aggregate, Normalize, Transform）を独立してテスト
   - 統合テスト: Fetch → Aggregate → Normalize → Transform → Sendの全体フローをテスト
   - E2Eテスト: Dify APIから外部APIまでの完全なフローをテスト

6. **段階的な実装**
   - Phase 1: per_model/allモードのみ実装（provider/model含む）
   - Phase 2: per_app/workspace/per_userモードは後回し（正規化不要）

## 参考資料

- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) - レイヤーアーキテクチャと責務分離
- [Data Flow Patterns](https://martinfowler.com/eaaCatalog/) - データフローパターンのベストプラクティス
- [Pipeline Pattern](https://java-design-patterns.com/patterns/pipeline/) - データ処理パイプラインの設計パターン

## 関連情報

- **関連ADR**:
  - ADR 010: データ変換アーキテクチャ（既存データフローの定義）
  - ADR 013: 正規化層の導入（正規化層の詳細設計）
  - ADR 014: 型システムの完全置き換え（正規化後の型定義）
  - ADR 016: 冪等性機構（source_event_id生成タイミング）
