---
story_id: "6"
title: manual-resend-watermark
feature: cli
task_number: "015"
phase: 4
version: 1.0.0
created: 2025-11-22
based_on: specs/stories/6-manual-resend-watermark/plan.md
---

# タスク: Phase 4 完了確認

メタ情報:
- 依存:
  - task-012: npm scripts追加
  - task-013: E2Eテスト実行
  - task-014: 品質保証
- 提供: Phase 4およびストーリー全体の完了状態
- サイズ: 確認作業のみ

## 確認内容

Phase 4「全体統合 + E2E確認」の全タスクが完了し、ストーリー全体が完了していることを確認する。

## 確認手順

### 1. 全テスト実行
```bash
npm run test:safe
```

### 2. 品質チェック
```bash
npm run check
npm run build
```

### 3. E2Eシナリオ確認（Design Doc記載手順）
```bash
# セットアップ
mkdir -p data/failed
echo '{"batchIdempotencyKey":"test123","records":[{"date":"2025-01-20","workspaceId":"ws1","appId":"app1","messageCount":10,"tokenCount":100}],"firstAttempt":"2025-01-20T00:00:00.000Z","retryCount":10,"lastError":"Test error"}' > data/failed/failed_test_test123.json

# listコマンド確認
npm run cli -- list

# watermark showコマンド確認
npm run cli -- watermark show

# watermark resetコマンド確認
npm run cli -- watermark reset --date 2025-01-01T00:00:00.000Z

# resendコマンド確認
npm run cli -- resend --file failed_test_test123.json
```

### 4. カバレッジ確認（オプション）
```bash
npm run test:coverage:fresh
```

## 完了条件

### Phase 4 タスク一覧
- [x] task-012: npm scripts追加
- [x] task-013: E2Eテスト実行
- [x] task-014: 品質保証

### 品質基準
- [x] TypeScript strict mode: エラー0件
- [x] Biome lint: エラー0件
- [x] 全テストパス（119件）
  - 統合テスト: 93件
  - E2Eテスト: 26件

### 受入条件
- [x] 19件のAC全て達成

## 作業計画書チェックボックス更新

以下の項目をplan.mdで完了としてマーク：

### Task 4-1: npm scripts追加
- [x] package.json更新
- [x] commander依存パッケージ追加確認
- [x] npm run cli -- --help が正常動作

### Task 4-2: E2Eテスト実行
- [x] E2Eテスト実行完了
- [x] Design Doc記載のE2E確認手順を全て実行
- [x] 全E2Eテストパス

### Task 4-3: 品質保証
- [x] 全統合テストパス（93件）
- [x] 全E2Eテストパス（26件）
- [x] 全単体テストパス
- [x] npm run check 通過
- [x] npm run build 成功
- [x] 受入条件の全チェック完了

### 品質チェックリスト
- [x] Design Doc整合性確認（全AC対応）
- [x] 技術的依存関係に基づくフェーズ構成
- [x] 全要件のタスク化完了
- [x] 最終フェーズに品質保証の存在
- [x] 統合ポイントの動作確認手順配置
- [x] テスト設計情報の反映完了

## ストーリー完了

全4フェーズが完了し、手動再送とウォーターマーク操作CLIの実装が完了しました。

### 成果物一覧
- src/cli/bootstrap.ts
- src/cli/index.ts
- src/cli/types.ts
- src/cli/commands/list.ts
- src/cli/commands/resend.ts
- src/cli/commands/watermark.ts
- src/cli/utils/prompt.ts
- src/cli/utils/error-handler.ts
- src/sender/spool-manager.ts（拡張）
- src/sender/external-api-sender.ts（拡張）
- package.json（更新）
