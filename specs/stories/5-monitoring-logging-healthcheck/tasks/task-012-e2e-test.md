---
story_id: "5"
title: monitoring-logging-healthcheck
feature: e2e
epic_id: "1"
type: task
task_number: "012"
version: 1.0.0
created: 2025-11-22
based_on: specs/stories/5-monitoring-logging-healthcheck/plan.md
---

# タスク: E2Eテスト実行

メタ情報:
- 依存: task-011-quality-check（全テスト実行・品質チェック）
- サイズ: 中規模（1ファイル、26テストケース）

## 実装内容
モニタリング・ロギング・ヘルスチェック機能の完全なE2Eテストを作成・実行し、本番環境相当での動作を検証する。

## 対象ファイル
- [x] src/__tests__/e2e/monitoring-logging-healthcheck.e2e.test.ts（新規作成）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [x] ディレクトリ作成: src/__tests__/e2e/
- [x] E2Eテストファイル作成
- [x] 以下のテストケースを実装（26件）:

  **ヘルスチェック全体疎通**
  - アプリケーション起動後にヘルスチェックが応答する
  - ヘルスレスポンスが正しい形式である
  - 起動ログが出力される
  - 無効なパスで404が返る
  - レスポンス時間が10ms以内
  - 連続したヘルスチェックリクエストが全て成功する

  **Graceful Shutdown**
  - SIGTERMでアプリケーションが正常終了する
  - ヘルスチェックサーバーが最初に停止する
  - 停止ログが出力される
  - 他のシャットダウン処理が実行される

  **メトリクス収集・出力**
  - ジョブ完了時にメトリクスログが出力される
  - executionIdが含まれる
  - 全メトリクスフィールドが含まれる
  - durationMsが正の値である
  - recordsPerSecondが計算されている

  **環境変数設定**
  - HEALTHCHECK_ENABLED=falseでサーバーが起動しない
  - カスタムポートで起動できる
  - デフォルト値が正しく適用される

  **エッジケース・異常系**
  - ポート競合時にエラーログが出力される
  - ポート競合時にアプリは継続動作
  - 0件フェッチでもメトリクスが出力される

  **パフォーマンス**
  - ヘルスチェックが10ms以内で応答（AC-PERF-1）
  - メトリクス収集のオーバーヘッドが1%以下（AC-PERF-2）

  **既存機能との統合**
  - フェッチ処理が正常に動作する
  - 変換処理が正常に動作する
  - 送信処理が正常に動作する

- [x] テスト実行して失敗を確認（実装済みなら通る）
  ```bash
  npm run test:e2e -- src/__tests__/e2e/monitoring-logging-healthcheck.e2e.test.ts
  ```

### 2. Green Phase
- [x] 不足している実装があれば追加
- [x] E2Eテスト実行:
  ```bash
  npm run test:e2e -- src/__tests__/e2e/monitoring-logging-healthcheck.e2e.test.ts
  ```
- [x] 26件全てパス確認

### 3. Refactor Phase
- [x] テストの整理（describe グループ化）
- [x] 共通セットアップの抽出
- [x] テストが引き続き通ることを確認

## 完了条件
- [x] E2Eテスト26件全てパス
- [x] 全受入条件（AC）達成
- [x] TypeScript strict mode: エラー0件
  ```bash
  npm run build
  ```
- [x] Biome lint: エラー0件
  ```bash
  npm run check
  ```
- [x] 動作確認完了（L3: E2Eテスト実行）
  ```bash
  npm run test:e2e -- src/__tests__/e2e/monitoring-logging-healthcheck.e2e.test.ts
  ```

## 注意事項
- 影響範囲: 新規テストファイル、既存コードへの影響なし
- 制約: 実際のプロセス起動・終了を伴うため、適切なクリーンアップが必要
- 環境変数の設定/解除を各テストで適切に行う
- 全受入条件（AC-HC-*, AC-MC-*, AC-LOG-*, AC-ERR-*, AC-PERF-*）対応
