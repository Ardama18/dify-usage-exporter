---
story_id: "1"
title: foundation-and-scheduler
feature: scheduler
task_number: "005"
version: 1.0.0
created: 2025-11-20
based_on: specs/stories/1-foundation-and-scheduler/plan.md
---

# タスク: スケジューラ実装と統合テスト作成

メタ情報:
- 依存: task-004 → 成果物: src/logger/winston-logger.ts
- 提供: src/scheduler/cron-scheduler.ts（Scheduler インターフェース、createScheduler関数）
- サイズ: 中規模（実装1ファイル + テスト追記）

## 実装内容

cronパッケージを使用した定期実行スケジューラを実装する。cron式の検証、重複実行防止、executionId生成、ジョブ実行ログ出力を含む。UTCタイムゾーンで動作。

## 対象ファイル

- [x] src/scheduler/cron-scheduler.ts
- [x] test/integration/foundation-and-scheduler.int.test.ts（AC-SCHED部分追記）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase

- [x] ディレクトリ作成
  ```bash
  mkdir -p src/scheduler
  ```
- [x] 統合テストの追記（AC-SCHED-1〜7）
  - AC-SCHED-1: スケジューラ起動と次回実行予定ログ（3件）
  - AC-SCHED-2: cron時刻到達時のonTick実行（4件）
  - AC-SCHED-3: CRON_SCHEDULE環境変数の使用（2件）
  - AC-SCHED-4: 無効なcron式でのexit（3件）
  - AC-SCHED-5: 実行中ジョブのスキップ（3件）
  - AC-SCHED-6: executionId生成とログ含有（4件）
  - AC-SCHED-7: cron時刻からの実行精度（1件）
  - スケジューラ停止（2件）
  - ジョブ実行エラーハンドリング（4件）
  - isRunning()状態確認（2件）
- [x] テスト実行して失敗を確認
  ```bash
  npm run test:integration
  ```

### 2. Green Phase

- [x] Schedulerインターフェースの定義
  ```typescript
  export interface Scheduler {
    start(): void
    stop(): void
    isRunning(): boolean
  }
  ```

- [x] validateCronExpression()関数の実装
  ```typescript
  function validateCronExpression(expression: string): boolean {
    try {
      const testJob = CronJob.from({
        cronTime: expression,
        onTick: () => {},
        start: false,
      })
      testJob.stop()
      return true
    } catch {
      return false
    }
  }
  ```

- [x] generateExecutionId()関数の実装
  ```typescript
  function generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }
  ```

- [x] createScheduler()関数の実装（Design Doc準拠）
  - cron式検証
  - isTaskRunningフラグによる重複実行防止
  - executionId生成
  - ジョブ実行ログ（開始/完了/失敗）
  - UTCタイムゾーン設定

- [x] テスト実行して通ることを確認

### 3. Refactor Phase

- [x] コード改善（テストが通る状態を維持）
- [x] `npm run check` でlint/formatエラーなし

## テストケース詳細

### AC-SCHED-1: スケジューラ起動と次回実行予定ログ（3件）
- start()呼び出しで起動ログ出力
- 起動ログにcronScheduleを含む
- 起動ログにnextExecutionを含む

### AC-SCHED-2: cron時刻到達時のonTick実行（4件）
- cron時刻到達でonTick関数実行
- ジョブ実行開始ログ出力
- ジョブ実行完了ログ出力
- 完了ログにdurationMsを含む

### AC-SCHED-3: CRON_SCHEDULE環境変数の使用（2件）
- 環境変数の値をcron式として使用
- デフォルト値（0 0 * * *）の使用

### AC-SCHED-4: 無効なcron式でのexit（3件）
- 無効なcron式でエラーログ出力
- 無効なcron式でexit(1)
- エラーログにcronScheduleを含む

### AC-SCHED-5: 実行中ジョブのスキップ（3件）
- 実行中に新しいジョブがスキップされる
- スキップ時にwarningログ出力
- 前回ジョブ完了後は次回ジョブ実行

### AC-SCHED-6: executionId生成とログ含有（4件）
- 各ジョブに一意のexecutionId生成
- 開始ログにexecutionIdを含む
- 完了ログにexecutionIdを含む
- 失敗ログにexecutionIdを含む

### AC-SCHED-7: cron時刻からの実行精度（1件）
- cron時刻から±5秒以内でジョブ実行開始

### スケジューラ停止（2件）
- stop()呼び出しで停止ログ出力
- 停止後はジョブが実行されない

### ジョブ実行エラーハンドリング（4件）
- onTickでエラー発生時にエラーログ出力
- エラーログにerrorメッセージを含む
- エラーログにstackを含む
- エラー後も次回ジョブは実行される

### isRunning()状態確認（2件）
- ジョブ実行中はisRunning()がtrue
- ジョブ完了後はisRunning()がfalse

## 完了条件

- [x] 追加したテストが全てパス（28件）
- [x] TypeScript strict mode: エラー0件
- [x] Biome lint: エラー0件
- [x] 動作確認完了（L2: 統合テスト実行）
  ```bash
  npm run test:integration -- foundation-and-scheduler.int.test.ts
  ```
- [x] cron時刻から±5秒以内でジョブ実行開始
- [x] トレーサビリティ: AC-SCHED-1（3件）、AC-SCHED-2（4件）、AC-SCHED-3（2件）、AC-SCHED-4（3件）、AC-SCHED-5（3件）、AC-SCHED-6（4件）、AC-SCHED-7（1件）、停止（2件）、エラー（4件）、状態（2件）

## 注意事項

- **影響範囲**: graceful-shutdown、index.tsが依存
- **制約**: Design Docのインターフェースに完全準拠
- **タイムゾーン**: UTCを明示指定（timeZone: 'UTC'）
- **重複実行防止**: isTaskRunningフラグで制御
- **テスト考慮**: cron実行タイミングのテストは時間制御が必要
