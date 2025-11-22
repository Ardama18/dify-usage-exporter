---
story_id: "5"
title: monitoring-logging-healthcheck
feature: monitoring
epic_id: "1"
type: task
task_number: "006"
version: 1.0.0
created: 2025-11-22
based_on: specs/stories/5-monitoring-logging-healthcheck/plan.md
---

# タスク: MetricsCollector実装

メタ情報:
- 依存: task-005-phase1-completion（Phase 1完了）
- サイズ: 中規模（2ファイル）

## 実装内容
ジョブ実行中のメトリクス（API呼び出し、レコード処理、送信処理など）を収集するコレクターを実装する。

## 対象ファイル
- [x] src/monitoring/metrics-collector.ts（新規作成）
- [x] src/monitoring/__tests__/metrics-collector.test.ts（新規作成）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [x] ディレクトリ作成: src/monitoring/__tests__/
- [x] src/monitoring/__tests__/metrics-collector.test.ts 作成
- [x] 以下のテストケースを作成:

  **基本動作**
  - createMetricsCollector がコレクターインスタンスを返す
  - startCollection() で収集開始
  - stopCollection() で収集停止
  - getExecutionId() が正しい形式を返す（exec-${timestamp}-${hex}）
  - getExecutionDuration() が実行時間を返す

  **メトリクス記録**
  - recordApiCall() でAPI呼び出し数がインクリメント
  - recordFetchedRecords(count) でフェッチ済みレコード数が加算
  - recordTransformedRecords(count) で変換済みレコード数が加算
  - recordSentRecords(count) で送信済みレコード数が加算
  - recordFailedRecords(count) で失敗レコード数が加算
  - recordRetry() でリトライ数がインクリメント
  - recordError() でエラー数がインクリメント

  **メトリクス取得**
  - getMetrics() が全メトリクスを返す
  - 初期値がすべて0である
  - 複数回の記録が累積される

  **エッジケース**
  - startCollection() を2回呼んでも問題ない
  - stopCollection() を startCollection() なしで呼んでも問題ない

- [x] テスト実行して失敗を確認
  ```bash
  npm run test:unit -- src/monitoring/__tests__/metrics-collector.test.ts
  ```

### 2. Green Phase
- [x] src/monitoring/metrics-collector.ts 作成
- [x] 型定義:
  ```typescript
  interface ExecutionMetrics {
    apiCalls: number;
    fetchedRecords: number;
    transformedRecords: number;
    sentRecords: number;
    failedRecords: number;
    retries: number;
    errors: number;
  }

  interface MetricsCollector {
    startCollection(): void;
    stopCollection(): void;
    getExecutionId(): string;
    getExecutionDuration(): number;
    getMetrics(): ExecutionMetrics;
    recordApiCall(): void;
    recordFetchedRecords(count: number): void;
    recordTransformedRecords(count: number): void;
    recordSentRecords(count: number): void;
    recordFailedRecords(count: number): void;
    recordRetry(): void;
    recordError(): void;
  }
  ```
- [x] createMetricsCollector ファクトリ関数実装
- [x] executionId生成: `exec-${timestamp}-${hex}` 形式
- [x] 内部状態管理（startTime, endTime, metrics）
- [x] テスト実行して通ることを確認
  ```bash
  npm run test:unit -- src/monitoring/__tests__/metrics-collector.test.ts
  ```

### 3. Refactor Phase
- [x] 重複コードの抽出（インクリメント関数など）
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
  npm run test:unit -- src/monitoring/__tests__/metrics-collector.test.ts
  ```

## 注意事項
- 影響範囲: 新規ディレクトリ作成、既存コードへの影響なし
- 制約: パフォーマンスオーバーヘッドを最小化（単純なカウンター加算のみ）
- AC-MC-1, AC-MC-3, AC-MC-4, AC-LOG-2 対応
