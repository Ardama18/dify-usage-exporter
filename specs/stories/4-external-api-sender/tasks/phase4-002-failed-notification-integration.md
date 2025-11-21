---
story_id: 4
title: external-api-sender
epic_id: 1
type: task
feature: external-api-sender
phase: 4
task_number: 002
version: 1.0.0
created: 2025-01-21
based_on: specs/stories/4-external-api-sender/plan.md
---

# タスク: data/failed/移動時の通知送信実装

## メタ情報
- 依存:
  - phase4-001（INotifier定義）
  - phase3-001（ExternalApiSender実装）
- 提供: src/sender/external-api-sender.ts（拡張）
- サイズ: 小規模（既存ファイル拡張）
- 確認レベル: L3（E2Eシナリオテスト）

## 実装内容
ExternalApiSender.resendSpooled()にINotifier呼び出しを追加、data/failed/移動時の通知送信実装。

## 対象ファイル
- [ ] src/sender/external-api-sender.ts（拡張）
- [ ] src/sender/__tests__/integration/sender-e2e.int.test.ts（拡張）

## 実装手順（TDD: Red-Green-Refactor）
### 1-3. 通知送信実装
- [ ] ExternalApiSenderコンストラクタにINotifierを追加
- [ ] resendSpooled()内でdata/failed/移動時に通知送信
- [ ] 統合テスト拡張（通知送信確認）

## 完了条件
- [ ] data/failed/移動時に通知が送信される
- [ ] 統合テストがパス（通知送信確認）
- [ ] 成果物作成完了
