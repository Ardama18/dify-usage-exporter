---
story_id: 4
title: external-api-sender
epic_id: 1
type: phase-completion
feature: external-api-sender
phase: 4
version: 1.0.0
created: 2025-01-21
based_on: specs/stories/4-external-api-sender/plan.md
---

# Phase 4完了確認: エラー通知統合

## フェーズ概要
- **目的**: INotifier連携、data/failed/移動時の通知送信
- **期間**: 1-2日

## 完了タスク一覧
- [x] Task 4-1: INotifierインターフェース定義とモック実装（phase4-001-notifier-interface-mock.md）
- [x] Task 4-2: data/failed/移動時の通知送信実装（phase4-002-failed-notification-integration.md）

## plan.mdチェックボックス確認

### フェーズ完了条件
- [ ] retryCount ≥ 10時にdata/failed/へ移動
- [ ] 移動時にINotifier.sendErrorNotification()が呼ばれる
- [ ] ConsoleNotifierでログ出力される
- [ ] 統合テストがすべてパス

## 次フェーズへの引き継ぎ
- **成果物**:
  - src/interfaces/notifier.ts
  - src/notifier/console-notifier.ts
  - src/sender/external-api-sender.ts（拡張）
- **Phase 5への依存**: メトリクス拡張と最終統合テスト

## 動作確認（L3）
```bash
cd backend
# テストスプールファイル作成（retryCount=10）
# Sender.resendSpooled()を実行
# data/failed/へファイルが移動されているか確認
ls -la data/failed/
# ConsoleNotifierのログ出力を確認（通知内容）
npm run test:unit -- src/sender/__tests__/integration/sender-e2e.int.test.ts
```
