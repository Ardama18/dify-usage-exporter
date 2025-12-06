---
id: 013
feature: api-meter-interface-migration
type: adr
version: 1.0.0
created: 2025-12-04
based_on: requirements analysis for API_Meter new specification
---

# ADR 013: 正規化層の導入

## ステータス

Accepted

- Date: 2025-12-06
- Implemented in: v1.1.0

## コンテキスト

API_Meterの新仕様（2025-12-04版）では、プロバイダー名とモデル名の標準化が要求されている。Dify内部で使用されているプロバイダー名・モデル名は、API_Meterが期待する標準名と一致しない場合がある。

### 不一致の例

| Dify内部名 | API_Meter標準名 | 理由 |
|-----------|---------------|------|
| aws-bedrock | aws | 企業名を使用（サービス名ではなく） |
| claude | anthropic | 製品名ではなく企業名を使用 |
| gemini | google | 製品名ではなく企業名を使用 |
| grok | xai | 製品名ではなく企業名を使用 |

### 要件

- **REQ-001**: プロバイダー名正規化（マッピングテーブルによる一元管理）
- **REQ-002**: モデル名標準化（公式識別子への変換）
- **REQ-009**: 日付フォーマット標準化（YYYY-MM-DD, ISO8601）

### 制約事項

- 既存の変換層（data-transformer.ts）は単一責任原則に従い、データ構造変換のみを担当
- 正規化ロジックを変換層に埋め込むと、責務が肥大化し保守性が低下
- 不明なプロバイダー/モデルは"unknown"として送信（4-B）

## 決定事項

### 1. 独立した正規化層を導入

データフローに新しい正規化層を追加する：

```
Fetch → Aggregate → **Normalize** → Transform → Send
```

### 2. 正規化モジュール構成

```typescript
// src/normalizer/provider-normalizer.ts
export interface ProviderNormalizer {
  normalize(provider: string): string
}

// src/normalizer/model-normalizer.ts
export interface ModelNormalizer {
  normalize(model: string): string
}
```

### 3. マッピングテーブル方式

プロバイダー名のマッピングテーブルを定数として定義：

```typescript
// src/normalizer/provider-normalizer.ts
const PROVIDER_MAPPING: Record<string, string> = {
  'openai': 'openai',
  'anthropic': 'anthropic',
  'google': 'google',
  'aws-bedrock': 'aws',
  'xai': 'xai',
  'x-ai': 'xai',
}

export function createProviderNormalizer(): ProviderNormalizer {
  return {
    normalize(provider: string): string {
      const normalized = provider.toLowerCase().trim()
      return PROVIDER_MAPPING[normalized] || 'unknown'
    }
  }
}
```

### 4. モデル名の標準化

モデル名は公式識別子に変換（バージョン番号を含む）：

```typescript
// src/normalizer/model-normalizer.ts
const MODEL_MAPPING: Record<string, string> = {
  'claude-3-5-sonnet': 'claude-3-5-sonnet-20241022',
  'gpt-4': 'gpt-4-0613',
  'gemini-pro': 'gemini-1.0-pro',
  // ...追加のマッピング
}

export function createModelNormalizer(): ModelNormalizer {
  return {
    normalize(model: string): string {
      const normalized = model.toLowerCase().trim()
      return MODEL_MAPPING[normalized] || model // 不明な場合はそのまま
    }
  }
}
```

## 根拠

### 検討した選択肢

#### 1. 変換時に都度正規化（非推奨）

```typescript
// data-transformer.ts内で直接正規化
function transform(record) {
  const provider = normalizeProvider(record.provider) // インライン実装
  const model = normalizeModel(record.model)
  // ...
}
```

**利点**:
- 新規モジュール不要、実装が早い
- ファイル数が増えない

**欠点**:
- 変換層の責務が肥大化（Single Responsibility Principle違反）
- テストが複雑化（正規化と変換を同時にテスト）
- マッピングテーブルの保守が困難
- 再利用性が低い（他のコンポーネントで正規化できない）
- スパゲッティコード化のリスク

#### 2. マッピングテーブルを変換層内に埋め込む（非推奨）

```typescript
// data-transformer.ts
const PROVIDER_MAPPING = { ... }

function transform(record) {
  const provider = PROVIDER_MAPPING[record.provider] || 'unknown'
  // ...
}
```

**利点**:
- モジュール追加不要
- マッピングテーブルが一箇所に集約

**欠点**:
- 変換層とマッピング定義の責務が混在
- マッピングテーブル単体のテストができない
- 他のコンポーネントからマッピングテーブルを利用できない
- 変換ロジックとマッピング定義の変更理由が異なる（SRP違反）

#### 3. 正規化専用レイヤーを追加（採用）

```typescript
// src/normalizer/provider-normalizer.ts
export function createProviderNormalizer(): ProviderNormalizer { ... }

// src/normalizer/model-normalizer.ts
export function createModelNormalizer(): ModelNormalizer { ... }
```

**利点**:
- **単一責任原則**: 正規化は正規化層のみが担当
- **テスト容易性**: 正規化ロジック単体でテスト可能
- **保守性**: マッピングテーブルの追加・変更が容易
- **再利用性**: 他のコンポーネントから正規化機能を利用可能
- **責務の明確化**: 変換層はデータ構造変換のみに専念

**欠点**:
- モジュール数が2つ増加（初期理解コスト増）
- データフローに1ステップ追加（パフォーマンスへの影響は軽微）

### 採用理由

**正規化専用レイヤー（選択肢3）を採用する理由**:

1. **単一責任原則の遵守**
   - 正規化層: プロバイダー/モデル名の標準化のみ
   - 変換層: データ構造の変換のみ
   - 各層の責務が明確で、変更理由が単一

2. **テスタビリティの向上**
   - 正規化ロジックを独立してテスト可能
   - 変換ロジックと分離されているため、モックが容易
   - マッピングテーブルの変更時にテストが局所化される

3. **保守性の向上**
   - 新しいプロバイダー/モデルの追加はマッピングテーブルのみ変更
   - 変更影響範囲が明確（normalizer/配下のみ）
   - マッピングテーブルのレビューが容易

4. **既存アーキテクチャとの一貫性**
   - 既存のADR 010（データ変換アーキテクチャ）で定義された責務分離パターンに準拠
   - IFetcher, ITransformer, ISenderと同様の関数ベース実装

5. **拡張性**
   - 将来的にプロバイダー固有の正規化ルールが増えても対応可能
   - モデル名のバージョン管理が容易

## 影響

### ポジティブな影響

- **責務の明確化**: 各層の役割が明確になり、コードの可読性が向上
- **テストカバレッジの向上**: 正規化ロジック単体でテストでき、バグ検出が早期化
- **保守性の向上**: マッピングテーブルの変更が局所化され、影響範囲が限定
- **再利用性**: 他のコンポーネント（集計層、送信層）からも正規化機能を利用可能
- **一貫性**: プロジェクト全体で統一された正規化ロジックを適用

### ネガティブな影響

- **モジュール数の増加**: 2つの新規モジュールが追加され、初期理解コストが増加
- **データフローの複雑化**: 処理ステップが1つ増え、データフロー図が複雑になる
- **パフォーマンス**: 正規化ステップが追加されるが、マッピングテーブル参照は高速（O(1)）で影響は軽微

### 中立的な影響

- **マッピングテーブルのメンテナンス**: 新しいプロバイダー/モデルが追加されるたびに更新が必要
- **"unknown"の扱い**: 不明なプロバイダー/モデルは"unknown"として送信（要件4-B）

## 実装への指針

### 原則

1. **関数ベースの実装**
   - クラスではなく、関数とインターフェースで実装（TypeScript規約に準拠）
   - createProviderNormalizer(), createModelNormalizer()ファクトリ関数

2. **マッピングテーブルの管理**
   - PROVIDER_MAPPING, MODEL_MAPPINGは定数として定義
   - TypeScriptの`Record<string, string>`型で型安全性を確保
   - 正規化前に小文字化と空白除去を実行

3. **エラーハンドリング**
   - 不明なプロバイダー/モデルは"unknown"を返す（エラーではない）
   - 空文字列や不正な値は"unknown"として扱う

4. **テスト戦略**
   - 各マッピングエントリに対してユニットテスト作成
   - 大文字小文字の混在、前後空白の処理を確認
   - "unknown"への変換を確認

5. **正規化タイミング**
   - 集計後、変換前に正規化を実行
   - 集計データの完全性を維持（集計前に正規化しない）

6. **マッピングテーブルの更新方針**
   - 新規プロバイダー追加時は、API_Meter公式ドキュメントを確認
   - モデル名は公式識別子（バージョン番号含む）を使用
   - 更新時はテストケースも同時に追加

## 参考資料

- [LiteLLM Provider Normalization](https://docs.litellm.ai/docs/providers/bedrock) - プロバイダー名正規化のベストプラクティス（2025年版）
- [AnyLLM Response Normalization](https://atalupadhyay.wordpress.com/2025/08/23/anyllm-the-ultimate-unified-interface-for-multiple-llm-providers/) - 複数LLMプロバイダーの統一インターフェース実装例
- [AWS Bedrock Model IDs](https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html) - AWS Bedrockでサポートされる公式モデル識別子
- [Single Responsibility Principle (SRP)](https://en.wikipedia.org/wiki/Single-responsibility_principle) - SOLID原則の1つ、責務の分離

## 関連情報

- **Epic方針書**: specs/epics/1-dify-usage-exporter/epic.md（該当する場合）
- **関連ADR**:
  - ADR 010: データ変換アーキテクチャ（責務分離パターンの参照）
  - ADR 014: 型システムの完全置き換え（正規化後の型定義）
  - ADR 015: データフロー変更（正規化層の統合）
