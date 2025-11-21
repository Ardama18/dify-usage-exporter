---
story_id: 4
title: external-api-sender
epic_id: 1
type: phase-completion
feature: external-api-sender
phase: 3
version: 1.0.0
created: 2025-01-21
based_on: specs/stories/4-external-api-sender/plan.md
---

# Phase 3完了確認: 送信層統合

## フェーズ概要
- **目的**: ExternalApiSender実装、リトライ→スプール→再送→data/failed/のフロー統合
- **期間**: 3-4日

## 完了タスク一覧
- [x] Task 3-1: ExternalApiSenderクラス実装（phase3-001-external-api-sender-implementation.md）
- [x] Task 3-2: 統合テスト作成（E2Eフロー）（phase3-002-integration-test-e2e.md）

## plan.mdチェックボックス確認

### フェーズ完了条件
- [x] 送信 → リトライ → 成功のフロー動作
- [x] 送信 → スプール保存 → 再送 → 成功のフロー動作
- [x] 409レスポンスが成功扱いになる
- [x] 統合テストがすべてパス

## 次フェーズへの引き継ぎ
- **成果物**:
  - src/sender/external-api-sender.ts
  - src/sender/__tests__/integration/sender-e2e.int.test.ts
- **Phase 4への依存**: SenderにINotifier呼び出しを追加

## 動作確認（L3）
```bash
cd backend
# モックAPIサーバーを起動（初回は常に500、再送時は200）
# Sender.send()を実行（初回）
# スプールファイルが作成されているか確認
ls -la data/spool/
# Sender.resendSpooled()を実行（再送）
# スプールファイルが削除されているか確認
# ログ出力を確認（送信成功、スプール保存、再送成功）
npm run test:unit -- src/sender/__tests__/integration/sender-e2e.int.test.ts
```
