---
story_id: "6"
title: manual-resend-watermark
feature: cli
task_number: "008"
phase: 2
version: 1.0.0
created: 2025-11-22
based_on: specs/stories/6-manual-resend-watermark/plan.md
---

# タスク: Phase 2 完了確認

メタ情報:
- 依存:
  - task-006: ExternalApiSender拡張
  - task-007: resendコマンド実装
- 提供: Phase 2の完了状態
- サイズ: 確認作業のみ

## 確認内容

Phase 2「resendコマンド」の全タスクが完了していることを確認する。

## 確認手順

### 1. テスト実行
```bash
# ExternalApiSender拡張のテスト
npm test -- --run src/sender/__tests__/external-api-sender.test.ts

# resendコマンド統合テスト
npm test -- --run src/cli/__tests__/integration/resend-command.int.test.ts
```

### 2. 手動確認（テスト用失敗ファイル作成後）
```bash
mkdir -p data/failed
echo '{"batchIdempotencyKey":"test123","records":[{"date":"2025-01-20","workspaceId":"ws1","appId":"app1","messageCount":10,"tokenCount":100}],"firstAttempt":"2025-01-20T00:00:00.000Z","retryCount":10,"lastError":"Test error"}' > data/failed/failed_test_test123.json

npm run cli -- resend
npm run cli -- resend --file failed_test_test123.json
npm run cli -- resend --all
```

## 完了条件

### Phase 2 タスク一覧
- [x] task-006: ExternalApiSender拡張（resendFailedFile）
- [x] task-007: resendコマンド実装

### 品質基準
- [x] TypeScript strict mode: エラー0件
- [x] Biome lint: エラー0件
- [x] 全単体テストパス
- [x] 統合テスト（36件）パス
  - resend-command.int.test.ts: 36件

### 動作確認
- [x] 引数なしでファイル一覧表示
- [x] --fileオプションで指定ファイル再送
- [x] --allオプションで全ファイル再送
- [x] 成功時にファイル削除
- [x] 失敗時にエラー表示・ファイル保持
- [x] サマリー表示

## 作業計画書チェックボックス更新

以下の項目をplan.mdで完了としてマーク：

### Task 2-1: ExternalApiSender拡張
- [x] resendFailedFile()メソッド実装完了
- [x] 単体テスト作成・実行完了
- [x] 既存のsend()、resendSpooled()のテストが引き続きパスすること

### Task 2-2: resendコマンド実装と統合テスト作成
- [x] resend.ts実装完了
- [x] 統合テスト作成・実行完了
- [x] 単体テスト作成・実行完了
- [x] 全テストパス

## 次のフェーズへの引き継ぎ

Phase 3で使用するPhase 2の成果物：
- なし（Phase 3はPhase 2と独立）
  - ただしPhase 1のCLI基盤を共有
