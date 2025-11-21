# Story 4: External API Sender - タスク一覧

生成日時: 2025-01-21
元ドキュメント: specs/stories/4-external-api-sender/plan.md

## タスク構成概要

合計19ファイル（全体設計書1 + 実装タスク12 + 完了タスク6）

### 全体設計書
- `_overview.md` - プロジェクト全体像、タスク分割方針、影響範囲分析

### Phase 0: セットアップと共通型定義（0.5日）
- `phase0-001-setup-dependencies-types.md` - 依存パッケージと型定義
- `phase0-completion.md` - Phase 0完了確認

### Phase 1: HTTPクライアント層（2-3日）
- `phase1-001-env-config-extension.md` - 環境変数定義と拡張
- `phase1-002-http-client-implementation.md` - HttpClientクラス実装
- `phase1-003-retry-policy-utility.md` - RetryPolicyユーティリティ実装
- `phase1-completion.md` - Phase 1完了確認

### Phase 2: スプール管理層（2-3日）
- `phase2-001-file-utils-implementation.md` - ファイル操作ユーティリティ実装
- `phase2-002-spool-manager-implementation.md` - SpoolManagerクラス実装
- `phase2-completion.md` - Phase 2完了確認

### Phase 3: 送信層統合（3-4日）
- `phase3-001-external-api-sender-implementation.md` - ExternalApiSenderクラス実装
- `phase3-002-integration-test-e2e.md` - 統合テスト作成（E2Eフロー）
- `phase3-completion.md` - Phase 3完了確認

### Phase 4: エラー通知統合（1-2日）
- `phase4-001-notifier-interface-mock.md` - INotifierインターフェース定義とモック実装
- `phase4-002-failed-notification-integration.md` - data/failed/移動時の通知送信実装
- `phase4-completion.md` - Phase 4完了確認

### Phase 5: メトリクス拡張と最終統合（1日）
- `phase5-001-metrics-extension.md` - ExecutionMetrics型拡張
- `phase5-002-final-integration-quality.md` - 最終統合テストと品質保証
- `phase5-completion.md` - Phase 5完了確認

## 実行順序

各Phaseは順番に実行すること（Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5）。

各Phase内のタスクも番号順に実行（例: phase1-001 → phase1-002 → phase1-003）。

各Phase完了後は必ず対応するcompletion.mdでplan.mdのチェックボックスを確認すること。

## 重要な注意事項

1. **TDDプロセス**: 全タスクでRed-Green-Refactorサイクルを厳守
2. **依存関係**: 各タスクの「依存」セクションを確認し、前提となる成果物が存在することを確認
3. **確認レベル**: L1（単体テスト）→ L2（モジュール統合）→ L3（E2Eシナリオ）の順で確認精度が上がる
4. **カバレッジ**: 最終的に単体テストカバレッジ70%以上を達成すること

## 成果物管理

各タスクの「提供」セクションに記載された成果物を必ず生成すること。
後続タスクがこれらの成果物に依存している。
