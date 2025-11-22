---
story_id: "5"
title: monitoring-logging-healthcheck
feature: healthcheck
epic_id: "1"
type: task
task_number: "004"
version: 1.0.0
created: 2025-11-22
based_on: specs/stories/5-monitoring-logging-healthcheck/plan.md
---

# タスク: ヘルスチェック統合テスト作成・実行

メタ情報:
- 依存: task-003-graceful-shutdown（GracefulShutdown統合）
- サイズ: 中規模（1ファイル、24テストケース）

## 実装内容
HTTP経由でのヘルスチェック機能の統合テストを作成し、全体動作を検証する。

## 対象ファイル
- [x] src/healthcheck/__tests__/integration/healthcheck.int.test.ts（新規作成）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [x] ディレクトリ作成: src/healthcheck/__tests__/integration/
- [x] 統合テストファイル作成
- [x] 以下のテストケースを実装（24件）:

  **正常系**
  - サーバー起動時に起動ログが出力される
  - GET /health が 200 OK を返す
  - レスポンスボディに必須フィールドが含まれる
  - uptime が数値である
  - timestamp が ISO 8601 形式である
  - Content-Type が application/json である
  - レスポンス時間が 10ms 以内（AC-PERF-1）

  **異常系**
  - GET /invalid が 404 を返す
  - POST /health が 404 を返す
  - PUT /health が 404 を返す
  - DELETE /health が 404 を返す
  - 無効な JSON リクエストでも正常に動作

  **HEALTHCHECK_ENABLED=false**
  - サーバーが起動しない
  - 起動スキップのログが出力される

  **ポート設定**
  - カスタムポートで起動できる
  - EADDRINUSE 時にエラーログが出力される
  - EADDRINUSE 時にアプリは継続動作

  **Graceful Shutdown**
  - SIGTERM でサーバーが停止する
  - 停止時に停止ログが出力される
  - 他のシャットダウン処理が実行される

  **並行リクエスト**
  - 複数同時リクエストを処理できる

  **ログ出力**
  - 起動ログに正しいポートが含まれる
  - 停止ログが出力される
  - AC-LOG-3 対応

- [x] テスト実行して失敗を確認（実装済みなら通る）
  ```bash
  npm run test:int -- src/healthcheck/__tests__/integration/healthcheck.int.test.ts
  ```

### 2. Green Phase
- [x] 不足している実装があれば追加
- [x] 統合テスト実行:
  ```bash
  npm run test:int -- src/healthcheck/__tests__/integration/healthcheck.int.test.ts
  ```
- [x] 24件全てパス確認

### 3. Refactor Phase
- [x] テストの整理（describe グループ化）
- [x] 共通セットアップの抽出
- [x] テストが引き続き通ることを確認

## 完了条件
- [x] 統合テスト24件全てパス
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
  npm run test:int -- src/healthcheck/__tests__/integration/healthcheck.int.test.ts
  ```

## 注意事項
- 影響範囲: 新規テストファイル、既存コードへの影響なし
- 制約: HTTP リクエストを実際に送信するため、ポート競合に注意
- テスト間でサーバーを適切に停止すること
- AC-HC-1, AC-HC-2, AC-HC-3, AC-HC-4, AC-LOG-3, AC-ERR-1, AC-ERR-2, AC-ERR-3, AC-PERF-1 対応
