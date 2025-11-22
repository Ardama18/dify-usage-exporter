---
story_id: "6"
title: manual-resend-watermark
feature: cli
task_number: "003"
phase: 1
version: 1.0.0
created: 2025-11-22
based_on: specs/stories/6-manual-resend-watermark/plan.md
---

# タスク: listコマンド実装と統合テスト作成

メタ情報:
- 依存:
  - task-001: SpoolManager拡張 → 成果物: listFailedFiles(), getFailedFile()
  - task-002: CLI基盤 → 成果物: bootstrap.ts, index.ts, types.ts
- 提供: src/cli/commands/list.ts, 統合テスト
- サイズ: 中規模（2ファイル + テスト2ファイル）

## 実装内容

listコマンドを実装し、`data/failed/`内のファイル一覧を表示する。
- ファイル一覧のフォーマット表示
- 合計ファイル数・レコード数の表示
- 空ディレクトリ時の「No failed files」メッセージ

## 対象ファイル
- [x] src/cli/commands/list.ts（新規）
- [x] src/cli/__tests__/commands/list.test.ts（新規）
- [x] src/cli/__tests__/integration/list-command.int.test.ts（新規）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [x] 単体テストを作成（src/cli/__tests__/commands/list.test.ts）
  - createListCommand()がCommandを返す
  - listFailedFiles()を呼び出す
  - 結果をフォーマット表示
- [x] 統合テストを作成（src/cli/__tests__/integration/list-command.int.test.ts）
  - it.todo 16件を実装
    - ファイル一覧表示
    - 空ディレクトリ対応
    - 合計表示
    - エラーハンドリング
- [x] テスト実行して失敗を確認

### 2. Green Phase
- [x] list.tsの実装
  ```typescript
  import { Command } from 'commander'
  import type { CliDependencies } from '../bootstrap.js'

  export function createListCommand(deps: CliDependencies): Command {
    const { spoolManager } = deps

    const command = new Command('list')
      .description('List failed files in data/failed/')
      .action(async () => {
        const files = await spoolManager.listFailedFiles()

        if (files.length === 0) {
          console.log('No failed files')
          return
        }

        console.log('Failed files in data/failed/:')
        // フォーマット表示
        // 合計表示
      })

    return command
  }
  ```
- [x] index.tsにlistコマンドを登録
  ```typescript
  import { createListCommand } from './commands/list.js'
  // ...
  program.addCommand(createListCommand(deps))
  ```
- [x] 追加したテストのみ実行して通ることを確認

### 3. Refactor Phase
- [x] 出力フォーマットの改善
- [x] エラーメッセージの統一
- [x] 追加したテストが引き続き通ることを確認

## 完了条件
- [x] 単体テストが全てパス
- [x] 統合テスト（16件）が全てパス
- [x] TypeScript strict mode: エラー0件
- [x] Biome lint: エラー0件
- [x] 動作確認完了（L2: 統合テスト実行）
  ```bash
  npm test -- --run src/cli/__tests__/integration/list-command.int.test.ts
  ```

## 注意事項
- 影響範囲: src/cli/commands/、src/cli/index.ts
- 制約: SpoolManager.listFailedFiles()の実装に依存
- 出力形式: Design Doc記載のフォーマットに従う

## ACトレーサビリティ
- AC-LIST-1: ファイル一覧表示
- AC-LIST-2: 各ファイルの詳細情報表示
- AC-LIST-3: 空ディレクトリで「No failed files」表示
- AC-LIST-4: 合計ファイル数・レコード数表示
