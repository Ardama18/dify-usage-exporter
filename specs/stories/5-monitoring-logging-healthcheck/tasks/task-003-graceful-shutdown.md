---
story_id: "5"
title: monitoring-logging-healthcheck
feature: healthcheck
epic_id: "1"
type: task
task_number: "003"
version: 1.0.0
created: 2025-11-22
based_on: specs/stories/5-monitoring-logging-healthcheck/plan.md
---

# タスク: GracefulShutdown統合

メタ情報:
- 依存: task-002-healthcheck-server（HealthCheckServer）
- サイズ: 小規模（2ファイル）

## 実装内容
既存のGracefulShutdown機能にHealthCheckServerの停止処理を統合する。

## 対象ファイル
- [x] src/shutdown/graceful-shutdown.ts
- [x] src/shutdown/__tests__/graceful-shutdown.test.ts

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [x] 既存テストファイルにHealthCheckServer統合テストを追加:
  - healthCheckServer オプションが渡された場合に stop() が呼ばれる
  - healthCheckServer が undefined の場合はスキップされる
  - healthCheckServer.stop() が最初に実行される（順序確認）
  - healthCheckServer.stop() がエラーでも他の処理は継続
- [x] テスト実行して失敗を確認
  ```bash
  npm run test:unit -- src/shutdown/__tests__/graceful-shutdown.test.ts
  ```

### 2. Green Phase
- [x] src/shutdown/graceful-shutdown.ts の GracefulShutdownOptions を拡張:
  ```typescript
  interface GracefulShutdownOptions {
    // 既存オプション...
    healthCheckServer?: {
      stop: () => Promise<void>;
    };
  }
  ```
- [x] shutdown 関数内で healthCheckServer.stop() を呼び出し:
  - 既存のシャットダウン処理の最初に配置
  - try-catch でエラーをログ出力し、処理継続
- [x] テスト実行して通ることを確認
  ```bash
  npm run test:unit -- src/shutdown/__tests__/graceful-shutdown.test.ts
  ```

### 3. Refactor Phase
- [x] シャットダウン処理の順序をコメントで明確化
- [x] 既存テストがすべて通ることを確認
- [x] テストが引き続き通ることを確認

## 完了条件
- [x] 追加したテストが全てパス
- [x] 既存のシャットダウンテストが全てパス
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
  npm run test:unit -- src/shutdown/__tests__/graceful-shutdown.test.ts
  ```

## 注意事項
- 影響範囲: 既存のシャットダウン処理への追加
- 制約: 既存の終了処理の動作を変更しない
- AC-HC-4 対応
- シャットダウン順序: HealthCheckServer停止 -> 既存処理
