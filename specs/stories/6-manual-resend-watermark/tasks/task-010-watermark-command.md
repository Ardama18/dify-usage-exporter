---
story_id: "6"
title: manual-resend-watermark
feature: cli
task_number: "010"
phase: 3
version: 1.0.0
created: 2025-11-22
based_on: specs/stories/6-manual-resend-watermark/plan.md
---

# タスク: watermarkコマンド実装と統合テスト作成

メタ情報:
- 依存:
  - task-009: promptユーティリティ → 成果物: confirmPrompt()
- 提供: src/cli/commands/watermark.ts, 統合テスト
- サイズ: 中規模（2ファイル + テスト2ファイル）

## 実装内容

watermarkコマンドを実装し、ウォーターマーク表示・リセット機能を提供する。
- showサブコマンド: load()で現在値表示
- resetサブコマンド:
  - --date オプション（必須、ISO 8601形式）
  - 現在値と新しい値の表示
  - confirmPrompt()で確認
  - 確認後update()で更新
- 日時バリデーション（ISO 8601形式チェック）
- 未設定時の「未設定」メッセージ

## 対象ファイル
- [x] src/cli/commands/watermark.ts（新規）
- [x] src/cli/__tests__/commands/watermark.test.ts（新規）
- [x] src/cli/__tests__/integration/watermark-command.int.test.ts（新規）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [x] Design Docのwatermarkコマンド仕様を確認
- [x] 単体テストを作成（src/cli/__tests__/commands/watermark.test.ts）
  - createWatermarkCommand()がCommandを返す
  - showサブコマンド
  - resetサブコマンド
  - 日時バリデーション
- [x] 統合テストを作成（src/cli/__tests__/integration/watermark-command.int.test.ts）
  - it.todo 32件を実装
    - show（現在値表示、未設定表示）
    - reset（確認y/n、日時バリデーション）
    - エラーハンドリング
- [x] テスト実行して失敗を確認

### 2. Green Phase
- [x] watermark.tsの実装
  ```typescript
  import { Command } from 'commander'
  import type { CliDependencies } from '../bootstrap.js'
  import { confirmPrompt } from '../utils/prompt.js'

  export function createWatermarkCommand(deps: CliDependencies): Command {
    const { watermarkManager } = deps

    const command = new Command('watermark')
      .description('Manage watermark (last_fetched_date)')

    // showサブコマンド
    command
      .command('show')
      .description('Show current watermark')
      .action(async () => {
        const watermark = await watermarkManager.load()
        if (!watermark) {
          console.log('Watermark not set')
          return
        }
        console.log('Current watermark:')
        console.log(`  last_fetched_date: ${watermark.last_fetched_date}`)
        console.log(`  last_updated_at:   ${watermark.last_updated_at}`)
      })

    // resetサブコマンド
    command
      .command('reset')
      .description('Reset watermark to specified date')
      .requiredOption('-d, --date <ISO8601>', 'Date to reset to (ISO 8601 format)')
      .action(async (options) => {
        // 日時バリデーション
        const newDate = new Date(options.date)
        if (isNaN(newDate.getTime())) {
          console.error('Error: Invalid date format. Use ISO 8601 format.')
          process.exit(1)
        }

        // 現在値取得
        const current = await watermarkManager.load()

        // 確認表示
        console.log(`WARNING: This will reset the watermark to ${options.date}`)
        console.log('All data after this date will be re-fetched on next execution.')
        console.log()
        console.log(`Current: ${current?.last_fetched_date ?? 'Not set'}`)
        console.log(`New:     ${options.date}`)
        console.log()

        // 確認プロンプト
        const confirmed = await confirmPrompt('Are you sure?')
        if (!confirmed) {
          console.log('Reset cancelled')
          return
        }

        // リセット実行
        await watermarkManager.update({
          last_fetched_date: options.date,
          last_updated_at: new Date().toISOString(),
        })

        console.log(`Watermark reset to ${options.date}`)
      })

    return command
  }
  ```
- [x] index.tsにwatermarkコマンドを登録
  ```typescript
  import { createWatermarkCommand } from './commands/watermark.js'
  // ...
  program.addCommand(createWatermarkCommand(deps))
  ```
- [x] 追加したテストのみ実行して通ることを確認

### 3. Refactor Phase
- [x] 日時バリデーションの改善
- [x] エラーメッセージの統一
- [x] 出力フォーマットの改善
- [x] 追加したテストが引き続き通ることを確認

## 完了条件
- [x] 単体テストが全てパス
- [x] 統合テスト（32件）が全てパス
- [x] TypeScript strict mode: エラー0件
- [x] Biome lint: エラー0件
- [x] 動作確認完了（L2: 統合テスト実行）
  ```bash
  npm test -- --run src/cli/__tests__/integration/watermark-command.int.test.ts
  ```

## 注意事項
- 影響範囲: src/cli/commands/、src/cli/index.ts
- 制約:
  - WatermarkManagerの既存APIを利用
  - confirmPrompt()の実装に依存
- 出力形式: Design Doc記載のフォーマットに従う

## ACトレーサビリティ
- AC-WM-1: showでlast_fetched_date/last_updated_at表示
- AC-WM-2: ファイル未存在時に「未設定」表示
- AC-WM-3: reset時に確認プロンプト表示
- AC-WM-4: 確認「y」でウォーターマークリセット
- AC-WM-5: 確認「y」以外でリセットキャンセル
- AC-WM-6: 不正日時形式でエラー・exit 1
