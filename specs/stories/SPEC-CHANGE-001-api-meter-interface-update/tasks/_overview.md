# 全体設計書: API_Meter新仕様対応

生成日時: 2025-12-05
対象計画書: specs/stories/SPEC-CHANGE-001-api-meter-interface-update/plan.md

## プロジェクトの全体像

### 目的とゴール
dify-usage-exporterをAPI_Meterの新仕様（2025-12-04版）に対応させるリファクタリングプロジェクト。既存の型システムとデータフローを大幅に変更し、プロバイダー名/モデル名の正規化層を導入する。

### 背景とコンテキスト
- API_Meter側のインターフェース変更に伴い、送信データ形式が変更
- プロバイダー名/モデル名の標準化要件により、正規化層の導入が必要
- 既存の型システム（ExternalApiRecord）から新型システム（ApiMeterRequest/ApiMeterUsageRecord）への完全置き換え
- Bearer Token認証への移行
- 冪等性機構（source_event_id）の導入

## タスク分割の設計

### 分割方針
**ハイブリッドアプローチ**を採用：
- **Phase 1-2**: 水平スライス（基盤実装）- 型定義層、正規化層を独立して実装
- **Phase 3-4**: 垂直スライス（機能統合）- per_model/allモードのデータフローを完全に実装
- **Phase 5**: 品質保証 - コードレビュー、ドキュメント更新、パフォーマンステスト

### 確認可能性レベルの分布
- **Phase 1-2**: L1（ユニットテスト）- 基盤層の実装と単体での動作確認
- **Phase 3**: L2（統合テスト）- 送信層の統合動作確認
- **Phase 4**: L3（E2Eテスト）- データフロー全体の動作確認、API_Meter Sandbox環境での実機テスト
- **Phase 5**: L3（本番環境）- 品質保証、本番環境での最終検証

### タスク間の関連マップ
```
Phase 1: 型定義・正規化層実装（基盤）
  Task 1-1: 新型定義ファイルの作成
    ↓ 成果物: src/types/api-meter-schema.ts
  Task 1-2: 正規化層の実装（Task 1-1に依存）
    ↓ 成果物: src/normalizer/*.ts
  Task 1-3: 環境変数の追加（Task 1-1に依存）
    ↓ 成果物: src/types/env.ts, .env.example

Phase 2: 変換層改修（データ変換）
  Task 2-1: データ変換ロジックの改修（Task 1-1, 1-3に依存）
    ↓ 成果物: src/transformer/data-transformer.ts
  Task 2-2: source_event_id生成ロジックの実装（Task 2-1に依存）
    ↓ 成果物: src/transformer/idempotency-key.ts

Phase 3: 送信層改修（API送信）
  Task 3-1: HTTPクライアントの更新（Task 2-2に依存）
    ↓ 成果物: src/sender/http-client.ts
  Task 3-2: 送信層の更新（Task 3-1に依存）
    ↓ 成果物: src/sender/external-api-sender.ts
  Task 3-3: スプール機構の更新（Task 3-2に依存）
    ↓ 成果物: src/types/spool.ts, src/sender/spool-manager.ts

Phase 4: 統合テスト（E2E検証）
  Task 4-1: データフロー全体の統合（Task 3-3に依存）
    ↓ 成果物: src/index.ts
  Task 4-2: 統合テストの実施（Task 4-1に依存）
    ↓ 成果物: test/integration/api-meter-integration.int.test.ts
  Task 4-3: API_Meter Sandbox環境でのテスト（Task 4-2に依存）
    ↓ 成果物: Sandbox環境での動作確認完了

Phase 5: 品質保証（最終検証）
  Task 5-1: コードレビュー（Task 4-3に依存）
  Task 5-2: ドキュメント更新（Task 5-1に依存）
    ↓ 成果物: README.md, CHANGELOG.md, ADR更新
  Task 5-3: パフォーマンステスト（Task 5-1に依存）
    ↓ 成果物: scripts/performance-test.ts
  Task 5-4: 最終検証（Task 5-2, 5-3に依存）
```

### インターフェース変更の影響分析

| レイヤー | 既存インターフェース | 新インターフェース | 変換必要性 | 対応タスク |
|---------|-------------------|-----------------|-----------|-----------|
| 型定義 | ExternalApiRecord | ApiMeterRequest, ApiMeterUsageRecord | あり（完全置き換え） | Task 1-1 |
| 正規化 | なし | NormalizedModelRecord | あり（新規導入） | Task 1-2 |
| 変換 | AggregatedModelRecord → ExternalApiRecord | NormalizedModelRecord → ApiMeterRequest | あり | Task 2-1 |
| 認証 | X-API-Key | Bearer Token | あり | Task 3-1 |
| 冪等性 | なし | source_event_id | あり（新規導入） | Task 2-2 |
| スプール | ExternalApiRecord | ApiMeterRequest | あり（変換ロジック） | Task 3-3 |

### 共通化ポイント

#### 1. zodスキーマによるバリデーション
- `api-meter-schema.ts` で定義したzodスキーマを全レイヤーで共通利用
- total_tokens検証（input_tokens + output_tokens = total_tokens）を一箇所で実装
- Task 1-1で実装し、Task 2-1で利用

#### 2. 正規化マッピングテーブル
- `PROVIDER_MAPPING`, `MODEL_MAPPING` を定数として一箇所に集約（Task 1-2）
- 各マッピングは `Record<string, string>` 型でO(1)参照
- 不明なプロバイダー/モデルは "unknown" にfallback

#### 3. エラーハンドリング
- リトライロジックを `http-client.ts` に集約（Task 3-1）
- スプール保存ロジックを `spool-manager.ts` に集約（Task 3-3）
- エラーメッセージの詳細化を `external-api-sender.ts` に集約（Task 3-2）

#### 4. 日付フォーマット
- 日付範囲計算（`getDateRangeStart()`, `getDateRangeEnd()`）を `data-transformer.ts` に集約（Task 2-1）
- YYYY-MM-DD, ISO8601形式の統一

## 実装時の注意事項

### 全体を通じて守るべき原則

1. **型安全性の維持**
   - any型の使用禁止
   - unknown型と型ガードを活用
   - zodスキーマで実行時バリデーション

2. **テストファースト（Red-Green-Refactor）**
   - 実装前に失敗するテストを作成
   - 最小限の実装でテストを通す
   - リファクタリングでコード改善

3. **段階的な変更**
   - 各タスクは独立して実行可能
   - 1タスク = 1コミット粒度
   - Phase完了ごとに全体動作確認

4. **既存コードとの互換性**
   - 旧形式スプールファイルの変換サポート（Task 3-3）
   - `ExternalApiRecord` に `@deprecated` タグ追加（Task 1-1）
   - 段階的な移行パス確保

### リスクと対策

#### リスク1: データ構造の不一致
**リスク**: API_Meter新仕様とExternalApiRecordの構造が大きく異なり、変換時にデータ欠損や型不一致が発生する可能性

**影響度**: 高（送信エラーが多発）

**緩和策**:
- zodスキーマで厳密なバリデーション実施（Task 1-1）
- total_tokens検証（input_tokens + output_tokens = total_tokens）を実装（Task 2-1）
- 変換エラー時は詳細ログを出力し、スプール保存（Task 3-3）
- Phase 4で統合テストを徹底実施（Task 4-2）

#### リスク2: 既存データの互換性
**リスク**: 旧形式スプールファイルに provider/model 情報が含まれず、新形式への変換時にデータ欠損が発生

**影響度**: 中（旧形式スプールファイルが"unknown"で送信される）

**緩和策**:
- 旧形式スプールファイルは provider/model を "unknown" に設定（Task 3-3）
- API_Meter側で "unknown" を受け入れる仕様を確認済み
- 変換失敗時は `data/failed/` へ移動し、手動対応を要求（Task 3-3）

#### リスク3: 正規化ロジックの保守性
**リスク**: マッピングテーブルが肥大化し、新しいプロバイダー/モデル追加時に保守が困難になる

**影響度**: 中（長期的な保守性低下）

**緩和策**:
- マッピングテーブルは定数として一箇所に集約（Task 1-2）
- 各マッピングエントリに対してユニットテスト作成（Task 1-2）
- 不明なプロバイダー/モデルは "unknown" で送信可能（fallback）

### 影響範囲の管理

#### 変更が許可される範囲
- `src/types/` - 型定義ファイルの追加・更新
- `src/normalizer/` - 正規化層の新規追加
- `src/transformer/` - データ変換ロジックの改修
- `src/sender/` - 送信層の改修
- `src/index.ts` - データフロー統合
- `test/` - テストファイルの追加・更新
- `.env.example` - 環境変数サンプルの更新
- `README.md`, `CHANGELOG.md` - ドキュメントの更新

#### 変更禁止エリア
- `src/fetcher/` - Dify API取得ロジック（スコープ外）
- `src/aggregator/` - 集計ロジック（スコープ外）
- スケジューラー・監視機構（スコープ外）
- CLI機能（スコープ外）

## タスク実行時のチェックリスト

各タスク実行時は以下を確認すること：

### 実装前
- [ ] 依存タスクの成果物が存在することを確認
- [ ] タスクの影響範囲を理解
- [ ] 既存コードとの整合性を確認

### 実装中
- [ ] TDD（Red-Green-Refactor）サイクルを遵守
- [ ] any型を使用しない
- [ ] zodスキーマでバリデーション実装
- [ ] エラーハンドリングを適切に実装

### 実装後
- [ ] ユニットテストが全てパス
- [ ] TypeScript strict mode: エラー0件
- [ ] Biome lint: エラー0件
- [ ] 動作確認完了（L1/L2/L3のいずれか）
- [ ] 成果物が生成されている（該当する場合）

## 参考資料

- [作業計画書](../plan.md)
- [Design Document](../design.md)
- [ADR 013-019](../../adr/)
- [API_Meter API Documentation](https://api-meter.example.com/docs)
