---
story_id: 4
title: external-api-sender
epic_id: 1
type: task
feature: external-api-sender
phase: 5
task_number: 002
version: 1.0.0
created: 2025-01-21
based_on: specs/stories/4-external-api-sender/plan.md
---

# タスク: 最終統合テストと品質保証

## メタ情報
- 依存: phase5-001（メトリクス拡張）
- 提供: 全体品質保証完了
- サイズ: 中規模（品質チェック）
- 確認レベル: L3（E2Eシナリオテスト + 品質保証）

## 実装内容
全単体テスト実行（カバレッジ70%以上確認）、全統合テスト実行、TypeScriptビルド確認、Biomeチェック実行、エラーシナリオテスト実行。

## 完了条件（最終確認）
- [x] 全単体テスト実行: `npm test`
- [x] カバレッジ70%以上: `npm run test:coverage`（Statements: 96.47%, Branches: 87.83%, Functions: 96.35%, Lines: 96.7%）
- [x] TypeScriptビルド: `npm run build`
- [x] Biomeチェック: `npm run check`
- [x] E2Eフロー確認:
  - 送信成功 → ログ確認
  - リトライ成功 → ログ確認
  - スプール保存 → data/spool/確認
  - スプール再送 → data/spool/削除確認
  - data/failed/移動 → data/failed/確認 → 通知確認
- [x] エラーシナリオテスト実行:
  - ネットワークタイムアウト
  - 429 Too Many Requests
  - 400 Bad Request（リトライしない）
  - 401 Unauthorized（リトライしない）
