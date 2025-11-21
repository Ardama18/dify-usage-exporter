---
id: "3"
feature: data-transformation
type: adr
version: 1.0.0
created: 2025-01-21
based_on: 要件分析結果（requirements.mdなし）
---

# ADR 010: データ変換アーキテクチャ

## ステータス

Proposed

## コンテキスト

Story 3では、Dify APIから取得した使用量データ（DifyUsageRecord）を外部API仕様に適合する形式（ExternalApiRecord）に変換し、冪等キーを生成する機能を実装する必要がある。

以下の技術的決定が必要：

1. **データ変換アーキテクチャの選択**: 変換ロジックの責務分離とテスタビリティ
2. **ITransformerインターフェースの設計**: 依存性注入とモック可能性
3. **冪等キー生成方式**: レコード単位とバッチ単位の一意性保証
4. **日時処理ライブラリの選択**: ISO 8601フォーマット統一

**制約事項**:
- 10,000レコードを5秒以内に変換する性能要件
- 変換エラー時は失敗レコードを破棄し、成功レコードのみ送信
- provider/modelは全て小文字に正規化、前後空白を除去

## 決定事項

### 1. 関数ベースの変換アーキテクチャを採用

ITransformerインターフェースを関数とオブジェクトで実装し、クラスを使用しない。

```typescript
export interface ITransformer {
  transform(records: DifyUsageRecord[]): TransformResult
}

export interface TransformResult {
  records: ExternalApiRecord[]
  idempotencyKey: string
  errors: TransformError[]
}
```

### 2. Node.js crypto による SHA256ハッシュ生成

冪等キー生成にはNode.js標準の`crypto`モジュールを使用。外部依存を追加しない。

```typescript
import crypto from 'crypto'

function generateBatchIdempotencyKey(recordKeys: string[]): string {
  const sorted = [...recordKeys].sort()
  return crypto.createHash('sha256').update(sorted.join(',')).digest('hex')
}
```

### 3. date-fns v3 による日時処理

ISO 8601フォーマット統一とタイムゾーン処理にdate-fns v3を使用。

### 4. 責務分離した3つのモジュール構成

- `src/transformer/data-transformer.ts`: 変換オーケストレーション
- `src/transformer/idempotency-key.ts`: 冪等キー生成
- `src/types/external-api.ts`: ExternalApiRecord型定義とスキーマ

## 根拠

### 検討した選択肢

#### 1. クラスベースの変換器

```typescript
class DataTransformer implements ITransformer {
  transform(records: DifyUsageRecord[]): TransformResult { ... }
}
```

- 利点: OOPパターンに慣れた開発者に馴染みやすい、状態を持てる
- 欠点: 不要な状態管理、テストでのモック複雑化、TypeScript規約で非推奨

#### 2. 関数ベースの変換器（採用）

```typescript
function createTransformer(deps: TransformerDeps): ITransformer {
  return {
    transform(records) { ... }
  }
}
```

- 利点: 依存性注入が明確、テストが容易、プロジェクト規約に準拠、関数合成の柔軟性
- 欠点: OOPに慣れた開発者には異質に感じる可能性

#### 3. 単純な関数のみ（インターフェースなし）

```typescript
function transformRecords(records: DifyUsageRecord[]): TransformResult { ... }
```

- 利点: 最もシンプル
- 欠点: 依存性注入困難、モック困難、将来の拡張性が低い

### 採用理由

関数ベースの変換器（選択肢2）を採用する理由：

1. **プロジェクト規約準拠**: TypeScript規約で「推奨：関数とinterfaceでの実装」と定義
2. **IFetcherとの一貫性**: Story 2で実装したIFetcherと同じパターンを採用し、アーキテクチャの一貫性を保持
3. **テスタビリティ**: 依存性注入によりモックが容易
4. **YAGNI原則**: 状態を持たない変換処理にクラスは不要

### 冪等キー生成方式の選択

#### レコード単位冪等キー

```
{date}_{app_id}_{provider}_{model}
```

- エピック方針書で定義済み
- 同一日付・アプリ・プロバイダー・モデルの組み合わせで一意

#### バッチ単位冪等キー

```
SHA256(ソート済みレコード冪等キー結合)
```

- IETF Draft RFC（Idempotency-Key HTTP Header Field）のフィンガープリント方式に準拠
- ソートにより順序に依存しない決定的なキー生成
- SHA256は暗号学的に安全で衝突耐性が高い

#### 日時処理ライブラリの選択

1. **Native Date + toISOString()**: シンプルだがタイムゾーン処理が困難
2. **date-fns v3（採用）**: エピック技術スタックで定義済み、TypeScript 100%対応、必要な機能のみインポート可能
3. **dayjs**: 軽量だがプロジェクトで採用されていない

## 影響

### ポジティブな影響

- **一貫性のあるアーキテクチャ**: IFetcherと同じパターンでコードベースの統一感向上
- **高いテスタビリティ**: 依存性注入により単体テストが容易
- **明確な責務分離**: 変換、冪等キー生成、型定義が独立
- **性能保証**: Node.js cryptoは高速で10,000レコード/5秒を達成可能

### ネガティブな影響

- **モジュール数増加**: 3つのモジュールに分離するため、初期の理解コストが増加
- **date-fns依存**: 新規ライブラリ追加（ただしエピック技術スタックで承認済み）

### 中立的な影響

- **エラーハンドリング方針**: 失敗レコードを破棄し成功レコードのみ処理（要件として定義済み）

## 実装への指針

1. **依存性注入パターン**: `createTransformer(deps)`ファクトリ関数でロガー等を注入
2. **入力バリデーション**: zodスキーマでDifyUsageRecord、ExternalApiRecord両方を検証
3. **正規化処理**: provider/modelは変換前に正規化（小文字化、空白除去）
4. **エラー収集**: TransformError[]で変換エラーを収集し、成功レコードと分離して返却
5. **冪等キー生成**: レコード変換時に同時生成し、バッチキーは全レコード変換後に生成

## 参考資料

- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html): SHA256ハッシュ生成の公式ドキュメント
- [date-fns v3 Release Blog](https://blog.date-fns.org/v3-is-out/): TypeScript 100%対応、ESM対応の詳細
- [IETF Idempotency-Key Header Field Draft](https://greenbytes.de/tech/webdav/draft-ietf-httpapi-idempotency-key-header-latest.html): 冪等キーのフィンガープリント方式
- [Stripe Idempotency Design](https://stripe.com/blog/idempotency): 冪等性設計のベストプラクティス

## 関連情報

- [specs/adr/009-dify-fetcher-architecture.md](specs/adr/009-dify-fetcher-architecture.md): IFetcherインターフェース設計（同じパターンを踏襲）
- [specs/epics/1-dify-usage-exporter/epic.md](specs/epics/1-dify-usage-exporter/epic.md): 冪等キー生成方式の定義
