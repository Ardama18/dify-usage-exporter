---
story_id: "5"
title: monitoring-logging-healthcheck
feature: monitoring
epic_id: "1"
type: task
task_number: "007"
version: 1.0.0
created: 2025-11-22
based_on: specs/stories/5-monitoring-logging-healthcheck/plan.md
---

# タスク: MetricsReporter実装

メタ情報:
- 依存: task-006-metrics-collector（MetricsCollector）
- サイズ: 小規模（2ファイル）

## 実装内容
収集したメトリクスをJSON Lines形式でログ出力するレポーターを実装する。

## 対象ファイル
- [x] src/monitoring/metrics-reporter.ts（新規作成）
- [x] src/monitoring/__tests__/metrics-reporter.test.ts（新規作成）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [x] src/monitoring/__tests__/metrics-reporter.test.ts 作成
- [x] 以下のテストケースを作成:

  **基本動作**
  - createMetricsReporter がレポーターインスタンスを返す
  - report() がログを出力する

  **ログ形式**
  - JSON Lines形式で出力される
  - message フィールドに "ジョブ完了メトリクス" が含まれる
  - executionId が含まれる
  - metrics オブジェクトが含まれる
  - durationMs が含まれる
  - recordsPerSecond が含まれる

  **計算**
  - recordsPerSecond が正しく計算される
  - durationMs が 0 の場合、recordsPerSecond は 0（ゼロ除算対策）
  - sentRecords が 0 の場合、recordsPerSecond は 0

  **ロガー連携**
  - ILogger.info() が呼ばれる
  - 構造化ログとして出力される

- [x] テスト実行して失敗を確認
  ```bash
  npm run test:unit -- src/monitoring/__tests__/metrics-reporter.test.ts
  ```

### 2. Green Phase
- [x] src/monitoring/metrics-reporter.ts 作成
- [x] 型定義:
  ```typescript
  interface MetricsReporterOptions {
    logger: ILogger;
  }

  interface MetricsReporter {
    report(
      executionId: string,
      metrics: ExecutionMetrics,
      durationMs: number
    ): void;
  }
  ```
- [x] createMetricsReporter ファクトリ関数実装
- [x] report() メソッド:
  - recordsPerSecond 計算（ゼロ除算対策含む）
  - JSON Lines形式でログ出力
- [x] テスト実行して通ることを確認
  ```bash
  npm run test:unit -- src/monitoring/__tests__/metrics-reporter.test.ts
  ```

### 3. Refactor Phase
- [x] ログ出力形式の整理
- [x] テストが引き続き通ることを確認

## 完了条件
- [x] 追加したテストが全てパス
- [x] TypeScript strict mode: エラー0件
  ```bash
  npm run build
  ```
- [x] Biome lint: エラー0件
  ```bash
  npm run check
  ```
- [x] 動作確認完了（L1: 単体テスト実行）
  ```bash
  npm run test:unit -- src/monitoring/__tests__/metrics-reporter.test.ts
  ```

## 注意事項
- 影響範囲: 新規ファイル、既存コードへの影響なし
- 制約: 既存のILoggerインターフェースを使用
- AC-MC-2, AC-MC-5, AC-LOG-1, AC-LOG-2 対応
