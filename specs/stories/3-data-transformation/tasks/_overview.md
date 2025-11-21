# 全体設計書: Data Transformation

生成日時: 2025-11-21
対象計画書: specs/stories/3-data-transformation/plan.md

## プロジェクトの全体像

### 目的とゴール

Dify APIから取得した使用量データ（DifyUsageRecord）を外部API仕様に適合する形式（ExternalApiRecord）に変換し、冪等キーを生成するモジュールを実装する。

### 背景とコンテキスト

- Story 2（DifyUsageFetcher）で取得したデータを、Story 4（外部API送信）に適した形式に変換する必要がある
- 冪等キーにより重複送信を防止し、データ整合性を保証する
- パフォーマンス要件として10,000レコードを5秒以内に変換する必要がある

## タスク分割の設計

### 分割方針

- **垂直スライス採用**: 機能が独立して完結し、外部依存が最小であるため
- **TDDアプローチ**: 各タスクはRed-Green-Refactorサイクルで実装
- **確認可能性レベル**: L2（単体テスト実行）を基準

### タスク間の関連マップ

```
Phase 1: 基盤
├── Task 1-1: ExternalApiRecord型定義
│   └── 成果物: src/types/external-api.ts
├── Task 1-2: ITransformerインターフェース（Task 1-1に依存）
│   └── 成果物: src/interfaces/transformer.ts
└── Task 1-3: 日時ユーティリティ
    └── 成果物: src/utils/date-utils.ts

Phase 2: 冪等キー
├── Task 2-1: レコード冪等キー生成（Task 1-2に依存）
│   └── 成果物: src/transformer/idempotency-key.ts（レコードキー部分）
└── Task 2-2: バッチ冪等キー生成（Task 2-1に依存）
    └── 成果物: src/transformer/idempotency-key.ts（バッチキー部分）

Phase 3: 変換統合
├── Task 3-1: 正規化処理（Task 1-3, 2-2に依存）
│   └── 成果物: src/transformer/data-transformer.ts（正規化部分）
├── Task 3-2: DataTransformer実装（Task 3-1に依存）
│   └── 成果物: src/transformer/data-transformer.ts（変換部分）
└── Task 3-3: 統合テスト（Task 3-2に依存）
    └── 成果物: test/integration/data-transformation.int.test.ts

Phase 4: 最終検証
├── Task 4-1: パフォーマンステスト（Task 3-3に依存）
├── Task 4-2: E2Eテスト実行（Task 4-1に依存）
└── Task 4-3: 品質チェックと最終確認（Task 4-2に依存）
```

### インターフェース変更の影響分析

| 既存インターフェース | 新インターフェース | 変換必要性 | 対応タスク |
|-------------------|-----------------|-----------|-----------|
| DifyUsageRecord[] | ExternalApiRecord[] | あり | Task 3-2 |
| なし | ITransformer | 新規追加 | Task 1-2 |
| なし | TransformResult | 新規追加 | Task 1-2 |

### 共通化ポイント

1. **正規化関数**: `normalizeProvider`, `normalizeModel`は内部関数として共通化
2. **日時処理**: `date-fns`を使用した日時フォーマット
3. **エラー収集パターン**: TransformError型による統一的なエラー記録

## 実装時の注意事項

### 全体を通じて守るべき原則

1. **関数ファクトリパターン**: IFetcherと同様に`createDataTransformer`形式で実装
2. **依存性注入**: TransformerDepsによるLogger注入
3. **zodバリデーション**: 入出力ともにスキーマ検証を実施
4. **例外スローなし**: 全てのエラーをTransformResult.errorsに格納

### リスクと対策

- **リスク**: SHA256ハッシュ衝突
  - 対策: 64文字16進数を使用（256ビット）
  - 検知: 単体テストでユニーク性検証

- **リスク**: パフォーマンス未達
  - 対策: 単一ループ処理、事前計算の最適化
  - 検知: ベンチマークテスト（10,000レコード/5秒）

- **リスク**: zodバリデーション過剰
  - 対策: safeParse使用、エラー収集パターン
  - 検知: 統合テストでエラー処理検証

### 影響範囲の管理

- **変更が許可される範囲**:
  - 新規ファイル: src/types/external-api.ts, src/interfaces/transformer.ts, src/transformer/*, src/utils/date-utils.ts
  - テストファイル: test/unit/*, test/integration/*, test/e2e/*
  - package.json（date-fns追加）

- **変更禁止エリア**:
  - 既存のfetcher, watermark, logger, config実装
  - 既存のDifyUsageRecord型定義

## タスク一覧

| タスク番号 | タスク名 | フェーズ | サイズ | 確認レベル |
|-----------|---------|---------|--------|-----------|
| 001 | ExternalApiRecord型定義 | Phase 1 | 小規模（2ファイル） | L2 |
| 002 | ITransformerインターフェース | Phase 1 | 小規模（1ファイル） | L2 |
| 003 | 日時ユーティリティ | Phase 1 | 小規模（2ファイル） | L2 |
| 004 | レコード冪等キー生成 | Phase 2 | 小規模（2ファイル） | L2 |
| 005 | バッチ冪等キー生成 | Phase 2 | 小規模（1ファイル） | L2 |
| 006 | 正規化処理 | Phase 3 | 小規模（2ファイル） | L2 |
| 007 | DataTransformer実装 | Phase 3 | 中規模（2ファイル） | L2 |
| 008 | 統合テスト | Phase 3 | 小規模（1ファイル） | L2 |
| 009 | パフォーマンステスト | Phase 4 | 小規模（1ファイル） | L2 |
| 010 | E2Eテスト実行 | Phase 4 | 小規模（1ファイル） | L2 |
| 011 | 品質チェックと最終確認 | Phase 4 | 小規模 | L3 |

## 依存パッケージ

- `date-fns`: ^3.0.0（日時処理）- Task 1-3で追加
- `zod`: 既存（バリデーション）
- `crypto`: Node.js標準（SHA256ハッシュ）

## 品質基準

- カバレッジ: 70%以上
- 型安全性: TypeScript strict mode
- コード品質: Biomeによる静的解析
- パフォーマンス: 10,000レコード/5秒以内
