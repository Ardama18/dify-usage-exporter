# 全体設計書: Dify使用量データ取得機能

生成日時: 2025-11-21
対象計画書: specs/stories/2-dify-usage-fetcher/plan.md

## プロジェクトの全体像

### 目的とゴール
Dify Console APIから使用量データを取得し、ウォーターマーク方式による差分取得を実現する。これにより、効率的かつ信頼性の高いデータ取得基盤を構築する。

### 背景とコンテキスト
- Dify使用量をBigQueryにエクスポートするシステムの一部
- Story 1（基盤）の上に構築し、Story 3（データ変換）、Story 4（外部送信）と連携予定
- ウォーターマーク方式により重複取得0%を保証

## タスク分割の設計

### 分割方針
**垂直スライスアプローチ**を採用。各コンポーネントが独立して実装・テスト可能な粒度で分割。

確認可能性レベル分布:
- L1（コンパイル・型チェック）: Task 001-004
- L2（単体テスト）: Task 005-007
- L3（統合テスト）: Task 008-010

### タスク間の関連マップ

```
Phase 1: 基盤
  Task 001: 型定義・zodスキーマ
    ↓
  Task 002: Fetcherインターフェース → 成果物: src/interfaces/fetcher.ts
    ↓
  Task 003: 環境変数スキーマ拡張 → 成果物: src/types/env.ts拡張
    ↓
  Task 004: カスタムエラークラス → 成果物: src/errors/dify-api-error.ts

Phase 2: データ層（依存: Phase 1）
  Task 005: WatermarkManager → 成果物: src/watermark/watermark-manager.ts

Phase 3: 通信層（依存: Phase 1）
  Task 006: DifyApiClient → 成果物: src/fetcher/dify-api-client.ts

Phase 4: ビジネス層（依存: Phase 2, 3）
  Task 007: DifyUsageFetcher → 成果物: src/fetcher/dify-usage-fetcher.ts

Phase 5: 品質保証（依存: Phase 4）
  Task 008: 統合テスト実装・実行
    ↓
  Task 009: E2Eテスト実行
    ↓
  Task 010: 品質チェック・最終確認
```

### 並列実行可能性
- Phase 2（Task 005）とPhase 3（Task 006）は並列実行可能
- Phase 1のタスクは順序依存（001→002→003→004）
- Phase 5のタスクは順序依存（008→009→010）

### インターフェース変更の影響分析

| 既存コンポーネント | 変更内容 | 影響度 | 対応タスク |
|-------------------|---------|--------|-----------|
| src/types/env.ts | 環境変数スキーマ拡張 | 中 | Task 003 |
| src/config/env-config.ts | 環境変数読み込み追加（必要に応じて） | 低 | Task 003 |

### 共通化ポイント
- zodスキーマのバリデーション関数（Task 001で定義、全タスクで使用）
- エラーコード定数（Task 004で定義）
- 日付フォーマット関数（Task 007で定義）

## 実装時の注意事項

### 全体を通じて守るべき原則
1. **TDD実践**: Red-Green-Refactorサイクルを各タスクで実践
2. **型安全性**: any型禁止、strict mode準拠
3. **依存性注入**: テスト容易性のため全コンポーネントでDI採用
4. **ADR準拠**: ADR 002（リトライ）、ADR 007（HTTPクライアント）、ADR 009（アーキテクチャ）に準拠

### リスクと対策
| リスク | 対策 |
|--------|------|
| Dify API仕様の不確実性 | zodスキーマでバリデーション、エラー早期検出 |
| リトライロジックの複雑性 | axios-retry採用で実装簡素化 |
| ウォーターマーク破損 | バックアップ・復元機能実装 |
| メモリ使用量超過 | ページング処理、即時コールバック処理 |

### 影響範囲の管理
- **変更許可範囲**: src/fetcher/, src/watermark/, src/types/, src/interfaces/, src/errors/
- **変更禁止エリア**: src/scheduler/, src/shutdown/, src/index.ts（将来統合予定）

## 品質基準

### 完了条件（全タスク共通）
- TypeScript strict mode: エラー0件
- Biome lint: エラー0件
- 単体テストカバレッジ: 70%以上

### 受入条件（AC）数
- 総AC数: 30件
- FR-1: 3件、FR-2: 4件、FR-3: 4件
- FR-4: 6件、FR-5: 5件、FR-6: 4件
- 非機能要件: 4件

## テスト戦略

### テストファイル配置
- 単体テスト: test/unit/{対象ディレクトリ}/{ファイル名}.test.ts
- 統合テスト: test/integration/dify-usage-fetcher.int.test.ts
- E2Eテスト: test/e2e/dify-usage-fetcher.e2e.test.ts

### テスト件数
- 統合テスト: 59件
- E2Eテスト: 44件
