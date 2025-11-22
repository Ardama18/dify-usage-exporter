---
story_id: "6"
title: manual-resend-watermark
feature: cli
task_number: "005"
phase: 1
version: 1.0.0
created: 2025-11-22
based_on: specs/stories/6-manual-resend-watermark/plan.md
---

# タスク: Phase 1 完了確認

メタ情報:
- 依存:
  - task-001: SpoolManager拡張
  - task-002: CLI基盤構築
  - task-003: listコマンド実装
  - task-004: CLI共通機能
- 提供: Phase 1の完了状態
- サイズ: 確認作業のみ

## 確認内容

Phase 1「SpoolManager拡張 + listコマンド」の全タスクが完了していることを確認する。

## 確認手順

### 1. ビルド確認
```bash
npm run build
```

### 2. テスト実行
```bash
# SpoolManager拡張のテスト
npm test -- --run src/sender/__tests__/spool-manager.test.ts

# listコマンド統合テスト
npm test -- --run src/cli/__tests__/integration/list-command.int.test.ts

# CLI共通機能統合テスト
npm test -- --run src/cli/__tests__/integration/common.int.test.ts
```

### 3. 手動確認（package.json更新後）
```bash
npm run cli -- list
npm run cli -- --help
npm run cli -- --version
npm run cli -- unknown-command  # エラー表示確認
```

## 完了条件

### Phase 1 タスク一覧
- [x] task-001: SpoolManager拡張（listFailedFiles/deleteFailedFile/getFailedFile）
- [x] task-002: CLI基盤構築（bootstrap/エントリーポイント）
- [x] task-003: listコマンド実装
- [x] task-004: CLI共通機能実装（ヘルプ/エラー処理）

### 品質基準
- [x] TypeScript strict mode: エラー0件
- [x] Biome lint: エラー0件
- [x] 全単体テストパス
- [x] 統合テスト（29件）パス
  - list-command.int.test.ts: 16件
  - common.int.test.ts: 13件（Phase 1対応分）

### 動作確認
- [x] listコマンドが正常動作
- [x] --helpオプションが動作
- [x] --versionオプションが動作
- [x] 未知コマンドでエラー表示

## 作業計画書チェックボックス更新

以下の項目をplan.mdで完了としてマーク：

### Task 1-1: SpoolManager拡張
- [x] listFailedFiles()メソッド実装完了
- [x] deleteFailedFile()メソッド実装完了
- [x] getFailedFile()メソッド実装完了
- [x] 単体テスト作成・実行完了
- [x] 既存のlistSpoolFiles()等のテストが引き続きパスすること

### Task 1-2: CLI基盤構築
- [x] bootstrap.ts実装完了
- [x] index.ts実装完了
- [x] types.ts実装完了
- [x] 型チェック・lint通過

### Task 1-3: listコマンド実装と統合テスト作成
- [x] list.ts実装完了
- [x] 統合テスト作成・実行完了
- [x] 単体テスト作成・実行完了
- [x] 全テストパス

### Task 1-4: CLI共通機能実装と統合テスト作成
- [x] --helpオプションが全コマンドで動作
- [x] --versionオプションが動作
- [x] 未知コマンドでエラーメッセージとヘルプ表示
- [x] エラーハンドリング実装
- [x] 統合テスト作成・実行完了
- [x] exit code検証

## 次のフェーズへの引き継ぎ

Phase 2で使用するPhase 1の成果物：
- SpoolManager.listFailedFiles()
- SpoolManager.deleteFailedFile()
- SpoolManager.getFailedFile()
- CLI基盤（bootstrap.ts, index.ts, types.ts）
- エラーハンドリング（error-handler.ts）
