---
story_id: "5"
title: monitoring-logging-healthcheck
feature: monitoring
epic_id: "1"
type: task
task_number: "008"
version: 1.0.0
created: 2025-11-22
based_on: specs/stories/5-monitoring-logging-healthcheck/plan.md
---

# タスク: index.ts メトリクス統合

メタ情報:
- 依存: task-007-metrics-reporter（MetricsReporter）
- サイズ: 中規模（2ファイル）

## 実装内容
メインエントリポイント（index.ts）にMetricsCollectorとMetricsReporterを統合し、ジョブ実行時のメトリクス収集・出力を実現する。

## 対象ファイル
- [x] src/index.ts
- [x] src/__tests__/index.test.ts（既存テストの更新）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [x] 既存テストファイルにメトリクス統合テストを追加:
  - onTick 内で MetricsCollector が初期化される
  - startCollection() が呼ばれる
  - 各処理フェーズで record* メソッドが呼ばれる
  - stopCollection() が呼ばれる
  - MetricsReporter.report() が呼ばれる
  - 既存のジョブ処理は変更なく動作する
- [x] テスト実行して失敗を確認
  ```bash
  npm run test:unit -- src/__tests__/index.test.ts
  ```

### 2. Green Phase
- [x] src/index.ts の onTick コールバックを拡張:
  ```typescript
  // onTick 内
  const collector = createMetricsCollector();
  const reporter = createMetricsReporter({ logger });

  collector.startCollection();

  try {
    // フェッチ処理
    collector.recordApiCall();
    const records = await fetcher.fetch();
    collector.recordFetchedRecords(records.length);

    // 変換処理
    const transformed = transformer.transform(records);
    collector.recordTransformedRecords(transformed.length);

    // 送信処理
    const result = await sender.send(transformed);
    collector.recordSentRecords(result.sent);
    collector.recordFailedRecords(result.failed);

  } catch (error) {
    collector.recordError();
    throw error;
  } finally {
    collector.stopCollection();
    reporter.report(
      collector.getExecutionId(),
      collector.getMetrics(),
      collector.getExecutionDuration()
    );
  }
  ```
- [x] import文追加
- [x] テスト実行して通ることを確認
  ```bash
  npm run test:unit -- src/__tests__/index.test.ts
  ```

### 3. Refactor Phase
- [x] エラーハンドリングの整理
- [x] 既存テストがすべて通ることを確認
- [x] テストが引き続き通ることを確認

## 完了条件
- [x] 追加したテストが全てパス
- [x] 既存のindex.tsテストが全てパス
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
  npm run test:unit -- src/__tests__/index.test.ts
  ```

## 注意事項
- 影響範囲: メインエントリポイントの拡張
- 制約: 既存のフェッチ/変換/送信処理の動作を変更しない
- 統合ポイント3（Scheduler onTick）対応
- メトリクス収集は try-finally で確実に完了させる
