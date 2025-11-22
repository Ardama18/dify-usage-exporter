---
story_id: "5"
title: monitoring-logging-healthcheck
feature: monitoring
epic_id: "1"
type: task
task_number: "009"
version: 1.0.0
created: 2025-11-22
based_on: specs/stories/5-monitoring-logging-healthcheck/plan.md
---

# タスク: メトリクス統合テスト作成・実行

メタ情報:
- 依存: task-008-index-integration（index.ts統合）
- サイズ: 中規模（1ファイル、34テストケース）

## 実装内容
MetricsCollectorとMetricsReporterの統合テストを作成し、メトリクス収集から出力までの完全フローを検証する。

## 対象ファイル
- [x] src/monitoring/__tests__/integration/metrics.int.test.ts（新規作成）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [x] ディレクトリ作成: src/monitoring/__tests__/integration/
- [x] 統合テストファイル作成
- [x] 以下のテストケースを実装（34件）:

  **MetricsCollector統合**
  - 完全なライフサイクル（start -> record -> stop -> get）
  - executionId が一意である（複数実行）
  - 実行時間が正確に計測される
  - 全メトリクスが正しく累積される
  - 複数種類のメトリクスを同時に記録できる
  - 大量のレコード（1000件）でも正常動作

  **MetricsReporter統合**
  - JSON Lines形式で出力される
  - 全必須フィールドが出力される
  - recordsPerSecond が正しく計算される
  - ゼロ除算が発生しない
  - ILogger.info() が呼ばれる

  **Collector + Reporter 連携**
  - Collector から Reporter への完全フロー
  - 複数回の実行で独立したメトリクス
  - エラー発生時でもメトリクスが出力される
  - 部分的な成功（sent + failed）が正しく記録される

  **パフォーマンス**
  - メトリクス記録のオーバーヘッドが1%以下（AC-PERF-2）
  - 10000回の recordApiCall() が 1ms 以内
  - getMetrics() が 1ms 以内

  **エッジケース**
  - 空の実行（record なし）
  - stopCollection() 前の getMetrics()
  - 複数の startCollection() 呼び出し

  **実際のユースケース**
  - フェッチ -> 変換 -> 送信の完全フロー
  - リトライを含むフロー
  - 部分的エラーを含むフロー

- [x] テスト実行して失敗を確認（実装済みなら通る）
  ```bash
  npm run test:int -- src/monitoring/__tests__/integration/metrics.int.test.ts
  ```

### 2. Green Phase
- [x] 不足している実装があれば追加
- [x] 統合テスト実行:
  ```bash
  npm run test:int -- src/monitoring/__tests__/integration/metrics.int.test.ts
  ```
- [x] 34件全てパス確認

### 3. Refactor Phase
- [x] テストの整理（describe グループ化）
- [x] 共通セットアップの抽出
- [x] テストが引き続き通ることを確認

## 完了条件
- [x] 統合テスト34件全てパス
- [x] TypeScript strict mode: エラー0件
  ```bash
  npm run build
  ```
- [x] Biome lint: エラー0件
  ```bash
  npm run check
  ```
- [x] 動作確認完了（L2: 統合テスト実行）
  ```bash
  npm run test:int -- src/monitoring/__tests__/integration/metrics.int.test.ts
  ```

## 注意事項
- 影響範囲: 新規テストファイル、既存コードへの影響なし
- 制約: パフォーマンステストでは十分なサンプル数を確保
- AC-MC-1, AC-MC-2, AC-MC-3, AC-MC-4, AC-MC-5, AC-LOG-1, AC-LOG-2, AC-PERF-2 対応
