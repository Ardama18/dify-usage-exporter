---
story_id: "6"
title: manual-resend-watermark
feature: cli
task_number: "011"
phase: 3
version: 1.0.0
created: 2025-11-22
based_on: specs/stories/6-manual-resend-watermark/plan.md
---

# タスク: Phase 3 完了確認

メタ情報:
- 依存:
  - task-009: promptユーティリティ実装
  - task-010: watermarkコマンド実装
- 提供: Phase 3の完了状態
- サイズ: 確認作業のみ

## 確認内容

Phase 3「watermarkコマンド」の全タスクが完了していることを確認する。

## 確認手順

### 1. テスト実行
```bash
# promptユーティリティのテスト
npm test -- --run src/cli/__tests__/utils/prompt.test.ts

# watermarkコマンド統合テスト
npm test -- --run src/cli/__tests__/integration/watermark-command.int.test.ts
```

### 2. 手動確認
```bash
npm run cli -- watermark show
npm run cli -- watermark reset --date 2025-01-01T00:00:00.000Z
# 確認プロンプトでy入力
npm run cli -- watermark show  # 更新確認

# エラーケース確認
npm run cli -- watermark reset --date invalid-date  # バリデーションエラー
npm run cli -- watermark reset  # --dateオプション未指定エラー
```

## 完了条件

### Phase 3 タスク一覧
- [x] task-009: promptユーティリティ実装
- [x] task-010: watermarkコマンド実装

### 品質基準
- [x] TypeScript strict mode: エラー0件
- [x] Biome lint: エラー0件
- [x] 全単体テストパス
- [x] 統合テスト（29件）パス
  - watermark-command.int.test.ts: 29件

### 動作確認
- [x] showサブコマンドで現在値表示
- [x] 未設定時の「未設定」メッセージ
- [x] resetサブコマンドで確認プロンプト表示
- [x] 確認「y」でリセット
- [x] 確認「y」以外でキャンセル
- [x] 不正日時形式でエラー・exit 1

## 作業計画書チェックボックス更新

以下の項目をplan.mdで完了としてマーク：

### Task 3-1: promptユーティリティ実装
- [x] prompt.ts実装完了
- [x] 単体テスト作成・実行完了
- [x] 全テストパス

### Task 3-2: watermarkコマンド実装と統合テスト作成
- [x] watermark.ts実装完了
- [x] 統合テスト作成・実行完了
- [x] 単体テスト作成・実行完了
- [x] 全テストパス

## 次のフェーズへの引き継ぎ

Phase 4で使用するPhase 3の成果物：
- watermarkコマンド（src/cli/commands/watermark.ts）
- Phase 4の統合確認で全コマンドが動作することを確認
