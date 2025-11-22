---
story_id: "6"
title: manual-resend-watermark
feature: cli
task_number: "004"
phase: 1
version: 1.0.0
created: 2025-11-22
based_on: specs/stories/6-manual-resend-watermark/plan.md
---

# タスク: CLI共通機能実装と統合テスト作成

メタ情報:
- 依存:
  - task-002: CLI基盤 → 成果物: index.ts
- 提供: --help, --version, エラーハンドリング、統合テスト
- サイズ: 小規模（1-2ファイル + テスト）

## 実装内容

CLI共通機能を実装する。
- --helpオプションが全コマンドで動作
- --versionオプションが動作
- 未知コマンドでエラーメッセージとヘルプ表示
- エラーハンドリング（handleError関数）
- exit code検証（成功時0、エラー時1）

## 対象ファイル
- [x] src/cli/index.ts（更新）
- [x] src/cli/utils/error-handler.ts（新規）
- [x] src/cli/__tests__/integration/common.int.test.ts（新規）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [x] 統合テストを作成（src/cli/__tests__/integration/common.int.test.ts）
  - it.todo 17件を実装
    - --help表示
    - --version表示
    - 未知コマンドでエラー
    - exit code検証
    - DEBUG環境変数でスタックトレース表示
- [x] テスト実行して失敗を確認

### 2. Green Phase
- [x] error-handler.tsの実装
  ```typescript
  export function handleError(error: unknown): never {
    if (error instanceof ValidationError) {
      console.error(`Error: ${error.message}`)
    } else if (error instanceof Error) {
      console.error(`Error: ${error.message}`)
      if (process.env.DEBUG) {
        console.error(error.stack)
      }
    } else {
      console.error('Unknown error occurred')
    }
    process.exit(1)
  }
  ```
- [x] index.tsの更新
  - エラーハンドリングの統合
  - 未知コマンド時のエラー表示設定
  ```typescript
  program.on('command:*', () => {
    console.error(`Unknown command: ${program.args.join(' ')}`)
    program.help()
  })
  ```
- [x] 追加したテストのみ実行して通ることを確認

### 3. Refactor Phase
- [x] エラーメッセージの統一
- [x] ValidationError型の定義（必要に応じて）
- [x] 追加したテストが引き続き通ることを確認

## 完了条件
- [x] 統合テスト（17件）が全てパス
- [x] --helpオプションが全コマンドで動作
- [x] --versionオプションが動作
- [x] 未知コマンドでエラーメッセージとヘルプ表示
- [x] exit code検証（成功時0、エラー時1）
- [x] TypeScript strict mode: エラー0件
- [x] Biome lint: エラー0件
- [x] 動作確認完了（L2: 統合テスト実行）
  ```bash
  npm test -- --run src/cli/__tests__/integration/common.int.test.ts
  ```

## 注意事項
- 影響範囲: src/cli/index.ts、src/cli/utils/
- 制約: Commander.jsのエラーハンドリング仕様に従う
- DEBUG環境変数でスタックトレース表示切替

## ACトレーサビリティ
- AC-COMMON-1: 全コマンドで--helpオプション提供
- AC-COMMON-2: 未知コマンドでエラー・ヘルプ表示
- AC-COMMON-3: 成功時exit 0、エラー時exit 1
