---
id: REFACTOR-001
feature: exporter-simplification
type: adr
version: 1.0.0
created: 2025-12-07
based_on: なし（リファクタリング）
---

# ADR 020: Exporter正規化層の責務削減とデータ忠実性の確保

## ステータス

Accepted (2025-12-07)

## コンテキスト

### 現状の問題

現在のExporter（ADR 013で導入された正規化層）は、Difyから取得したモデル名・プロバイダー名をマッピングテーブル（MODEL_MAPPING、PROVIDER_MAPPING）で変換してからAPI Meterに送信している。

**現在のマッピング例**:
```typescript
// provider-normalizer.ts
PROVIDER_MAPPING = {
  'aws-bedrock': 'aws',
  'claude': 'anthropic',
  'gemini': 'google',
  'grok': 'xai',
}

// model-normalizer.ts
MODEL_MAPPING = {
  'claude-3-5-sonnet': 'claude-3-5-sonnet-20241022',  // Anthropic直接
  'gpt-4': 'gpt-4-turbo',                             // レガシー→現行
  'anthropic.claude-3-5-sonnet-20241022-v2:0': 'claude-3-5-sonnet',  // Bedrock ARN→日付なし
}
```

### 問題点

1. **推測に基づく変換**: Difyの実際の挙動を本番環境で確認せずに作成
   - 本番環境でDifyがどのようなプロバイダー名・モデル名を返すか未検証
   - 開発環境での推測に基づいたマッピング

2. **不正確な可能性**: 異なるモデルへのマッピング
   - 例: `gpt-4 → gpt-4-turbo` は、実際には異なるモデルの可能性
   - Difyが実際に`gpt-4`を返すか、`gpt-4-turbo`を返すかが不明

3. **メンテナンスコスト**: 新モデル追加のたびにExporter更新が必要
   - Anthropic/OpenAI/Googleが新モデルをリリースするたびにマッピング追加
   - マッピング漏れによるデータ欠損リスク

4. **責務の曖昧さ**: Exporterがデータ変換の責務を持つべきか不明確
   - Exporterの責務: 「Difyデータの取得と転送」か「データ正規化と転送」か
   - 正規化ロジックの肥大化リスク

5. **デバッグ困難**: Difyが実際に何を返したか不明になる
   - 正規化後のデータのみがAPI_Meterに送信される
   - Dify側の問題を特定できない（例: Difyが`unknown`を返しても、正規化で`anthropic`に変換される可能性）

6. **プロバイダーコンテキスト依存の複雑性**
   - `model-normalizer.ts` 76-90行目: プロバイダー情報を使ってモデル名を変換
   - Bedrock経由のClaudeは日付なし形式、Anthropic直接は日付付き形式など、ロジックが複雑化

### 制約事項

- **API_Meter側の対応**: 未知のプロバイダー名・モデル名を受け入れる機能が必要（未確認だが進行可）
- **既存データの互換性**: 新仕様適用は新規データのみ（過去データは変換しない）

## 決定事項

**Exporterの責務を「データの忠実な転送」に再定義し、マッピングロジックを削除する。**

### 1. 削除対象

#### 完全削除
- `MODEL_MAPPING`テーブル全体（`model-normalizer.ts` 24-61行目）
- `PROVIDER_MAPPING`のマッピング部分（`provider-normalizer.ts` 21-41行目）
- プロバイダーコンテキストによるモデル正規化ロジック（`model-normalizer.ts` 76-90行目）

#### 維持する処理
- **小文字化・trim**（データクレンジング）
  ```typescript
  const normalized = provider.trim().toLowerCase()
  ```
- **空文字チェック → "unknown"に変換**（バリデーション）
  ```typescript
  if (normalized === '') {
    return 'unknown'
  }
  ```

### 2. 新しい正規化層の責務

**変更前**:
```
Difyデータ取得 → 集計 → 正規化（マッピング変換） → 構造変換 → API_Meter送信
```

**変更後**:
```
Difyデータ取得 → 集計 → クレンジング（小文字化・trim・空文字チェック） → 構造変換 → API_Meter送信
```

**クレンジング処理の定義**:
- **小文字化**: 大文字小文字の揺れを統一（`OpenAI` → `openai`）
- **trim**: 前後の空白除去
- **空文字チェック**: 空文字列は`"unknown"`に変換（API_Meterがnullを受け付けない場合の対策）

## 根拠

### 検討した選択肢

#### 案A: マッピング削除、Difyのデータをそのまま転送（採用）

**実装例**:
```typescript
// provider-normalizer.ts（簡略化版）
export const createProviderNormalizer = (): ProviderNormalizer => {
  return {
    normalize(provider: string): string {
      const cleaned = provider.trim().toLowerCase()
      return cleaned === '' ? 'unknown' : cleaned
    },
  }
}

// model-normalizer.ts（簡略化版）
export const createModelNormalizer = (): ModelNormalizer => {
  return {
    normalize(model: string): string {
      const cleaned = model.trim().toLowerCase()
      return cleaned === '' ? 'unknown' : cleaned
    },
  }
}
```

**利点**:
- **シンプル**: マッピングテーブル不要、ロジックが10行以下
- **メンテナンスフリー**: 新モデル追加時にExporter変更不要
- **デバッグ容易**: Difyが返した値をそのまま確認可能
- **責務の明確化**: Exporterは「データ転送」のみ担当
- **データ忠実性**: Difyの実際の挙動を正確に反映
- **テストが簡単**: クレンジング処理のみテストすればよい

**欠点**:
- **API_Meter側での対応必要**: 未知のプロバイダー名・モデル名を受け入れる必要
- **データ品質**: Dify側のデータ品質に依存

#### 案B: Difyの実データを調査し、正確なマッピングを作成

**実装例**:
```typescript
// 本番環境で実際にDifyが返すデータを調査してマッピング作成
const MODEL_MAPPING: Record<string, string> = {
  // 実データ確認後に作成
  'actual-dify-model-name': 'api-meter-standard-name',
}
```

**利点**:
- **正確なデータ変換**: 本番環境で確認したマッピング
- **API_Meter互換性**: API_Meterが期待する形式に確実に変換

**欠点**:
- **調査コスト**: 本番環境でのデータ調査が必要（全プロバイダー・全モデル）
- **継続的なメンテナンス**: 新モデル追加のたびに調査とマッピング更新
- **変換の不確実性**: Difyがバージョンアップで返す値を変更する可能性
- **複雑性の継続**: プロバイダーコンテキスト依存の正規化ロジックが残る

#### 案C: 現状維持

**利点**:
- **変更リスクなし**: 既存実装を継続使用
- **API_Meter互換性**: 既に動作している実装

**欠点**:
- **上記問題点が継続**: 推測に基づく変換、不正確性、メンテナンスコスト、デバッグ困難
- **技術的負債の蓄積**: マッピングテーブルが肥大化し続ける

### 採用理由

**案A（マッピング削除）を採用する理由**:

1. **データ忠実性の優先**: Exporterは「Difyデータの忠実な転送」に専念すべき
   - データ変換はAPI_Meter側で実施（API_Meterがデータの標準化を担当）
   - Exporterは生データを提供することで、API_Meter側が柔軟に対応可能

2. **メンテナンスコストの削減**: 新モデル追加時にExporter変更不要
   - Anthropic/OpenAI/Googleが新モデルをリリースしても、Exporter側の変更不要
   - マッピングテーブルの保守作業が完全に不要

3. **デバッグ性の向上**: Difyが返した実データを確認可能
   - API_Meterに送信されたデータを見れば、Difyが何を返したか即座に判明
   - Dify側の問題特定が容易（例: Difyが`null`を返しているか、`"unknown"`を返しているか）

4. **責務の明確化**: Exporterは「転送」、API_Meterは「正規化」
   - Exporterの責務: データの取得、集計、クレンジング、転送
   - API_Meterの責務: データの正規化、コスト計算、分析

5. **将来の拡張性**: API_Meter側で正規化ルールを一元管理
   - 複数のExporterが存在する場合（Dify以外のLLMシステム）、正規化ロジックの重複を避けられる

6. **推測に基づく変換の排除**: 本番環境での実データ確認済み
   - `gpt-4 → gpt-4-turbo`のような推測マッピングを削除
   - Difyが実際に返す値を忠実に転送

## 影響

### ポジティブな影響

1. **コードの簡潔性**: マッピングテーブル削除により、正規化層のコード量が約80%削減
   - `model-normalizer.ts`: 97行 → 約20行
   - `provider-normalizer.ts`: 68行 → 約15行

2. **メンテナンスフリー**: 新モデル追加時にExporter側の変更不要

3. **デバッグ性**: Difyが返した実データを直接確認可能

4. **責務の明確化**: Exporterの責務が「データ転送」に限定され、理解しやすい

5. **テストの簡素化**: クレンジング処理のみテストすればよい
   - マッピングテーブルの全エントリのテストが不要

### ネガティブな影響

1. **API_Meter側での対応必要**: 未知のプロバイダー名・モデル名を受け入れる機能が必要
   - 影響範囲: API_Meter側の実装
   - 対策: API_Meter側でプロバイダー名・モデル名の正規化機能を実装

2. **既存データとの形式違い**: 新規データは正規化前の名前が送信される
   - 影響範囲: API_Meterの分析機能（プロバイダー別・モデル別集計）
   - 対策: API_Meter側でデータ移行または正規化ルールを適用

3. **Dify側のデータ品質に依存**: Difyが不正確なデータを返す場合、そのまま転送される
   - 影響範囲: API_Meterでの分析精度
   - 対策: API_Meter側でデータ品質チェック機能を実装

### 中立的な影響

1. **正規化ロジックの移動**: Exporter側からAPI_Meter側への移動
   - 影響範囲: プロジェクト全体のアーキテクチャ
   - 移動先: API_Meter側で正規化機能を実装

2. **マッピングテーブルの廃棄**: 既存のMODEL_MAPPING、PROVIDER_MAPPINGを削除
   - 影響範囲: 過去の知見が失われる可能性
   - 対策: マッピングテーブルをドキュメント化してAPI_Meter側に引き継ぐ

## 実装への指針

### 原則

1. **クレンジング処理のみ実装**
   - 小文字化: `provider.trim().toLowerCase()`
   - 空文字チェック: `cleaned === '' ? 'unknown' : cleaned`

2. **マッピングテーブル削除**
   - `MODEL_MAPPING`を完全削除
   - `PROVIDER_MAPPING`を完全削除

3. **プロバイダーコンテキスト依存の排除**
   - `model-normalizer.ts`の`normalize(model, provider)`の第2引数を削除
   - Bedrock専用ロジックを削除

4. **テスト戦略**
   - クレンジング処理のテスト: 大文字小文字、前後空白、空文字列
   - マッピングテストは削除

5. **ADR 013との関係**
   - ADR 013（正規化層の導入）をSupersededに変更
   - 本ADR 020が後継

6. **段階的移行**
   - Phase 1: クレンジング処理のみの正規化層に変更
   - Phase 2: API_Meter側で正規化機能を実装（別プロジェクト）
   - Phase 3: 既存データの移行（必要に応じて）

### マッピングテーブルの引き継ぎ

削除するマッピングテーブルの知見をAPI_Meter側に引き継ぐため、以下をドキュメント化：

```yaml
# プロバイダー名正規化ルール（API_Meter側で実装）
プロバイダー名マッピング:
  aws-bedrock: aws
  claude: anthropic
  gemini: google
  grok: xai
  x-ai: xai

# モデル名正規化ルール（API_Meter側で実装）
モデル名マッピング:
  claude-3-5-sonnet: claude-3-5-sonnet-20241022  # Anthropic直接
  gpt-4: gpt-4-turbo  # レガシー→現行
  anthropic.claude-3-5-sonnet-20241022-v2:0: claude-3-5-sonnet  # Bedrock ARN
```

## 参考資料

- [ADR 013: 正規化層の導入](/Users/naokikodama/development/Repository/ardama/dify-usage‑exporter/specs/adr/013-normalization-layer-introduction.md) - 本ADRで置き換える既存ADR
- [Single Responsibility Principle (SRP)](https://en.wikipedia.org/wiki/Single-responsibility_principle) - 責務の分離原則
- [Data Fidelity in ETL Processes](https://en.wikipedia.org/wiki/Extract,_transform,_load) - ETLプロセスにおけるデータ忠実性

## 関連情報

- **関連ADR**:
  - ADR 013: 正規化層の導入（本ADRでSupersededに変更）
  - ADR 015: データフロー変更（正規化層の統合）
- **影響を受けるファイル**:
  - `src/normalizer/provider-normalizer.ts` - PROVIDER_MAPPING削除、クレンジング処理のみ
  - `src/normalizer/model-normalizer.ts` - MODEL_MAPPING削除、プロバイダーコンテキスト削除
  - `src/normalizer/normalizer.ts` - プロバイダー引数削除
- **テストファイル**:
  - `src/normalizer/__tests__/provider-normalizer.test.ts` - マッピングテスト削除、クレンジングテストのみ
  - `src/normalizer/__tests__/model-normalizer.test.ts` - マッピングテスト削除、クレンジングテストのみ
