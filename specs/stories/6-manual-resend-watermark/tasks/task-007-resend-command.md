---
story_id: "6"
title: manual-resend-watermark
feature: cli
task_number: "007"
phase: 2
version: 1.0.0
created: 2025-11-22
based_on: specs/stories/6-manual-resend-watermark/plan.md
---

# タスク: resendコマンド実装と統合テスト作成

メタ情報:
- 依存:
  - task-006: ExternalApiSender拡張 → 成果物: resendFailedFile()
- 提供: src/cli/commands/resend.ts, 統合テスト
- サイズ: 中規模（2ファイル + テスト2ファイル）

## 実装内容

resendコマンドを実装し、失敗ファイルの手動再送機能を提供する。
- 引数なし: listFailedFiles()でファイル一覧表示
- --file オプション: 指定ファイルの再送
- --all オプション: 全ファイル順次再送
- 成功時: deleteFailedFile()でファイル削除
- 失敗時: エラーメッセージ表示、ファイル保持
- サマリー表示（ResendSummary形式）

## 対象ファイル
- [x] src/cli/commands/resend.ts（新規）
- [x] src/cli/__tests__/commands/resend.test.ts（新規）
- [x] src/cli/__tests__/integration/resend-command.int.test.ts（新規）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [x] Design Docのresendコマンド仕様を確認
- [x] 単体テストを作成（src/cli/__tests__/commands/resend.test.ts）
  - createResendCommand()がCommandを返す
  - 引数なしでファイル一覧表示
  - --fileオプションで単一ファイル再送
  - --allオプションで全ファイル再送
  - サマリー表示
- [x] 統合テストを作成（src/cli/__tests__/integration/resend-command.int.test.ts）
  - it.todo 43件を実装
    - 引数なし実行
    - --fileオプション（成功/失敗）
    - --allオプション（成功/部分失敗）
    - ファイル削除確認
    - サマリー表示
- [x] テスト実行して失敗を確認

### 2. Green Phase
- [x] resend.tsの実装
  ```typescript
  import { Command } from 'commander'
  import type { CliDependencies } from '../bootstrap.js'
  import type { ResendResult, ResendSummary } from '../types.js'

  export function createResendCommand(deps: CliDependencies): Command {
    const { spoolManager, externalApiSender, logger } = deps

    const command = new Command('resend')
      .description('Resend failed files to external API')
      .option('-f, --file <filename>', 'Resend specific file')
      .option('-a, --all', 'Resend all failed files')
      .action(async (options) => {
        // 引数なし: ファイル一覧表示
        if (!options.file && !options.all) {
          const files = await spoolManager.listFailedFiles()
          // 一覧表示
          return
        }

        // --file: 指定ファイル再送
        if (options.file) {
          const result = await resendSingleFile(options.file)
          // 結果表示
          return
        }

        // --all: 全ファイル再送
        if (options.all) {
          const summary = await resendAllFiles()
          // サマリー表示
          return
        }
      })

    return command
  }
  ```
- [x] index.tsにresendコマンドを登録
  ```typescript
  import { createResendCommand } from './commands/resend.js'
  // ...
  program.addCommand(createResendCommand(deps))
  ```
- [x] 追加したテストのみ実行して通ることを確認

### 3. Refactor Phase
- [x] 共通処理の抽出（resendSingleFile, resendAllFiles）
- [x] エラーメッセージの改善
- [x] サマリー表示の最適化
- [x] 追加したテストが引き続き通ることを確認

## 完了条件
- [x] 単体テストが全てパス
- [x] 統合テスト（36件）が全てパス
- [x] TypeScript strict mode: エラー0件
- [x] Biome lint: エラー0件
- [x] 動作確認完了（L2: 統合テスト実行）
  ```bash
  npm test -- --run src/cli/__tests__/integration/resend-command.int.test.ts
  ```

## 注意事項
- 影響範囲: src/cli/commands/、src/cli/index.ts
- 制約:
  - SpoolManager.listFailedFiles(), getFailedFile(), deleteFailedFile()の実装に依存
  - ExternalApiSender.resendFailedFile()の実装に依存
- 出力形式: Design Doc記載のフォーマットに従う

## ACトレーサビリティ
- AC-RESEND-1: 引数なし実行でファイル一覧表示
- AC-RESEND-2: --fileオプションで指定ファイル再送
- AC-RESEND-3: --allオプションで全ファイル再送
- AC-RESEND-4: 再送成功時にファイル削除
- AC-RESEND-5: 再送失敗時にエラー表示・ファイル保持
- AC-RESEND-6: 処理後にサマリー表示
