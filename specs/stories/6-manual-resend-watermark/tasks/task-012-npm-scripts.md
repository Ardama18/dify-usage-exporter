---
story_id: "6"
title: manual-resend-watermark
feature: cli
task_number: "012"
phase: 4
version: 1.0.0
created: 2025-11-22
based_on: specs/stories/6-manual-resend-watermark/plan.md
---

# タスク: npm scripts追加

メタ情報:
- 依存:
  - task-007: resendコマンド実装（Phase 2完了）
  - task-010: watermarkコマンド実装（Phase 3完了）
- 提供: package.json更新
- サイズ: 小規模（1ファイル）

## 実装内容

package.jsonにCLI実行用のnpm scriptsを追加する。
- "cli": "npx tsx src/cli/index.ts" 追加
- commander依存パッケージ確認

## 対象ファイル
- [x] package.json

## 実装手順

### 1. package.json更新
- [x] scriptsセクションに追加
  ```json
  {
    "scripts": {
      "cli": "npx tsx src/cli/index.ts"
    }
  }
  ```
- [x] commander依存パッケージ確認
  ```json
  {
    "dependencies": {
      "commander": "^12.x"
    }
  }
  ```

### 2. 動作確認
- [x] npm run cli -- --help が正常動作
- [x] npm run cli -- --version が正常動作
- [x] npm run cli -- list が正常動作
- [x] npm run cli -- resend が正常動作
- [x] npm run cli -- watermark show が正常動作

## 完了条件
- [x] package.json更新
- [x] "cli": "npx tsx src/cli/index.ts" 追加
- [x] commander依存パッケージがpackage.jsonに含まれていること
- [x] npm run cli -- --help が正常動作
- [x] 動作確認完了（L1: コマンド実行）
  ```bash
  npm run cli -- --help
  npm run cli -- list
  npm run cli -- resend
  npm run cli -- watermark show
  ```

## 注意事項
- 影響範囲: package.json
- 制約: 既存のnpm scriptsを変更しない
- commanderが未インストールの場合はnpm installが必要

## ACトレーサビリティ
- 全AC共通（CLI実行基盤）
