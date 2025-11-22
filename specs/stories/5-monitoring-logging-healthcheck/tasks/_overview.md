# 全体設計書: モニタリング・ロギング・ヘルスチェック機能

生成日時: 2025-11-22
対象計画書: specs/stories/5-monitoring-logging-healthcheck/plan.md

## プロジェクトの全体像

### 目的とゴール
Dify使用量エクスポーターにモニタリング・ロギング・ヘルスチェック機能を実装し、運用可視性とコンテナオーケストレーション環境での死活監視を実現する。

### 背景とコンテキスト
- コンテナ環境（Docker、Kubernetes）での運用を想定
- ジョブ実行状況の可視化が必要
- 死活監視による自動復旧の基盤構築

## タスク分割の設計

### 分割方針
- **垂直スライス**: Phase単位で機能的に独立した単位で分割
- **TDD形式**: 各タスクでRed-Green-Refactorサイクルを実践
- **確認可能性レベル**: L2（統合確認）を基本とし、Phase 3でL3（E2E確認）

### タスク間の関連マップ

```
Phase 1: ヘルスチェックサーバー
├── task-001: 環境変数スキーマ拡張（基盤）
├── task-002: HealthCheckServer実装（主機能）
├── task-003: GracefulShutdown統合（統合）
├── task-004: 統合テスト作成・実行（品質確認）
└── phase1-completion: Phase 1完了確認

Phase 2: メトリクス収集・出力
├── task-005: MetricsCollector実装（収集）
├── task-006: MetricsReporter実装（出力）
├── task-007: index.ts統合（メイン統合）
├── task-008: 統合テスト作成・実行（品質確認）
└── phase2-completion: Phase 2完了確認

Phase 3: 統合・品質保証
├── task-009: 全テスト実行・品質チェック（品質基準）
├── task-010: E2Eテスト実行（E2E検証）
├── task-011: E2E確認手順実施（最終確認）
└── phase3-completion: Phase 3完了確認
```

### 共通化ポイント
- 環境変数スキーマ: `src/types/env.ts` でヘルスチェック関連設定を一元管理
- ロガー: 既存の `ILogger` インターフェースを活用
- シャットダウン: 既存の `GracefulShutdown` パターンを拡張

## 実装時の注意事項

### 全体を通じて守るべき原則
1. **既存コードへの影響最小化**: 既存のジョブ処理、送信処理への影響なし
2. **TDD徹底**: 必ず失敗するテストから開始
3. **型安全性**: TypeScript strict mode準拠

### リスクと対策
- **ポート競合**: EADDRINUSE エラーハンドリングを実装
- **パフォーマンス**: メトリクス操作は単純なカウンター加算のみ
- **シャットダウン順序**: HealthCheckServerを最初に停止

### 影響範囲の管理
- **変更が許可される範囲**:
  - `src/types/env.ts`: ヘルスチェック関連環境変数追加
  - `src/healthcheck/`: 新規ディレクトリ
  - `src/monitoring/`: 新規ディレクトリ
  - `src/shutdown/graceful-shutdown.ts`: オプション拡張
  - `src/index.ts`: メトリクス統合

- **変更禁止エリア**:
  - `src/fetcher/`: 既存フェッチ処理
  - `src/transformer/`: 既存変換処理
  - `src/sender/`: 既存送信処理（インターフェース以外）
