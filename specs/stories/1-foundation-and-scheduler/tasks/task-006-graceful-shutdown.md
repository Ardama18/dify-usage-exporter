---
story_id: "1"
title: foundation-and-scheduler
feature: shutdown
task_number: "006"
version: 1.0.0
created: 2025-11-20
based_on: specs/stories/1-foundation-and-scheduler/plan.md
---

# タスク: Graceful Shutdown実装と統合テスト作成

メタ情報:
- 依存: task-005 → 成果物: src/scheduler/cron-scheduler.ts
- 提供: src/shutdown/graceful-shutdown.ts（setupGracefulShutdown関数）
- サイズ: 中規模（実装1ファイル + テスト追記）

## 実装内容

SIGINT/SIGTERMシグナルを受信した際にスケジューラを停止し、実行中のタスクが完了するまで待機してから終了するGraceful Shutdown機能を実装する。タイムアウト処理、unhandledRejection/uncaughtExceptionハンドラも含む。

## 対象ファイル

- [x] src/shutdown/graceful-shutdown.ts
- [x] test/integration/foundation-and-scheduler.int.test.ts（AC-SHUT部分追記）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase

- [x] ディレクトリ作成
  ```bash
  mkdir -p src/shutdown
  ```
- [x] 統合テストの追記（AC-SHUT-1〜7）
  - AC-SHUT-1: SIGINTによるShutdown開始（2件）
  - AC-SHUT-2: SIGTERMによるShutdown開始（2件）
  - AC-SHUT-3: タスクなしでの即座終了（2件）
  - AC-SHUT-4: 実行中タスクの完了待機（2件）
  - AC-SHUT-5: タイムアウト超過による強制終了（3件）
  - AC-SHUT-6: unhandledRejectionでのexit（3件）
  - AC-SHUT-7: uncaughtExceptionでのexit（3件）
  - スケジューラ停止の確認（1件）
- [x] テスト実行して失敗を確認
  ```bash
  npm run test:integration
  ```

### 2. Green Phase

- [x] GracefulShutdownOptionsインターフェースの定義
  ```typescript
  export interface GracefulShutdownOptions {
    timeoutMs: number
    scheduler: Scheduler
    logger: Logger
  }
  ```

- [x] sleep()ヘルパー関数の実装
  ```typescript
  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
  ```

- [x] setupGracefulShutdown()関数の実装（Design Doc準拠）
  - SIGINT/SIGTERMハンドラ登録
  - タスク完了待機ループ
  - タイムアウト処理
  - unhandledRejectionハンドラ
  - uncaughtExceptionハンドラ

- [x] テスト実行して通ることを確認

### 3. Refactor Phase

- [x] コード改善（テストが通る状態を維持）
- [x] `npm run check` でlint/formatエラーなし

## テストケース詳細

### AC-SHUT-1: SIGINTによるShutdown開始（2件）
- SIGINT受信でシャットダウンログ出力
- ログにsignal: 'SIGINT'を含む

### AC-SHUT-2: SIGTERMによるShutdown開始（2件）
- SIGTERM受信でシャットダウンログ出力
- ログにsignal: 'SIGTERM'を含む

### AC-SHUT-3: タスクなしでの即座終了（2件）
- isRunning()がfalseの場合即座にexit(0)
- 完了ログを出力

### AC-SHUT-4: 実行中タスクの完了待機（2件）
- isRunning()がtrueの間待機
- タスク完了後にexit(0)

### AC-SHUT-5: タイムアウト超過による強制終了（3件）
- タイムアウト超過でエラーログ出力
- エラーログにtimeoutMsを含む
- exit(1)で終了

### AC-SHUT-6: unhandledRejectionでのexit（3件）
- unhandledRejection発生でエラーログ出力
- エラーログにreasonを含む
- exit(1)で終了（Fail-Fast原則）

### AC-SHUT-7: uncaughtExceptionでのexit（3件）
- uncaughtException発生でエラーログ出力
- エラーログにerror/stackを含む
- exit(1)で終了

### スケジューラ停止の確認（1件）
- シャットダウン時にscheduler.stop()が呼ばれる

## 完了条件

- [x] 追加したテストが全てパス（18件）
- [x] TypeScript strict mode: エラー0件
- [x] Biome lint: エラー0件
- [x] 動作確認完了（L2: 統合テスト実行）
  ```bash
  npm run test:integration -- foundation-and-scheduler.int.test.ts
  ```
- [x] Graceful Shutdown成功率99%以上
- [x] トレーサビリティ: AC-SHUT-1（2件）、AC-SHUT-2（2件）、AC-SHUT-3（2件）、AC-SHUT-4（2件）、AC-SHUT-5（3件）、AC-SHUT-6（3件）、AC-SHUT-7（3件）、停止確認（1件）

## 注意事項

- **影響範囲**: index.tsが依存
- **制約**: Design Docのインターフェースに完全準拠
- **Fail-Fast原則**: unhandledRejectionは即座にexit(1)
- **待機ループ**: 100msごとにisRunning()をチェック
- **テスト考慮**: process.exit()、process.on()をモック化
